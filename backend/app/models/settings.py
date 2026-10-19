from decimal import Decimal
from enum import StrEnum

from sqlmodel import Field, SQLModel

from app.models.types import DecimalText, value_enum


class CostMode(StrEnum):
    AVERAGE_LAST_3 = "average_last_3"  # average of the latest up-to-3 prices
    LATEST = "latest"


def _rate(default: str, description: str):
    """A fraction setting (0.13 = 13 %) with a server default so existing rows migrate cleanly."""
    return Field(
        default=Decimal(default),
        sa_type=DecimalText,
        sa_column_kwargs={"server_default": default},
        description=description,
    )


class AppSettings(SQLModel, table=True):
    """Single-row table (id = 1) with app-wide settings."""

    __tablename__ = "app_settings"

    id: int | None = Field(default=1, primary_key=True)
    cost_mode: CostMode = Field(default=CostMode.AVERAGE_LAST_3, sa_type=value_enum(CostMode))
    vat_rate: Decimal = _rate("0.13", "IVA")
    bank_fee_rate: Decimal = _rate("0", "Bank/card fee on direct sales, % of PVP")
    margin_alert_rate: Decimal = _rate("0.4", "Alert when gross margin % falls below this")
    target_food_cost_rate: Decimal = _rate(
        "0.3", "Default target food cost % (per group overrides)"
    )
    deviation_upper_rate: Decimal = _rate("0.05", "Alert when cost is this much above theoretical")
    deviation_lower_rate: Decimal = _rate("-0.1", "Alert when cost is this much below theoretical")
