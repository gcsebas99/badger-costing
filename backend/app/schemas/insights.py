from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import Field

from app.schemas.common import ApiModel, DecimalOut
from app.services.pricing import AlertLevel

# --- Dashboard ---------------------------------------------------------------------------------


class ProductAlertRead(ApiModel):
    id: int
    name: str
    menu_group_name: str
    status: AlertLevel
    total_cost: DecimalOut
    worst_margin_rate: DecimalOut | None
    worst_channel: str | None
    reasons: list[str]


class PriceIncreaseRead(ApiModel):
    supply_id: int
    name: str
    previous_price: DecimalOut
    latest_price: DecimalOut
    change_rate: DecimalOut
    latest_date: date
    previous_date: date


class IncompleteRead(ApiModel):
    kind: Literal["recipe", "product"]
    id: int
    name: str
    issues: list[str]


class UnpricedSupplyRead(ApiModel):
    id: int
    name: str


class DashboardRead(ApiModel):
    active_products: int
    products_below_margin: int
    incomplete_count: int
    supplies_without_price: int
    products_to_review: list[ProductAlertRead]
    price_increases: list[PriceIncreaseRead]
    incomplete: list[IncompleteRead]
    unpriced_supplies: list[UnpricedSupplyRead]


# --- Simulation --------------------------------------------------------------------------------

ChangeRate = Annotated[DecimalOut, Field(gt=-1, le=10, description="0.10 = +10 %")]


class SupplyChangeIn(ApiModel):
    supply_id: int
    change_rate: ChangeRate


class SimulationIn(ApiModel):
    changes: list[SupplyChangeIn] = Field(min_length=1, max_length=50)


class SupplyChangeRead(ApiModel):
    supply_id: int
    name: str
    change_rate: DecimalOut
    reference_unit: str
    cost_before: DecimalOut | None
    cost_after: DecimalOut | None


class RecipeImpactRead(ApiModel):
    id: int
    name: str
    category: str
    cost_before: DecimalOut
    cost_after: DecimalOut
    delta: DecimalOut
    delta_rate: DecimalOut | None


class ChannelImpactRead(ApiModel):
    name: str
    margin_before: DecimalOut
    margin_after: DecimalOut
    margin_rate_before: DecimalOut | None
    margin_rate_after: DecimalOut | None
    status_before: AlertLevel
    status_after: AlertLevel


class ProductImpactRead(ApiModel):
    id: int
    name: str
    menu_group_name: str
    cost_before: DecimalOut
    cost_after: DecimalOut
    delta: DecimalOut
    delta_rate: DecimalOut | None
    suggested_price_after: DecimalOut | None
    status_before: AlertLevel
    status_after: AlertLevel
    channels: list[ChannelImpactRead]


class SimulationRead(ApiModel):
    changes: list[SupplyChangeRead]
    recipes: list[RecipeImpactRead]
    products: list[ProductImpactRead]


# --- Backups -----------------------------------------------------------------------------------


class BackupRead(ApiModel):
    name: str
    size: int
    created_at: datetime
