from typing import Annotated

from pydantic import Field

from app.models.settings import CostMode
from app.schemas.common import ApiModel, DecimalOut

Rate = Annotated[DecimalOut, Field(ge=0, le=1)]
PositiveRate = Annotated[DecimalOut, Field(gt=0, le=1)]
NegativeRate = Annotated[DecimalOut, Field(ge=-1, le=0)]


class SettingsRead(ApiModel):
    cost_mode: CostMode
    vat_rate: DecimalOut
    bank_fee_rate: DecimalOut
    margin_alert_rate: DecimalOut
    target_food_cost_rate: DecimalOut
    deviation_upper_rate: DecimalOut
    deviation_lower_rate: DecimalOut


class SettingsUpdate(ApiModel):
    cost_mode: CostMode | None = None
    vat_rate: Rate | None = None
    bank_fee_rate: Rate | None = None
    margin_alert_rate: Rate | None = None
    target_food_cost_rate: PositiveRate | None = None
    deviation_upper_rate: Rate | None = None
    deviation_lower_rate: NegativeRate | None = None
