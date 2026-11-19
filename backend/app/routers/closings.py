"""Session closings ("Cierres") and their catalogs: collaborators and expense types."""

import re

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import Session, col, select

from app.db import SessionDep
from app.models.closing import (
    Closing,
    ClosingExpense,
    ClosingLabor,
    ClosingProduct,
    ClosingStatus,
    Collaborator,
    ExpenseType,
)
from app.models.common import utcnow
from app.schemas.closing import (
    ClosingAmountsIn,
    ClosingDetail,
    ClosingIn,
    ClosingRead,
    ClosingReportRead,
    ClosingRetentionRead,
    CollaboratorIn,
    CollaboratorRead,
    CollaboratorUpdate,
    ExpenseTypeIn,
    ExpenseTypeRead,
    ExpenseTypeUpdate,
)
from app.services.closing import (
    ClosingCalculator,
    ClosingError,
    ClosingInput,
    ClosingReport,
    ExpenseLineIn,
    LaborLineIn,
    ProductLineIn,
    unfreeze,
)
from app.services.csv_export import closing_csv
from app.services.settings import get_settings
from app.services.text import fold

router = APIRouter(tags=["closings"])


def _commit_unique(session: Session, message: str) -> None:
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, message) from exc


def _invalid(exc: ClosingError) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc))


# --- Collaborators ---------------------------------------------------------------------------

_DUPLICATE_COLLABORATOR = "Ya existe un colaborador con ese nombre."


def _get_collaborator(session: Session, collaborator_id: int) -> Collaborator:
    collaborator = session.get(Collaborator, collaborator_id)
    if collaborator is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Colaborador no encontrado.")
    return collaborator


@router.get("/collaborators", response_model=list[CollaboratorRead])
def list_collaborators(session: SessionDep, active: bool | None = None):
    query = select(Collaborator)
    if active is not None:
        query = query.where(Collaborator.active == active)
    return sorted(session.exec(query).all(), key=lambda c: fold(c.name))


@router.post("/collaborators", response_model=CollaboratorRead, status_code=201)
def create_collaborator(payload: CollaboratorIn, session: SessionDep):
    collaborator = Collaborator.model_validate(payload)
    session.add(collaborator)
    _commit_unique(session, _DUPLICATE_COLLABORATOR)
    session.refresh(collaborator)
    return collaborator


