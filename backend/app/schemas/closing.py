from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Self

from pydantic import Field, model_validator

from app.models.closing import ClosingStatus
from app.schemas.common import (
    ApiModel,
    DecimalOut,
    LongOptionalText,
    NonNegativeDecimal,
    PositiveDecimal,
    RequiredText,
)

# --- Catalogs --------------------------------------------------------------------------------


class CollaboratorIn(ApiModel):
    name: RequiredText
    hourly_rate: NonNegativeDecimal = Decimal(0)
    active: bool = True


class CollaboratorUpdate(ApiModel):
    name: RequiredText | None = None
    hourly_rate: NonNegativeDecimal | None = None
    active: bool | None = None


class CollaboratorRead(ApiModel):
    id: int
    name: str
    hourly_rate: DecimalOut
    active: bool


class ExpenseTypeIn(ApiModel):
    name: RequiredText
    active: bool = True


class ExpenseTypeUpdate(ApiModel):
    name: RequiredText | None = None
    active: bool | None = None


class ExpenseTypeRead(ApiModel):
    id: int
    name: str
    active: bool
    last_amount: DecimalOut | None = Field(
        default=None, description="Amount on the most recent closing that used it (prefill)."
    )


# --- Closing input ---------------------------------------------------------------------------


class ClosingProductIn(ApiModel):
    product_id: int
    units: Annotated[int, Field(ge=0)]


class ClosingLaborIn(ApiModel):
    collaborator_id: int | None = None
    name: RequiredText
    hours: PositiveDecimal
    hourly_rate: NonNegativeDecimal


class ClosingExpenseIn(ApiModel):
    expense_type_id: int | None = None
    name: RequiredText
    amount: NonNegativeDecimal


class ClosingAmountsIn(ApiModel):
    """What the report needs: amounts and lines (also used by the live preview)."""

    billed_amount: NonNegativeDecimal = Decimal(0)
    vat_amount: NonNegativeDecimal = Decimal(0)
    bank_fee_amount: NonNegativeDecimal = Decimal(0)
    products: list[ClosingProductIn] = []
    labor: list[ClosingLaborIn] = []
    expenses: list[ClosingExpenseIn] = []


class ClosingIn(ClosingAmountsIn):
    name: RequiredText
    start_date: date
    end_date: date
    notes: LongOptionalText = None

    @model_validator(mode="after")
    def dates_in_order(self) -> Self:
        if self.end_date < self.start_date:
            raise ValueError("La fecha final debe ser igual o posterior a la inicial.")
        return self


# --- Report ----------------------------------------------------------------------------------


class ClosingProductReport(ApiModel):
    product_id: int
    name: str
    units: int
    unit_cost: DecimalOut
    food_cost: DecimalOut
    packaging_cost: DecimalOut
    total_cost: DecimalOut
    unit_price: DecimalOut | None
    expected_revenue: DecimalOut | None
    complete: bool
    issues: list[str]


class ClosingLaborReport(ApiModel):
    collaborator_id: int | None
    name: str
    hours: DecimalOut
    hourly_rate: DecimalOut
    total: DecimalOut


class ClosingExpenseReport(ApiModel):
    expense_type_id: int | None
    name: str
    amount: DecimalOut


class ClosingReportRead(ApiModel):
    frozen: bool
    billed_amount: DecimalOut
    vat_amount: DecimalOut
    bank_fee_amount: DecimalOut
    net_income: DecimalOut
    products: list[ClosingProductReport]
    labor: list[ClosingLaborReport]
    expenses: list[ClosingExpenseReport]
    total_units: int
    product_cost: DecimalOut
    food_cost: DecimalOut
    packaging_cost: DecimalOut
    labor_cost: DecimalOut
    labor_hours: DecimalOut
    other_expenses: DecimalOut
    total_expenses: DecimalOut
    net_profit: DecimalOut
    net_margin_rate: DecimalOut | None
    food_cost_rate: DecimalOut | None
    labor_rate: DecimalOut | None
    prime_cost_rate: DecimalOut | None
    other_expenses_rate: DecimalOut | None
    expected_billing: DecimalOut | None
    billing_difference: DecimalOut | None
    products_without_price: list[str]
    complete: bool
    warnings: list[str]
    suggested_vat_amount: DecimalOut
    suggested_bank_fee_amount: DecimalOut


# --- Stored closings -------------------------------------------------------------------------


class ClosingRead(ApiModel):
    """List row."""

    id: int
    name: str
    start_date: date
    end_date: date
    status: ClosingStatus
    closed_at: datetime | None
    created_at: datetime
    billed_amount: DecimalOut
    net_income: DecimalOut
    total_expenses: DecimalOut
    net_profit: DecimalOut
    net_margin_rate: DecimalOut | None
    complete: bool


class ClosingDetail(ApiModel):
    id: int
    name: str
    start_date: date
    end_date: date
    notes: str | None
    status: ClosingStatus
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    billed_amount: DecimalOut
    vat_amount: DecimalOut
    bank_fee_amount: DecimalOut
    products: list[ClosingProductIn]
    labor: list[ClosingLaborIn]
    expenses: list[ClosingExpenseIn]
    report: ClosingReportRead


class ClosingRetentionRead(ApiModel):
    keep: int
    count: int
    will_delete: list[ClosingRead] = Field(
        description="Closings that creating a new one would delete (oldest first)."
    )
