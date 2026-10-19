from enum import StrEnum

from sqlmodel import Field, SQLModel

from app.models.types import value_enum


class CostMode(StrEnum):
    AVERAGE_LAST_3 = "average_last_3"  # average of the latest up-to-3 prices
    LATEST = "latest"


class AppSettings(SQLModel, table=True):
    """Single-row table (id = 1) with app-wide settings. Extended in M3 (VAT, fees, thresholds)."""

    __tablename__ = "app_settings"

    id: int | None = Field(default=1, primary_key=True)
    cost_mode: CostMode = Field(default=CostMode.AVERAGE_LAST_3, sa_type=value_enum(CostMode))