@router.patch("/collaborators/{collaborator_id}", response_model=CollaboratorRead)
def update_collaborator(collaborator_id: int, payload: CollaboratorUpdate, session: SessionDep):
    collaborator = _get_collaborator(session, collaborator_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(collaborator, key, value)
    session.add(collaborator)
    _commit_unique(session, _DUPLICATE_COLLABORATOR)
    session.refresh(collaborator)
    return collaborator


@router.delete("/collaborators/{collaborator_id}", status_code=204)
def delete_collaborator(collaborator_id: int, session: SessionDep):
    # Closing lines keep their name and rate (FK is SET NULL).
    session.delete(_get_collaborator(session, collaborator_id))
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Expense types ---------------------------------------------------------------------------

_DUPLICATE_EXPENSE = "Ya existe un gasto con ese nombre."


def _get_expense_type(session: Session, expense_type_id: int) -> ExpenseType:
    expense_type = session.get(ExpenseType, expense_type_id)
    if expense_type is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Gasto no encontrado.")
    return expense_type


def _last_amounts(session: Session) -> dict[int, object]:
    """Amount of each expense type on its most recent closing (by end date, then creation)."""
    rows = session.exec(
        select(ClosingExpense.expense_type_id, ClosingExpense.amount)
        .join(Closing, col(Closing.id) == col(ClosingExpense.closing_id))
        .where(col(ClosingExpense.expense_type_id).is_not(None))
        .order_by(
            col(Closing.end_date).desc(),
            col(Closing.created_at).desc(),
            col(ClosingExpense.position),
        )
    ).all()
    last: dict[int, object] = {}
    for expense_type_id, amount in rows:
        last.setdefault(expense_type_id, amount)
    return last


def _expense_read(expense_type: ExpenseType, last: dict[int, object]) -> ExpenseTypeRead:
    return ExpenseTypeRead.model_validate(
        {**expense_type.model_dump(), "last_amount": last.get(expense_type.id)}
    )


@router.get("/expense-types", response_model=list[ExpenseTypeRead])
def list_expense_types(session: SessionDep, active: bool | None = None):
    query = select(ExpenseType)
    if active is not None:
        query = query.where(ExpenseType.active == active)
    last = _last_amounts(session)
    items = sorted(session.exec(query).all(), key=lambda e: fold(e.name))
    return [_expense_read(e, last) for e in items]


@router.post("/expense-types", response_model=ExpenseTypeRead, status_code=201)
def create_expense_type(payload: ExpenseTypeIn, session: SessionDep):
    expense_type = ExpenseType.model_validate(payload)
    session.add(expense_type)
    _commit_unique(session, _DUPLICATE_EXPENSE)
    session.refresh(expense_type)
    return _expense_read(expense_type, {})


@router.patch("/expense-types/{expense_type_id}", response_model=ExpenseTypeRead)
def update_expense_type(expense_type_id: int, payload: ExpenseTypeUpdate, session: SessionDep):
    expense_type = _get_expense_type(session, expense_type_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(expense_type, key, value)
    session.add(expense_type)
    _commit_unique(session, _DUPLICATE_EXPENSE)
    session.refresh(expense_type)
    return _expense_read(expense_type, _last_amounts(session))


@router.delete("/expense-types/{expense_type_id}", status_code=204)
def delete_expense_type(expense_type_id: int, session: SessionDep):
    session.delete(_get_expense_type(session, expense_type_id))
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Closings --------------------------------------------------------------------------------


def _closing_query():
    return select(Closing).options(
        selectinload(Closing.products), selectinload(Closing.labor), selectinload(Closing.expenses)
    )


def _get_closing(session: Session, closing_id: int) -> Closing:
    closing = session.exec(_closing_query().where(Closing.id == closing_id)).first()
    if closing is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cierre no encontrado.")
    return closing


def _to_input(payload: ClosingAmountsIn) -> ClosingInput:
    return ClosingInput(
        billed_amount=payload.billed_amount,
        vat_amount=payload.vat_amount,
        bank_fee_amount=payload.bank_fee_amount,
        products=[ProductLineIn(p.product_id, p.units) for p in payload.products],
        labor=[
            LaborLineIn(line.name, line.hours, line.hourly_rate, line.collaborator_id)
            for line in payload.labor
        ],
        expenses=[
            ExpenseLineIn(line.name, line.amount, line.expense_type_id) for line in payload.expenses
        ],
    )


def _report(calc: ClosingCalculator, closing: Closing) -> ClosingReport:
    try:
        return calc.stored_report(closing)
    except ClosingError as exc:  # a product line points to a product that no longer exists
        raise _invalid(exc) from exc


def _summary(closing: Closing, report: ClosingReport) -> ClosingRead:
    return ClosingRead.model_validate(
        {
            **closing.model_dump(),
            "billed_amount": closing.billed_amount,
            "net_income": report.net_income,
            "total_expenses": report.total_expenses,
            "net_profit": report.net_profit,
            "net_margin_rate": report.net_margin_rate,
            "complete": report.complete,
        }
    )


def _detail(session: Session, closing_id: int) -> ClosingDetail:
    closing = _get_closing(session, closing_id)
    report = _report(ClosingCalculator(session), closing)
    return ClosingDetail.model_validate(
        {
            **closing.model_dump(),
            "products": [{"product_id": p.product_id, "units": p.units} for p in closing.products],
            "labor": [
                {
                    "collaborator_id": line.collaborator_id,
                    "name": line.name,
                    "hours": line.hours,
                    "hourly_rate": line.hourly_rate,
                }
                for line in closing.labor
            ],
            "expenses": [
                {"expense_type_id": line.expense_type_id, "name": line.name, "amount": line.amount}
                for line in closing.expenses
            ],
            "report": ClosingReportRead.model_validate(report),
        }
    )


def _apply(session: Session, closing: Closing, payload: ClosingIn) -> None:
    """Copy the payload onto a draft closing; lines are replaced. Validates references."""
    calc = ClosingCalculator(session)
    try:
        calc.report(_to_input(payload))  # unknown or repeated products
    except ClosingError as exc:
        raise _invalid(exc) from exc

    collaborators = {c.id: c for c in session.exec(select(Collaborator)).all()}
    expense_types = {e.id: e for e in session.exec(select(ExpenseType)).all()}
    labor = []
    for i, line in enumerate(payload.labor):
        name = line.name
        if line.collaborator_id is not None:
            if line.collaborator_id not in collaborators:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Colaborador no existe.")
            name = collaborators[line.collaborator_id].name  # follow renames while a draft
        labor.append(
            ClosingLabor(
                position=i,
                collaborator_id=line.collaborator_id,
                name=name,
                hours=line.hours,
                hourly_rate=line.hourly_rate,
            )
        )
    expenses = []
    for i, line in enumerate(payload.expenses):
        name = line.name
        if line.expense_type_id is not None:
            if line.expense_type_id not in expense_types:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "El gasto no existe.")
            name = expense_types[line.expense_type_id].name
        expenses.append(
            ClosingExpense(
                position=i, expense_type_id=line.expense_type_id, name=name, amount=line.amount
            )
        )

    closing.name = payload.name
    closing.start_date = payload.start_date
    closing.end_date = payload.end_date
    closing.notes = payload.notes
    closing.billed_amount = payload.billed_amount
    closing.vat_amount = payload.vat_amount
    closing.bank_fee_amount = payload.bank_fee_amount
    closing.products = [
        ClosingProduct(position=i, product_id=p.product_id, units=p.units)
        for i, p in enumerate(payload.products)
    ]
    closing.labor = labor
    closing.expenses = expenses
    closing.updated_at = utcnow()


def _oldest_first(session: Session) -> list[Closing]:
    return list(
        session.exec(
            _closing_query().order_by(
                col(Closing.end_date), col(Closing.created_at), col(Closing.id)
            )
        ).all()
    )


def _to_drop(session: Session) -> list[Closing]:
    """Closings to delete so that a new one fits within `closings_to_keep` (D69)."""
    keep = get_settings(session).closings_to_keep
    closings = _oldest_first(session)
    excess = len(closings) + 1 - keep
    return closings[:excess] if excess > 0 else []


@router.get("/closings", response_model=list[ClosingRead])
def list_closings(session: SessionDep):
    calc = ClosingCalculator(session)
    closings = reversed(_oldest_first(session))  # newest first
    return [_summary(c, _report(calc, c)) for c in closings]


@router.get("/closings/retention", response_model=ClosingRetentionRead)
def closing_retention(session: SessionDep):
    calc = ClosingCalculator(session)
    drop = _to_drop(session)
    return ClosingRetentionRead(
        keep=get_settings(session).closings_to_keep,
        count=len(_oldest_first(session)),
        will_delete=[_summary(c, _report(calc, c)) for c in drop],
    )


@router.post("/closings/preview", response_model=ClosingReportRead)
def preview_closing(payload: ClosingAmountsIn, session: SessionDep):
    try:
        return ClosingReportRead.model_validate(
            ClosingCalculator(session).report(_to_input(payload))
        )
    except ClosingError as exc:
        raise _invalid(exc) from exc


@router.post("/closings", response_model=ClosingDetail, status_code=201)
def create_closing(payload: ClosingIn, session: SessionDep):
    closing = Closing(name=payload.name, start_date=payload.start_date, end_date=payload.end_date)
    _apply(session, closing, payload)
    for old in _to_drop(session):
        session.delete(old)
    session.add(closing)
    session.commit()
    return _detail(session, closing.id)


@router.get("/closings/{closing_id}", response_model=ClosingDetail)
def read_closing(closing_id: int, session: SessionDep):
    return _detail(session, closing_id)


@router.put("/closings/{closing_id}", response_model=ClosingDetail)
def update_closing(closing_id: int, payload: ClosingIn, session: SessionDep):
    closing = _get_closing(session, closing_id)
    if closing.status == ClosingStatus.CLOSED:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "El cierre está cerrado. Reábrelo para editarlo."
        )
    _apply(session, closing, payload)
    session.add(closing)
    session.commit()
    return _detail(session, closing_id)


