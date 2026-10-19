"""Sales periods (units sold per product and channel) and menu engineering."""

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.db import SessionDep
from app.models.product import Product, SalesPlatform
from app.models.sales import SalesEntry, SalesPeriod
from app.schemas.sales import (
    MenuGroupAnalysisRead,
    SalesCsvIn,
    SalesEntriesIn,
    SalesEntryRead,
    SalesImportResult,
    SalesPeriodDetail,
    SalesPeriodIn,
    SalesPeriodRead,
    SalesPeriodUpdate,
)
from app.services.menu_engineering import analyze_period
from app.services.sales_import import SalesFormatError, parse_sales_csv
from app.services.text import fold

router = APIRouter(prefix="/sales-periods", tags=["sales"])


def _get_period(session: Session, period_id: int) -> SalesPeriod:
    period = session.exec(
        select(SalesPeriod)
        .where(SalesPeriod.id == period_id)
        .options(selectinload(SalesPeriod.entries))
    ).first()
    if period is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Periodo no encontrado.")
    return period


def _summary(period: SalesPeriod) -> dict:
    return {
        **period.model_dump(),
        "total_units": sum(e.units for e in period.entries),
        "product_count": len({e.product_id for e in period.entries}),
    }


def _detail(period: SalesPeriod) -> SalesPeriodDetail:
    entries = sorted(period.entries, key=lambda e: (e.product_id, e.platform_id or 0))
    return SalesPeriodDetail.model_validate(
        {**_summary(period), "entries": [SalesEntryRead.model_validate(e) for e in entries]}
    )


def _commit_unique(session: Session) -> None:
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Ya existe un periodo con ese nombre."
        ) from exc


@router.get("", response_model=list[SalesPeriodRead])
def list_periods(session: SessionDep):
    periods = session.exec(select(SalesPeriod).options(selectinload(SalesPeriod.entries))).all()
    periods = sorted(periods, key=lambda p: (p.start_date, p.id), reverse=True)
    return [SalesPeriodRead.model_validate(_summary(p)) for p in periods]


@router.post("", response_model=SalesPeriodDetail, status_code=status.HTTP_201_CREATED)
def create_period(payload: SalesPeriodIn, session: SessionDep):
    period = SalesPeriod.model_validate(payload)
    session.add(period)
    _commit_unique(session)
    return _detail(_get_period(session, period.id))


@router.get("/{period_id}", response_model=SalesPeriodDetail)
def read_period(period_id: int, session: SessionDep):
    return _detail(_get_period(session, period_id))


@router.patch("/{period_id}", response_model=SalesPeriodDetail)
def update_period(period_id: int, payload: SalesPeriodUpdate, session: SessionDep):
    period = _get_period(session, period_id)
    for name, value in payload.model_dump(exclude_unset=True).items():
        if value is None and name != "notes":
            continue
        setattr(period, name, value)
    if period.end_date < period.start_date:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "La fecha final debe ser igual o posterior a la inicial.",
        )
    session.add(period)
    _commit_unique(session)
    return _detail(_get_period(session, period_id))


@router.delete("/{period_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_period(period_id: int, session: SessionDep):
    session.delete(_get_period(session, period_id))
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _set_units(
    session: Session, period: SalesPeriod, units: dict[tuple[int, int | None], int]
) -> None:
    """Upsert entries; 0 units removes the entry."""
    existing = {(e.product_id, e.platform_id): e for e in period.entries}
    for (product_id, platform_id), value in units.items():
        entry = existing.get((product_id, platform_id))
        if value == 0:
            if entry is not None:
                period.entries.remove(entry)
        elif entry is None:
            period.entries.append(
                SalesEntry(product_id=product_id, platform_id=platform_id, units=value)
            )
        else:
            entry.units = value
    session.add(period)


@router.put("/{period_id}/entries", response_model=SalesPeriodDetail)
def replace_entries(period_id: int, payload: SalesEntriesIn, session: SessionDep):
    """Replace all units of the period with the given list."""
    period = _get_period(session, period_id)
    product_ids = set(session.exec(select(Product.id)).all())
    platform_ids = set(session.exec(select(SalesPlatform.id)).all())
    units: dict[tuple[int, int | None], int] = {}
    for entry in payload.entries:
        if entry.product_id not in product_ids:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, f"El producto #{entry.product_id} no existe."
            )
        if entry.platform_id is not None and entry.platform_id not in platform_ids:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                f"La plataforma #{entry.platform_id} no existe.",
            )
        key = (entry.product_id, entry.platform_id)
        if key in units:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "Hay filas repetidas (producto y canal)."
            )
        units[key] = entry.units
    for entry in list(period.entries):
        if (entry.product_id, entry.platform_id) not in units:
            units[(entry.product_id, entry.platform_id)] = 0
    _set_units(session, period, units)
    session.commit()
    session.expire_all()
    return _detail(_get_period(session, period_id))


@router.post("/{period_id}/import", response_model=SalesImportResult)
def import_csv(period_id: int, payload: SalesCsvIn, session: SessionDep):
    """Import units from CSV text. With `replace`, imported rows overwrite existing values;
    otherwise they're added to them."""
    period = _get_period(session, period_id)
    products = {fold(name): pid for pid, name in session.exec(select(Product.id, Product.name))}
    platforms = {
        fold(name): pid for pid, name in session.exec(select(SalesPlatform.id, SalesPlatform.name))
    }
    try:
        parsed = parse_sales_csv(payload.content, products, platforms)
    except SalesFormatError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    if not payload.replace:
        current = {(e.product_id, e.platform_id): e.units for e in period.entries}
        parsed.units = {k: v + current.get(k, 0) for k, v in parsed.units.items()}
    _set_units(session, period, parsed.units)
    session.commit()
    return SalesImportResult(
        imported_rows=len(parsed.units),
        unmatched_products=parsed.unmatched_products,
        unmatched_channels=parsed.unmatched_channels,
        invalid_rows=parsed.invalid_rows,
    )


@router.get("/{period_id}/menu-engineering", response_model=list[MenuGroupAnalysisRead])
def menu_engineering(period_id: int, session: SessionDep):
    _get_period(session, period_id)
    return [MenuGroupAnalysisRead.model_validate(a) for a in analyze_period(session, period_id)]
