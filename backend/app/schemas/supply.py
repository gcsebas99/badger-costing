from datetime import date, datetime
from decimal import Decimal
from typing import Self

from pydantic import Field, field_validator, model_validator

from app.schemas.common import (
    ApiModel,
    NonNegativeDecimal,
    OptionalText,
    PositiveDecimal,
    RequiredText,
)
from app.services.units import Unit, UnitFamily, family


class EquivalenceIn(ApiModel):
    """1 pz = quantity unit (unit must be mass or volume)."""

    quantity: PositiveDecimal
    unit: Unit

    @field_validator("unit")
    @classmethod
    def unit_is_mass_or_volume(cls, unit: Unit) -> Unit:
        if family(unit) == UnitFamily.COUNT:
            raise ValueError("La equivalencia debe expresarse en peso o volumen.")
        return unit


class EquivalenceRead(ApiModel):
    quantity: Decimal
    unit: Unit


class PriceCreate(ApiModel):
    amount: NonNegativeDecimal
    purchased_on: date = Field(default_factory=date.today)
    supplier: OptionalText = None


class PriceRead(ApiModel):
    id: int
    amount: Decimal
    supplier: str | None
    purchased_on: date
    created_at: datetime
    in_effect: bool = Field(description="Whether this price is part of the current cost.")


class SupplyBase(ApiModel):
    name: RequiredText
    brand: OptionalText = None
    group: RequiredText
    supplier: OptionalText = None
    pack_qty: PositiveDecimal
    pack_unit: Unit
    active: bool = True
    notes: OptionalText = None


class SupplyCreate(SupplyBase):
    equivalence: EquivalenceIn | None = None
    initial_price: PriceCreate | None = None


class SupplyUpdate(ApiModel):
    """Partial update. Sending `equivalence: null` removes the equivalence."""

    name: RequiredText | None = None
    brand: OptionalText = None
    group: RequiredText | None = None
    supplier: OptionalText = None
    pack_qty: PositiveDecimal | None = None
    pack_unit: Unit | None = None
    active: bool | None = None
    notes: OptionalText = None
    equivalence: EquivalenceIn | None = None

    @model_validator(mode="after")
    def required_fields_not_null(self) -> Self:
        for field in ("name", "group", "pack_qty", "pack_unit", "active"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"El campo '{field}' no puede ser nulo.")
        return self


class SupplyRead(SupplyBase):
    id: int
    equivalence: EquivalenceRead | None
    base_unit: Unit
    current_price: Decimal | None = Field(description="Current ₡ per pack.")
    unit_cost: Decimal | None = Field(description="₡ per base unit (g, ml or pz).")
    reference_unit: Unit
    reference_unit_cost: Decimal | None = Field(description="₡ per kg, L or pz.")
    last_price_date: date | None
    price_count: int
    created_at: datetime
    updated_at: datetime


class SupplyDetail(SupplyRead):
    prices: list[PriceRead]


class SupplyFacets(ApiModel):
    groups: list[str]
    suppliers: list[str]
