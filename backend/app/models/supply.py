from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field, Relationship, SQLModel

from app.models.common import utcnow
from app.models.types import DecimalText, value_enum
from app.services.units import Unit

# Suggested groups (from the costing template). Groups are free text; these seed the dropdown.
DEFAULT_SUPPLY_GROUPS = (
    "Abarrotes",
    "Bebidas",
    "Carnes y pescados",
    "Desechables",
    "Frutas y verduras",
    "Lácteos y huevos",
    "Limpieza",
    "Otros",
    "Panadería",
    "Salsas y condimentos",
    "Secos y granos",
    "Vinos y licores",
)


class Supply(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    brand: str | None = None
    group: str = Field(index=True)
    supplier: str | None = Field(default=None, index=True)
    # A pack is what gets bought: e.g. 6 L, 1.36 kg, 24 pz. Price amounts are per pack.
    pack_qty: Decimal = Field(sa_type=DecimalText)
    pack_unit: Unit = Field(sa_type=value_enum(Unit))
    active: bool = True
    notes: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    prices: list["SupplyPrice"] = Relationship(
        back_populates="supply",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    equivalence: Optional["UnitEquivalence"] = Relationship(
        back_populates="supply",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "uselist": False},
    )


class SupplyPrice(SQLModel, table=True):
    __tablename__ = "supply_price"

    id: int | None = Field(default=None, primary_key=True)
    supply_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("supply.id", ondelete="CASCADE"), index=True, nullable=False
        )
    )
    amount: Decimal = Field(sa_type=DecimalText)  # ₡ per pack
    supplier: str | None = None
    purchased_on: date
    created_at: datetime = Field(default_factory=utcnow)

    supply: Supply = Relationship(back_populates="prices")


class UnitEquivalence(SQLModel, table=True):
    """1 pz of the supply = `quantity` `unit` (mass or volume), e.g. 1 egg = 50 g."""

    __tablename__ = "unit_equivalence"

    id: int | None = Field(default=None, primary_key=True)
    supply_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("supply.id", ondelete="CASCADE"), unique=True, nullable=False
        )
    )
    quantity: Decimal = Field(sa_type=DecimalText)
    unit: Unit = Field(sa_type=value_enum(Unit))

    supply: Supply = Relationship(back_populates="equivalence")
