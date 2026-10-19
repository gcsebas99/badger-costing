"""Small builders for supplies and recipes in tests."""

from datetime import date
from decimal import Decimal

from sqlmodel import Session

from app.models import Recipe, RecipeItem, RecipeItemType, Supply, SupplyPrice, UnitEquivalence
from app.services.units import Unit


def make_supply(
    session: Session,
    name: str,
    pack_qty: str,
    pack_unit: str,
    price: str | None = None,
    equivalence: tuple[str, str] | None = None,
    group: str = "Otros",
) -> Supply:
    supply = Supply(name=name, group=group, pack_qty=Decimal(pack_qty), pack_unit=Unit(pack_unit))
    if price is not None:
        supply.prices = [SupplyPrice(amount=Decimal(price), purchased_on=date(2026, 10, 1))]
    if equivalence is not None:
        supply.equivalence = UnitEquivalence(
            quantity=Decimal(equivalence[0]), unit=Unit(equivalence[1])
        )
    session.add(supply)
    session.commit()
    session.refresh(supply)
    return supply


def item(ref: Supply | Recipe, quantity: str, unit: str, waste: str = "0") -> RecipeItem:
    if isinstance(ref, Supply):
        return RecipeItem(
            item_type=RecipeItemType.SUPPLY,
            supply_id=ref.id,
            quantity=Decimal(quantity),
            unit=Unit(unit),
            waste_rate=Decimal(waste),
        )
    return RecipeItem(
        item_type=RecipeItemType.RECIPE,
        subrecipe_id=ref.id,
        quantity=Decimal(quantity),
        unit=Unit(unit),
        waste_rate=Decimal(waste),
    )


def make_recipe(
    session: Session,
    name: str,
    yield_qty: str,
    yield_unit: str,
    items: list[RecipeItem],
    portions: str = "1",
    safety_margin: str = "0",
    is_subrecipe: bool = False,
    category: str = "Bases",
) -> Recipe:
    for position, line in enumerate(items):
        line.position = position
    recipe = Recipe(
        name=name,
        category=category,
        is_subrecipe=is_subrecipe,
        yield_qty=Decimal(yield_qty),
        yield_unit=Unit(yield_unit),
        portions=Decimal(portions),
        safety_margin_rate=Decimal(safety_margin),
        ingredients=items,
    )
    session.add(recipe)
    session.commit()
    session.refresh(recipe)
    return recipe