@router.delete("/closings/{closing_id}", status_code=204)
def delete_closing(closing_id: int, session: SessionDep):
    session.delete(_get_closing(session, closing_id))
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/closings/{closing_id}/close", response_model=ClosingDetail)
def close_closing(closing_id: int, session: SessionDep):
    closing = _get_closing(session, closing_id)
    if closing.status == ClosingStatus.CLOSED:
        raise HTTPException(status.HTTP_409_CONFLICT, "El cierre ya está cerrado.")
    if not closing.products:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Agrega al menos un producto vendido antes de cerrar.",
        )
    try:
        ClosingCalculator(session).freeze(closing)
    except ClosingError as exc:
        raise _invalid(exc) from exc
    closing.status = ClosingStatus.CLOSED
    closing.closed_at = closing.updated_at = utcnow()
    session.add(closing)
    session.commit()
    return _detail(session, closing_id)


@router.post("/closings/{closing_id}/reopen", response_model=ClosingDetail)
def reopen_closing(closing_id: int, session: SessionDep):
    closing = _get_closing(session, closing_id)
    if closing.status != ClosingStatus.CLOSED:
        raise HTTPException(status.HTTP_409_CONFLICT, "El cierre no está cerrado.")
    unfreeze(closing)
    closing.status = ClosingStatus.DRAFT
    closing.closed_at = None
    closing.updated_at = utcnow()
    session.add(closing)
    session.commit()
    return _detail(session, closing_id)


@router.get(
    "/closings/{closing_id}/export.csv",
    response_class=Response,
    responses={200: {"content": {"text/csv": {}}}},
)
def export_closing(closing_id: int, session: SessionDep):
    closing = _get_closing(session, closing_id)
    report = _report(ClosingCalculator(session), closing)
    slug = re.sub(r"[^a-z0-9]+", "-", fold(closing.name)).strip("-") or "cierre"
    filename = f"badger-cierre-{slug}-{closing.end_date:%Y%m%d}.csv"
    return Response(
        content=closing_csv(closing, report).encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
