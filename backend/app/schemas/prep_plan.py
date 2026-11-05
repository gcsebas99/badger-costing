from typing import Annotated

from pydantic import Field

from app.schemas.common import ApiModel, DecimalOut, OptionalText
from app.services.units import Unit

PlanQuantity = Annotated[int, Field(ge=0, le=100_000)]
BufferRate = Annotated[DecimalOut, Field(ge=0, le=1, description="0.10 = 10 %")]


class PrepPlanItemIn(ApiModel):
    product_id: int
    target_qty: PlanQuantity
    extra_qty: PlanQuantity = 0


class PrepPlanIn(ApiModel):
    buffer_rate: BufferRate = 0
    items: list[PrepPlanItemIn]


class PrepPlanExportIn(PrepPlanIn):
    name: OptionalText = None


class PlannedRecipeRead(ApiModel):
    recipe_id: int
    name: str
    category: str
    is_subrecipe: bool
    batches: DecimalOut
    yield_qty: DecimalOut
    yield_unit: Unit
    portions: DecimalOut
    buffered: bool


class PlannedSupplyRead(ApiModel):
    supply_id: int
    name: str
    group: str
    quantity: DecimalOut
    unit: Unit
    buffered: bool


class PrepPlanRead(ApiModel):
    recipes: list[PlannedRecipeRead]
    supplies: list[PlannedSupplyRead]
    warnings: list[str]
