from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer
from sqlmodel import Field, Relationship, SQLModel

from app.models.common import utcnow
from app.models.types import DecimalText, value_enum
from app.services.units import Unit

# Suggested categories (recipe manual sections). Categories are free text; these seed the dropdown.
DEFAULT_RECIPE_CATEGORIES = (
    "Bases",
    "Salsas",
    "Proteínas",
    "Panes",
    "Vegetales",
    "Hamburguesas",
    "Acompañamientos",
    "Bebidas",
    "Postres",
)


class RecipeItemType(StrEnum):
    SUPPLY = "supply"
    RECIPE = "recipe"


class Recipe(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    category: str = Field(index=True)
    is_subrecipe: bool = False
    # What one batch produces, e.g. 10 kg of dough or 12 pz of buns.
    yield_qty: Decimal = Field(sa_type=DecimalText)
    yield_unit: Unit = Field(sa_type=value_enum(Unit))
    portions: Decimal = Field(sa_type=DecimalText)
    # Extra over ingredient cost (template's "Margen de seguridad"), as a fraction: 0.05 = 5 %.
    safety_margin_rate: Decimal = Field(default=Decimal(0), sa_type=DecimalText)
    notes: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    # Not called `items`: SQLModel.model_validate would read dict.items from input dicts.
    ingredients: list["RecipeItem"] = Relationship(
        back_populates="recipe",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "order_by": "RecipeItem.position",
            "foreign_keys": "RecipeItem.recipe_id",
        },
    )


class RecipeItem(SQLModel, table=True):
    """One ingredient line: a supply or a sub-recipe, with net quantity and waste."""

    __tablename__ = "recipe_item"
    __table_args__ = (
        CheckConstraint(
            "(item_type = 'supply' AND supply_id IS NOT NULL AND subrecipe_id IS NULL) OR "
            "(item_type = 'recipe' AND subrecipe_id IS NOT NULL AND supply_id IS NULL)",
            name="ck_recipe_item_reference",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    recipe_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("recipe.id", ondelete="CASCADE"), index=True, nullable=False
        )
    )
    position: int = 0
    item_type: RecipeItemType = Field(sa_type=value_enum(RecipeItemType))
    # Deleting a supply/recipe that is still used must fail (RESTRICT), not silently drop lines.
    supply_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("supply.id", ondelete="RESTRICT"), index=True),
    )
    subrecipe_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("recipe.id", ondelete="RESTRICT"), index=True),
    )
    quantity: Decimal = Field(sa_type=DecimalText)  # net quantity
    unit: Unit = Field(sa_type=value_enum(Unit))
    waste_rate: Decimal = Field(default=Decimal(0), sa_type=DecimalText)  # 0.13 = 13 %

    recipe: Recipe = Relationship(
        back_populates="ingredients",
        sa_relationship_kwargs={"foreign_keys": "RecipeItem.recipe_id"},
    )
