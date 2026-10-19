from collections.abc import Sequence

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy.orm import selectinload
from sqlmodel import Session, col, select

from app.db import SessionDep
from app.models.common import utcnow
from app.models.settings import CostMode
from app.models.supply import DEFAULT_SUPPLY_GROUPS, Supply, SupplyPrice, UnitEquivalence
from app.schemas.supply import (
    EquivalenceIn,
    PriceCreate,
    PriceRead,
    SupplyCreate,
    SupplyDetail,
    SupplyFacets,
    SupplyRead,
    SupplyUpdate,
)
from app.services.settings import get_settings
from app.services.supply_cost import prices_in_effect, sort_newest_first, supply_cost
from app.services.text import fold
from app.services.units import PieceEquivalence, UnitConversionError

router = APIRouter(prefix="/supplies", tags=["supplies"])


def _to_read(supply: Supply, mode: CostMode) -> SupplyRead:
    cost = supply_cost(supply.pack_qty, supply.pack_unit, supply.prices, mode)
    return SupplyRead.model_validate(
        {
            **supply.model_dump(),
            "equivalence": supply.equivalence,
            "base_unit": cost.base_unit,
            "current_price": cost.pack_price,
            "unit_cost": cost.unit_cost,
            "reference_unit": cost.reference_unit,
            "reference_unit_cost": cost.reference_unit_cost,
            "last_price_date": cost.last_price_date,
            "price_count": len(supply.prices),
        }
    )


def _price_reads(prices: Sequence[SupplyPrice], mode: CostMode) -> list[PriceRead]:
    in_effect = {p.id for p in prices_in_effect(prices, mode)}
    return [
        PriceRead.model_validate({**p.model_dump(), "in_effect": p.id in in_effect})
        for p in sort_newest_first(prices)
    ]


def _to_detail(supply: Supply, mode: CostMode) -> SupplyDetail:
    return SupplyDetail.model_validate(
        {**_to_read(supply, mode).model_dump(), "prices": _price_reads(supply.prices, mode)}
    )


def _get_supply(session: Session, supply_id: int) -> Supply:
    supply = session.exec(
        select(Supply)
        .where(Supply.id == supply_id)
        .options(selectinload(Supply.prices), selectinload(Supply.equivalence))
    ).first()
    if supply is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Suministro no encontrado.")
    return supply


def _set_equivalence(supply: Supply, equivalence: EquivalenceIn | None) -> None:
    if equivalence is None:
        supply.equivalence = None
        return
    try:
        PieceEquivalence(equivalence.quantity, equivalence.unit)
    except UnitConversionError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    if supply.equivalence is None:
        supply.equivalence = UnitEquivalence(quantity=equivalence.quantity, unit=equivalence.unit)
    else:
        supply.equivalence.quantity = equivalence.quantity
        supply.equivalence.unit = equivalence.unit


@router.get("", response_model=list[SupplyRead])
def list_supplies(
    session: SessionDep,
    q: str | None = Query(default=None, description="Search in name and brand."),
    group: str | None = None,
    supplier: str | None = None,
    active: bool | None = Query(default=None, description="Omit to include all."),
):
    query = select(Supply).options(selectinload(Supply.prices), selectinload(Supply.equivalence))
    if group:
        query = query.where(Supply.group == group)
    if supplier:
        query = query.where(Supply.supplier == supplier)
    if active is not None:
        query = query.where(Supply.active == active)
    supplies = list(session.exec(query).all())

    if q and q.strip():
        needle = fold(q.strip())
        supplies = [s for s in supplies if needle in fold(f"{s.name} {s.brand or ''}")]

    mode = get_settings(session).cost_mode
    supplies.sort(key=lambda s: fold(s.name))
    return [_to_read(s, mode) for s in supplies]


@router.get("/facets", response_model=SupplyFacets)
def supply_facets(session: SessionDep):
    """Known groups (defaults + used) and suppliers, for filters and autocomplete."""
    used_groups = session.exec(select(Supply.group).distinct()).all()
    supply_suppliers = session.exec(select(Supply.supplier).distinct()).all()
    price_suppliers = session.exec(select(SupplyPrice.supplier).distinct()).all()
    groups = {*DEFAULT_SUPPLY_GROUPS, *used_groups}
    suppliers = {s for s in [*supply_suppliers, *price_suppliers] if s}
    return SupplyFacets(groups=sorted(groups, key=fold), suppliers=sorted(suppliers, key=fold))


@router.post("", response_model=SupplyDetail, status_code=status.HTTP_201_CREATED)
def create_supply(payload: SupplyCreate, session: SessionDep):
    supply = Supply.model_validate(payload.model_dump(exclude={"equivalence", "initial_price"}))
    _set_equivalence(supply, payload.equivalence)
    if payload.initial_price is not None:
        price = payload.initial_price
        supply.prices.append(
            SupplyPrice(
                amount=price.amount,
                purchased_on=price.purchased_on,
                supplier=price.supplier or supply.supplier,
            )
        )
    session.add(supply)
    session.commit()
    return _to_detail(_get_supply(session, supply.id), get_settings(session).cost_mode)


@router.get("/{supply_id}", response_model=SupplyDetail)
def read_supply(supply_id: int, session: SessionDep):
    return _to_detail(_get_supply(session, supply_id), get_settings(session).cost_mode)


@router.patch("/{supply_id}", response_model=SupplyDetail)
def update_supply(supply_id: int, payload: SupplyUpdate, session: SessionDep):
    supply = _get_supply(session, supply_id)
    changes = payload.model_dump(exclude_unset=True, exclude={"equivalence"})
    for field, value in changes.items():
        setattr(supply, field, value)
    if "equivalence" in payload.model_fields_set:
        _set_equivalence(supply, payload.equivalence)
    supply.updated_at = utcnow()
    session.add(supply)
    session.commit()
    return _to_detail(_get_supply(session, supply_id), get_settings(session).cost_mode)


@router.delete("/{supply_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supply(supply_id: int, session: SessionDep):
    # TODO(M2): refuse when the supply is used by a recipe (suggest deactivating instead).
    session.delete(_get_supply(session, supply_id))
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{supply_id}/prices", response_model=list[PriceRead])
def list_prices(supply_id: int, session: SessionDep):
    supply = _get_supply(session, supply_id)
    return _price_reads(supply.prices, get_settings(session).cost_mode)


@router.post(
    "/{supply_id}/prices", response_model=SupplyDetail, status_code=status.HTTP_201_CREATED
)
def add_price(supply_id: int, payload: PriceCreate, session: SessionDep):
    supply = _get_supply(session, supply_id)
    supply.prices.append(
        SupplyPrice(
            amount=payload.amount,
            purchased_on=payload.purchased_on,
            supplier=payload.supplier or supply.supplier,
        )
    )
    supply.updated_at = utcnow()
    session.add(supply)
    session.commit()
    return _to_detail(_get_supply(session, supply_id), get_settings(session).cost_mode)


@router.delete("/{supply_id}/prices/{price_id}", response_model=SupplyDetail)
def delete_price(supply_id: int, price_id: int, session: SessionDep):
    price = session.exec(
        select(SupplyPrice).where(
            SupplyPrice.id == price_id, col(SupplyPrice.supply_id) == supply_id
        )
    ).first()
    if price is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Precio no encontrado.")
    session.delete(price)
    session.commit()
    session.expire_all()
    return _to_detail(_get_supply(session, supply_id), get_settings(session).cost_mode)
