from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import BeforeValidator, Field, model_validator

from app.models.recipe import RecipeItemType
from app.schemas.common import (
    ApiModel,
    DecimalOut,
    LongOptionalText,
    PositiveDecimal,
    RequiredText,
)
from app.services.costing import ItemStatus
from app.services.units import Unit

WasteRate = Annotated[DecimalOut, Field(ge=0, le=10, description="0.13 = 13 %")]
MarginRate = Annotated[DecimalOut, Field(ge=0, le=1, description="0.05 = 5 %")]


def _drop_blank_steps(value: object) -> object:
    if isinstance(value, list):
        return [v for v in value if not (isinstance(v, str) and not v.strip())]
    return value


# Preparation steps in order; blank entries (an empty row left in the editor) are dropped.
Steps = Annotated[
    list[Annotated[str, Field(min_length=1, max_length=1000)]],
    BeforeValidator(_drop_blank_steps),
]


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
    quantity: DecimalOut
    unit: Unit
    waste_rate: DecimalOut


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
    steps: Steps = []


class RecipeUpdate(ApiModel):
    """Partial update. `items` / `steps`, when sent, replace all ingredient lines / steps."""

    name: RequiredText | None = None
    category: RequiredText | None = None
    is_subrecipe: bool | None = None
    yield_qty: PositiveDecimal | None = None
    yield_unit: Unit | None = None
    portions: PositiveDecimal | None = None
    safety_margin_rate: MarginRate | None = None
    notes: LongOptionalText = None
    items: list[RecipeItemIn] | None = None
    steps: Steps | None = None

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
            "steps",
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
    quantity: DecimalOut
    unit: Unit
    waste_rate: DecimalOut
    gross_quantity: DecimalOut
    status: ItemStatus
    message: str | None
    base_unit: Unit | None
    base_quantity: DecimalOut | None
    unit_cost: DecimalOut | None
    reference_unit: Unit | None
    reference_unit_cost: DecimalOut | None
    cost: DecimalOut | None
    share: DecimalOut | None
    subrecipe: "RecipeCostRead | None"


class RecipeCostRead(ApiModel):
    recipe_id: int | None
    name: str
    yield_qty: DecimalOut
    yield_unit: Unit
    portions: DecimalOut
    safety_margin_rate: DecimalOut
    ingredients_cost: DecimalOut
    safety_margin_cost: DecimalOut
    total_cost: DecimalOut
    base_unit: Unit
    cost_per_base_unit: DecimalOut
    reference_unit: Unit
    cost_per_reference_unit: DecimalOut
    cost_per_portion: DecimalOut
    complete: bool
    items: list[ItemCostRead]


class RecipeUsage(ApiModel):
    """Where something is used: a recipe or a sale product."""

    kind: Literal["recipe", "product"] = "recipe"
    id: int
    name: str
    category: str = Field(description="Recipe category, or menu group for products.")
    is_subrecipe: bool = False


class RecipeSummary(RecipeBase):
    id: int
    item_count: int
    total_cost: DecimalOut
    cost_per_portion: DecimalOut
    reference_unit: Unit
    cost_per_reference_unit: DecimalOut
    complete: bool
    updated_at: datetime


class RecipeDetail(RecipeBase):
    id: int
    items: list[RecipeItemRead]
    steps: list[str]
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
    reference_unit_cost: DecimalOut | None
    active: bool


class RecipeFacets(ApiModel):
    categories: list[str]


class RecipeScaledRead(ApiModel):
    """A saved recipe scaled by `factor` (nothing is stored). Costs are for the scaled batch."""

    factor: DecimalOut
    anchor_item_id: int | None = Field(description="Line the factor was derived from, if any.")
    cost: RecipeCostRead
