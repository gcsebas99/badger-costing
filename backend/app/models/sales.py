from datetime import date, datetime

from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field, Relationship, SQLModel

from app.models.common import utcnow


class SalesPeriod(SQLModel, table=True):
    """A period of recorded sales (e.g. "Octubre 2026") used for menu engineering."""

    __tablename__ = "sales_period"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    start_date: date
    end_date: date
    notes: str | None = None
    created_at: datetime = Field(default_factory=utcnow)

    entries: list["SalesEntry"] = Relationship(
        back_populates="period", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class SalesEntry(SQLModel, table=True):
    """Units of a product sold in a period on one channel (platform_id None = direct sale)."""

    __tablename__ = "sales_entry"

    id: int | None = Field(default=None, primary_key=True)
    period_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("sales_period.id", ondelete="CASCADE"), index=True, nullable=False
        )
    )
    # RESTRICT: sales history must not silently disappear; deactivate products instead.
    product_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("product.id", ondelete="RESTRICT"), index=True, nullable=False
        )
    )
    platform_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("sales_platform.id", ondelete="RESTRICT")),
    )
    units: int

    period: SalesPeriod = Relationship(back_populates="entries")
