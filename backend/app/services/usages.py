"""Where-used lookups: which recipes reference a supply or a sub-recipe directly."""

from sqlmodel import Session, col, select

from app.models.recipe import Recipe, RecipeItem


def recipes_using_supply(session: Session, supply_id: int) -> list[Recipe]:
    return _distinct_recipes(session, col(RecipeItem.supply_id) == supply_id)


def recipes_using_recipe(session: Session, recipe_id: int) -> list[Recipe]:
    return _distinct_recipes(session, col(RecipeItem.subrecipe_id) == recipe_id)


def _distinct_recipes(session: Session, condition) -> list[Recipe]:
    query = (
        select(Recipe)
        .join(RecipeItem, col(RecipeItem.recipe_id) == Recipe.id)
        .where(condition)
        .distinct()
        .order_by(Recipe.name)
    )
    return list(session.exec(query).all())
