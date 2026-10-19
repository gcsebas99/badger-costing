from datetime import datetime
from decimal import Decimal
from typing import Annotated, Self

from pydantic import Field, model_validator

from app.models.recipe import RecipeItemType
from app.schemas.common import (
    ApiModel,
    LongOptionalText,
    PositiveDecimal,
    RequiredText,
)
from app.services.costing import ItemStatus
from app.services.units import Unit

WasteRate = Annotated[Decimal, Field(ge=0, le=10, description="0.13 = 13 %")]
MarginRate = Annotated[Decimal, Field(ge=0, le=1, description="0.05 = 5 %")]


class RecipeItemIn(ApiModel):
    item_type: RecipeItemType
    ref_id: int = Field(description="Supply id or sub-recipe id, depending on item_type.")
    quantity: PositiveDecimal = Field(description="Net quantity.")
    unit: Unit
    waste_rate: WasteRate = Decimal(0)


class RecipeItemRead(ApiModel):
    id: int
    position: int
    item_type: RecipeItemType
    ref_id: int
    quantity: Decimal
    unit: Unit
    waste_rate: Decimal


class RecipeBase(ApiModel):
    name: RequiredText
    category: RequiredText
    is_subrecipe: bool = False
    yield_qty: PositiveDecimal
    yield_unit: Unit
    portions: PositiveDecimal
    safety_margin_rate: MarginRate = Decimal(0)
    notes: LongOptionalText = None


class RecipeCreate(RecipeBase):
    items: list[RecipeItemIn] = []


class RecipeUpdate(ApiModel):
    """Partial update. When `items` is sent, it replaces all ingredient lines."""

    name: RequiredText | None = None
    category: RequiredText | None = None
    is_subrecipe: bool | None = None
    yield_qty: PositiveDecimal | None = None
    yield_unit: Unit | None = None
    portions: PositiveDecimal | None = None
    safety_margin_rate: MarginRate | None = None
    notes: LongOptionalText = None
    items: list[RecipeItemIn] | None = None

    @model_validator(mode="after")
    def required_fields_not_null(self) -> Self:
        required = (
            "name",
            "category",
            "is_subrecipe",
            "yield_qty",
            "yield_unit",
            "portions",
            "safety_margin_rate",
            "items",
        )
        for name in required:
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"El campo '{name}' no puede ser nulo.")
        return self


class RecipePreview(ApiModel):
    """Unsaved recipe to cost live from the editor. `id` = recipe being edited, if any."""

    id: int | None = None
    name: str = "Borrador"
    yield_qty: PositiveDecimal
    yield_unit: Unit
    portions: PositiveDecimal
    safety_margin_rate: MarginRate = Decimal(0)
    items: list[RecipeItemIn] = []


class ItemCostRead(ApiModel):
    position: int
    id: int | None
    item_type: RecipeItemType
    ref_id: int
    name: str
    quantity: Decimal
    unit: Unit
    waste_rate: Decimal
    gross_quantity: Decimal
    status: ItemStatus
    message: str | None
    base_unit: Unit | None
    base_quantity: Decimal | None
    unit_cost: Decimal | None
    reference_unit: Unit | None
    reference_unit_cost: Decimal | None
    cost: Decimal | None
    share: Decimal | None
    subrecipe: "RecipeCostRead | None"


class RecipeCostRead(ApiModel):
    recipe_id: int | None
    name: str
    yield_qty: Decimal
    yield_unit: Unit
    portions: Decimal
    safety_margin_rate: Decimal
    ingredients_cost: Decimal
    safety_margin_cost: Decimal
    total_cost: Decimal
    base_unit: Unit
    cost_per_base_unit: Decimal
    reference_unit: Unit
    cost_per_reference_unit: Decimal
    cost_per_portion: Decimal
    complete: bool
    items: list[ItemCostRead]


class RecipeUsage(ApiModel):
    id: int
    name: str
    category: str
    is_subrecipe: bool


class RecipeSummary(RecipeBase):
    id: int
    item_count: int
    total_cost: Decimal
    cost_per_portion: Decimal
    reference_unit: Unit
    cost_per_reference_unit: Decimal
    complete: bool
    updated_at: datetime


class RecipeDetail(RecipeBase):
    id: int
    items: list[RecipeItemRead]
    cost: RecipeCostRead
    used_in: list[RecipeUsage]
    created_at: datetime
    updated_at: datetime


class IngredientOption(ApiModel):
    item_type: RecipeItemType
    id: int
    name: str
    detail: str | None = Field(description="Brand for supplies; category for sub-recipes.")
    base_unit: Unit
    allowed_units: list[Unit]
    reference_unit: Unit
    reference_unit_cost: Decimal | None
    active: bool


class RecipeFacets(ApiModel):
    categories: list[str]
