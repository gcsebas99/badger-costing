"""Session closings ("Cierres"): what a sales session really sold and spent."""

from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field, Relationship, SQLModel

from app.models.common import utcnow
from app.models.types import DecimalText, value_enum


class ClosingStatus(StrEnum):
    DRAFT = "draft"  # costs computed live
    CLOSED = "closed"  # costs frozen in the product lines' snapshot


class Collaborator(SQLModel, table=True):
    """Kitchen collaborator with a default hourly rate (each closing line keeps its own rate)."""

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    hourly_rate: Decimal = Field(default=Decimal(0), sa_type=DecimalText)
    active: bool = True


class ExpenseType(SQLModel, table=True):
    """Reusable name of an expense not costed inside products (frying oil, electricity…)."""

    __tablename__ = "expense_type"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    active: bool = True


class Closing(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    start_date: date
    end_date: date = Field(index=True)
    status: ClosingStatus = Field(default=ClosingStatus.DRAFT, sa_type=value_enum(ClosingStatus))
    # Billed total (VAT included) and the amounts to subtract from it, typed by hand.
    billed_amount: Decimal = Field(default=Decimal(0), sa_type=DecimalText)
    vat_amount: Decimal = Field(default=Decimal(0), sa_type=DecimalText)
    bank_fee_amount: Decimal = Field(default=Decimal(0), sa_type=DecimalText)
    notes: str | None = None
    closed_at: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    products: list["ClosingProduct"] = Relationship(
        back_populates="closing",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "order_by": "ClosingProduct.position",
        },
    )
    labor: list["ClosingLabor"] = Relationship(
        back_populates="closing",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "order_by": "ClosingLabor.position",
        },
    )
    expenses: list["ClosingExpense"] = Relationship(
        back_populates="closing",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "order_by": "ClosingExpense.position",
        },
    )


def _closing_fk() -> Column:
    return Column(Integer, ForeignKey("closing.id", ondelete="CASCADE"), index=True, nullable=False)


class ClosingProduct(SQLModel, table=True):
    """Units sold of a product. The snapshot columns are filled when the closing is closed."""

    __tablename__ = "closing_product"

    id: int | None = Field(default=None, primary_key=True)
    closing_id: int = Field(sa_column=_closing_fk())
    position: int = 0
    # RESTRICT: a stored closing must not lose its products; deactivate them instead.
    product_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("product.id", ondelete="RESTRICT"), index=True, nullable=False
        )
    )
    units: int
    # Snapshot (null while draft)
    name: str | None = None
    unit_cost: Decimal | None = Field(default=None, sa_type=DecimalText)
    food_cost: Decimal | None = Field(default=None, sa_type=DecimalText)
    packaging_cost: Decimal | None = Field(default=None, sa_type=DecimalText)
    unit_price: Decimal | None = Field(default=None, sa_type=DecimalText)
    cost_complete: bool | None = None

    closing: Closing = Relationship(back_populates="products")


class ClosingLabor(SQLModel, table=True):
    """Hours worked by a collaborator, with the rate charged in this session."""

    __tablename__ = "closing_labor"

    id: int | None = Field(default=None, primary_key=True)
    closing_id: int = Field(sa_column=_closing_fk())
    position: int = 0
    collaborator_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("collaborator.id", ondelete="SET NULL")),
    )
    name: str
    hours: Decimal = Field(sa_type=DecimalText)
    hourly_rate: Decimal = Field(sa_type=DecimalText)

    closing: Closing = Relationship(back_populates="labor")


class ClosingExpense(SQLModel, table=True):
    """An expense of the session (frying oil, electricity…)."""

    __tablename__ = "closing_expense"

    id: int | None = Field(default=None, primary_key=True)
    closing_id: int = Field(sa_column=_closing_fk())
    position: int = 0
    expense_type_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("expense_type.id", ondelete="SET NULL")),
    )
    name: str
    amount: Decimal = Field(sa_type=DecimalText)

    closing: Closing = Relationship(back_populates="expenses")
