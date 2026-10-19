from datetime import datetime
from decimal import Decimal
from typing import Self

from pydantic import Field, model_validator

from app.schemas.common import (
    ApiModel,
    LongOptionalText,
    NonNegativeDecimal,
    PositiveDecimal,
    RequiredText,
)
from app.schemas.recipe import ItemCostRead, RecipeCostRead, RecipeItemIn, RecipeItemRead
from app.schemas.settings import PositiveRate, Rate
from app.services.pricing import AlertLevel, ChannelKind

# --- Platforms and menu groups ------------------------------------------------------------------


class PlatformIn(ApiModel):
    name: RequiredText
    fee_rate: Rate = Field(description="0.30 = 30 % of PVP")
    active: bool = True


class PlatformUpdate(ApiModel):
    name: RequiredText | None = None
    fee_rate: Rate | None = None
    active: bool | None = None


class PlatformRead(PlatformIn):
    id: int


class MenuGroupIn(ApiModel):
    name: RequiredText
    position: int = 0
    target_food_cost_rate: PositiveRate | None = Field(
        default=None, description="None = use the default from settings"
    )


class MenuGroupUpdate(ApiModel):
    name: RequiredText | None = None
    position: int | None = None
    target_food_cost_rate: PositiveRate | None = None


class MenuGroupRead(MenuGroupIn):
    id: int
    product_count: int


# --- Products ----------------------------------------------------------------------------------


class PlatformPriceIn(ApiModel):
    platform_id: int
    price: NonNegativeDecimal


class ProductBase(ApiModel):
    name: RequiredText
    menu_group_id: int
    recipe_id: int | None = None
    recipe_portions: PositiveDecimal = Decimal(1)
    direct_price: NonNegativeDecimal | None = Field(default=None, description="PVP, VAT included")
    target_cost: NonNegativeDecimal | None = Field(default=None, description="Costo teórico")
    active: bool = True
    notes: LongOptionalText = None


class ProductCreate(ProductBase):
    items: list[RecipeItemIn] = []
    packaging: list[RecipeItemIn] = []
    platform_prices: list[PlatformPriceIn] = []


class ProductUpdate(ApiModel):
    """Partial update. `items`, `packaging` and `platform_prices` replace their list when sent."""

    name: RequiredText | None = None
    menu_group_id: int | None = None
    recipe_id: int | None = None
    recipe_portions: PositiveDecimal | None = None
    direct_price: NonNegativeDecimal | None = None
    target_cost: NonNegativeDecimal | None = None
    active: bool | None = None
    notes: LongOptionalText = None
    items: list[RecipeItemIn] | None = None
    packaging: list[RecipeItemIn] | None = None
    platform_prices: list[PlatformPriceIn] | None = None

    @model_validator(mode="after")
    def required_fields_not_null(self) -> Self:
        required = (
            "name",
            "menu_group_id",
            "recipe_portions",
            "active",
            "items",
            "packaging",
            "platform_prices",
        )
        for name in required:
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"El campo '{name}' no puede ser nulo.")
        return self


class ProductPreview(ApiModel):
    """Unsaved product to cost and price live from the editor."""

    menu_group_id: int | None = None
    recipe_id: int | None = None
    recipe_portions: PositiveDecimal = Decimal(1)
    direct_price: NonNegativeDecimal | None = None
    target_cost: NonNegativeDecimal | None = None
    items: list[RecipeItemIn] = []
    packaging: list[RecipeItemIn] = []
    platform_prices: list[PlatformPriceIn] = []


class ProductCostRead(ApiModel):
    recipe: RecipeCostRead | None
    recipe_portions: Decimal
    recipe_cost: Decimal
    items: list[ItemCostRead]
    items_cost: Decimal
    packaging: list[ItemCostRead]
    packaging_cost: Decimal
    total_cost: Decimal
    complete: bool
    issues: list[str]


class ChannelPricingRead(ApiModel):
    kind: ChannelKind
    platform_id: int | None
    name: str
    price: Decimal
    price_ex_vat: Decimal
    fee_rate: Decimal
    fee: Decimal
    cost: Decimal
    food_cost_rate: Decimal | None
    margin: Decimal
    margin_rate: Decimal | None
    margin_status: AlertLevel
    food_cost_status: AlertLevel


class ProductPricingRead(ApiModel):
    cost: ProductCostRead
    target_food_cost_rate: Decimal
    suggested_price: Decimal | None
    target_cost: Decimal | None
    deviation: Decimal | None
    deviation_status: AlertLevel
    channels: list[ChannelPricingRead]
    status: AlertLevel = Field(description="Worst alert across channels and deviation")


class ProductSummary(ApiModel):
    id: int
    name: str
    menu_group_id: int
    menu_group_name: str
    recipe_id: int | None
    recipe_name: str | None
    active: bool
    total_cost: Decimal
    complete: bool
    target_food_cost_rate: Decimal
    suggested_price: Decimal | None
    target_cost: Decimal | None
    deviation: Decimal | None
    deviation_status: AlertLevel
    channels: list[ChannelPricingRead]
    status: AlertLevel


class PlatformPriceRead(ApiModel):
    platform_id: int
    price: Decimal


class ProductDetail(ProductBase):
    id: int
    menu_group_name: str
    items: list[RecipeItemRead]
    packaging: list[RecipeItemRead]
    platform_prices: list[PlatformPriceRead]
    pricing: ProductPricingRead
    created_at: datetime
    updated_at: datetime
