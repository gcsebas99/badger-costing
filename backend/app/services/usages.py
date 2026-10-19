"""Where-used lookups: which recipes and products reference a supply or a recipe directly."""

from sqlmodel import Session, col, or_, select

from app.models.product import MenuGroup, Product, ProductItem
from app.models.recipe import Recipe, RecipeItem


def recipes_using_supply(session: Session, supply_id: int) -> list[Recipe]:
    return _distinct_recipes(session, col(RecipeItem.supply_id) == supply_id)


def recipes_using_recipe(session: Session, recipe_id: int) -> list[Recipe]:
    return _distinct_recipes(session, col(RecipeItem.subrecipe_id) == recipe_id)


def products_using_supply(session: Session, supply_id: int) -> list[tuple[Product, str]]:
    return _products(session, col(ProductItem.supply_id) == supply_id)


def products_using_recipe(session: Session, recipe_id: int) -> list[tuple[Product, str]]:
    return _products(
        session, col(ProductItem.subrecipe_id) == recipe_id, col(Product.recipe_id) == recipe_id
    )


def _distinct_recipes(session: Session, condition) -> list[Recipe]:
    query = (
        select(Recipe)
        .join(RecipeItem, col(RecipeItem.recipe_id) == Recipe.id)
        .where(condition)
        .distinct()
        .order_by(Recipe.name)
    )
    return list(session.exec(query).all())


def _products(
    session: Session, item_condition, product_condition=None
) -> list[tuple[Product, str]]:
    """Products matching the condition, with their menu group name."""
    query = (
        select(Product, MenuGroup.name)
        .join(MenuGroup, col(MenuGroup.id) == Product.menu_group_id)
        .outerjoin(ProductItem, col(ProductItem.product_id) == Product.id)
        .where(
            or_(item_condition, product_condition)
            if product_condition is not None
            else item_condition
        )
        .distinct()
        .order_by(Product.name)
    )
    return [(product, group) for product, group in session.exec(query).all()]
