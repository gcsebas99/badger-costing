"""SQLModel table models. Import every model module here so Alembic sees its metadata."""

from sqlmodel import SQLModel

from app.models.product import (
    MenuGroup,
    Product,
    ProductItem,
    ProductItemRole,
    ProductPlatformPrice,
    SalesPlatform,
)
from app.models.recipe import Recipe, RecipeItem, RecipeItemType, RecipeStep
from app.models.sales import SalesEntry, SalesPeriod
from app.models.settings import AppSettings, CostMode
from app.models.supply import Supply, SupplyPrice, UnitEquivalence

__all__ = [
    "AppSettings",
    "CostMode",
    "MenuGroup",
    "Product",
    "ProductItem",
    "ProductItemRole",
    "ProductPlatformPrice",
    "Recipe",
    "RecipeItem",
    "RecipeItemType",
    "RecipeStep",
    "SQLModel",
    "SalesEntry",
    "SalesPeriod",
    "SalesPlatform",
    "Supply",
    "SupplyPrice",
    "UnitEquivalence",
]
