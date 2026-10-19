from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

from app.models.common import utcnow
from app.models.recipe import RecipeItemType
from app.models.types import DecimalText, value_enum
from app.services.units import Unit


class SalesPlatform(SQLModel, table=True):
    """Delivery platform (Uber Eats, Rappi, DiDi Food…) with its commission."""

    __tablename__ = "sales_platform"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    fee_rate: Decimal = Field(sa_type=DecimalText)  # 0.30 = 30 % of PVP
    active: bool = True


class MenuGroup(SQLModel, table=True):
    """Menu section (Hamburguesas, Bebidas, Acompañamientos…) with an optional food cost target."""

    __tablename__ = "menu_group"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    position: int = 0
    # None → use AppSettings.target_food_cost_rate
    target_food_cost_rate: Decimal | None = Field(default=None, sa_type=DecimalText)


class ProductItemRole(StrEnum):
    ITEM = "item"  # direct component (extra cheese, a soda can, a sauce cup)
    PACKAGING = "packaging"


class Product(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    menu_group_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("menu_group.id", ondelete="RESTRICT"), index=True, nullable=False
        )
    )
    # Optional main recipe; the product uses `recipe_portions` portions of it.
    recipe_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("recipe.id", ondelete="RESTRICT"), index=True),
    )
    recipe_portions: Decimal = Field(default=Decimal(1), sa_type=DecimalText)
    # PVP (VAT included) for direct sale; None = not sold directly.
    direct_price: Decimal | None = Field(default=None, sa_type=DecimalText)
    # "Costo teórico objetivo": the cost this product is expected to have.
    target_cost: Decimal | None = Field(default=None, sa_type=DecimalText)
    active: bool = True
    notes: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    components: list["ProductItem"] = Relationship(
        back_populates="product",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "order_by": "ProductItem.position",
        },
    )
    platform_prices: list["ProductPlatformPrice"] = Relationship(
        back_populates="product", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class ProductItem(SQLModel, table=True):
    """Direct component or packaging line of a product (same shape as a recipe line)."""

    __tablename__ = "product_item"
    __table_args__ = (
        CheckConstraint(
            "(item_type = 'supply' AND supply_id IS NOT NULL AND subrecipe_id IS NULL) OR "
            "(item_type = 'recipe' AND subrecipe_id IS NOT NULL AND supply_id IS NULL)",
            name="ck_product_item_reference",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    product_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("product.id", ondelete="CASCADE"), index=True, nullable=False
        )
    )
    role: ProductItemRole = Field(sa_type=value_enum(ProductItemRole))
    position: int = 0
    item_type: RecipeItemType = Field(sa_type=value_enum(RecipeItemType))
    supply_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("supply.id", ondelete="RESTRICT"), index=True),
    )
    subrecipe_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("recipe.id", ondelete="RESTRICT"), index=True),
    )
    quantity: Decimal = Field(sa_type=DecimalText)
    unit: Unit = Field(sa_type=value_enum(Unit))
    waste_rate: Decimal = Field(default=Decimal(0), sa_type=DecimalText)

    product: Product = Relationship(back_populates="components")


class ProductPlatformPrice(SQLModel, table=True):
    """PVP (VAT included) of a product on a delivery platform."""

    __tablename__ = "product_platform_price"
    __table_args__ = (UniqueConstraint("product_id", "platform_id"),)

    id: int | None = Field(default=None, primary_key=True)
    product_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("product.id", ondelete="CASCADE"), index=True, nullable=False
        )
    )
    platform_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("sales_platform.id", ondelete="CASCADE"), nullable=False
        )
    )
    price: Decimal = Field(sa_type=DecimalText)

    product: Product = Relationship(back_populates="platform_prices")
