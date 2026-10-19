from app.models.settings import CostMode
from app.schemas.common import ApiModel


class SettingsRead(ApiModel):
    cost_mode: CostMode


class SettingsUpdate(ApiModel):
    cost_mode: CostMode | None = None
