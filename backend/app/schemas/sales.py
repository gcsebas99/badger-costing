from datetime import date, datetime
from typing import Annotated, Self

from pydantic import Field, model_validator

from app.schemas.common import ApiModel, DecimalOut, LongOptionalText, RequiredText
from app.services.menu_engineering import MenuClass


class SalesPeriodIn(ApiModel):
    name: RequiredText
    start_date: date
    end_date: date
    notes: LongOptionalText = None

    @model_validator(mode="after")
    def dates_in_order(self) -> Self:
        if self.end_date < self.start_date:
            raise ValueError("La fecha final debe ser igual o posterior a la inicial.")
        return self


class SalesPeriodUpdate(ApiModel):
    name: RequiredText | None = None
    start_date: date | None = None
    end_date: date | None = None
    notes: LongOptionalText = None


class SalesPeriodRead(ApiModel):
    id: int
    name: str
    start_date: date
    end_date: date
    notes: str | None
    created_at: datetime
    total_units: int
    product_count: int


class SalesEntryIn(ApiModel):
    product_id: int
    platform_id: int | None = Field(default=None, description="None = venta directa")
    units: Annotated[int, Field(ge=0)]


class SalesEntriesIn(ApiModel):
    entries: list[SalesEntryIn]


class SalesEntryRead(ApiModel):
    product_id: int
    platform_id: int | None
    units: int


class SalesPeriodDetail(SalesPeriodRead):
    entries: list[SalesEntryRead]


class SalesCsvIn(ApiModel):
    content: str = Field(description="Raw CSV text (the frontend reads the file).")
    replace: bool = Field(default=True, description="Replace existing values for the same rows.")


class SalesImportResult(ApiModel):
    imported_rows: int
    unmatched_products: list[str]
    unmatched_channels: list[str]
    invalid_rows: list[int]


class MenuItemRead(ApiModel):
    product_id: int
    name: str
    units: int
    popularity: DecimalOut
    high_popularity: bool
    unit_margin: DecimalOut | None
    total_margin: DecimalOut | None
    high_margin: bool | None
    classification: MenuClass | None
    unpriced_units: int


class MenuGroupAnalysisRead(ApiModel):
    menu_group_id: int
    menu_group_name: str
    item_count: int
    total_units: int
    popularity_threshold: DecimalOut
    total_margin: DecimalOut
    average_margin: DecimalOut | None
    items: list[MenuItemRead]
