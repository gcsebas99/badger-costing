from decimal import Decimal
from typing import Annotated

from pydantic import Field

from app.models.settings import CostMode
from app.schemas.common import ApiModel

Rate = Annotated[Decimal, Field(ge=0, le=1)]
PositiveRate = Annotated[Decimal, Field(gt=0, le=1)]
NegativeRate = Annotated[Decimal, Field(ge=-1, le=0)]


class SettingsRead(ApiModel):
    cost_mode: CostMode
    vat_rate: Decimal
    bank_fee_rate: Decimal
    margin_alert_rate: Decimal
    target_food_cost_rate: Decimal
    deviation_upper_rate: Decimal
    deviation_lower_rate: Decimal


class SettingsUpdate(ApiModel):
    cost_mode: CostMode | None = None
    vat_rate: Rate | None = None
    bank_fee_rate: Rate | None = None
    margin_alert_rate: Rate | None = None
    target_food_cost_rate: PositiveRate | None = None
    deviation_upper_rate: Rate | None = None
    deviation_lower_rate: NegativeRate | None = None
