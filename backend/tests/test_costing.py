"""Costing engine tests.

Reference values come from the sample "Plantilla Costeo.xlsx" (Masa de pizza, Salsa Pomodoro,
Pizza margarita). The template costs with NET quantity; we cost with GROSS quantity
(net × (1 + waste)), so recipes with waste differ from the spreadsheet by exactly that waste.
"""

from datetime import date
from decimal import Decimal

import pytest

from app.models import CostMode, SupplyPrice
from app.services.costing import CostingContext, CycleError, ItemStatus
from tests.factories import item, make_recipe, make_supply

D = Decimal


def approx(value: Decimal | None, expected: float | str | Decimal, places: int = 8) -> bool:
    assert value is not None
    return round(value, places) == round(D(str(expected)), places)


@pytest.fixture
def pizza(session):
    s = {
        "harina": make_supply(session, "Harina de trigo de fuerza", "5", "kg", "11"),
        "agua": make_supply(session, "Agua de la llave", "1", "L", "3"),
        "sal": make_supply(session, "Sal fina", "5", "kg", "102.2"),
        "levadura": make_supply(session, "Levadura fresca", "0.454", "kg", "39.99"),
        "aceite": make_supply(session, "Aceite de oliva suave", "6", "L", "1300"),
        "tomate": make_supply(session, "Tomate triturado", "4", "kg", "141"),
        "ajo": make_supply(session, "Ajo cabeza", "1", "kg", "374.7"),
        "azucar": make_supply(session, "Azúcar blanco", "5", "kg", "21.2"),
        "albahaca": make_supply(session, "Albahaca fresca", "1", "kg", "354"),
        "oregano": make_supply(session, "Orégano seco", "0.454", "kg", "89.97"),
        "pimienta": make_supply(session, "Pimienta negra", "0.454", "kg", "211"),
        "mozzarella": make_supply(session, "Queso mozarella fresco", "1.36", "kg", "331.12"),
        "parmesano": make_supply(session, "Queso parmesano", "1", "kg", "496.87"),
        "aceite_ve": make_supply(session, "Aceite de oliva virgen extra", "1", "L", "403.2"),
        "caja": make_supply(session, "Caja para pizza 30cm", "500", "pz", "1802.65"),
        "servilleta": make_supply(session, "Servilleta kraft", "10000", "pz", "365.37"),
        "liner": make_supply(session, "Liner brandeado", "5000", "pz", "2498.22"),
        "sticker": make_supply(session, "Sticker logo", "500", "pz", "256.25"),
    }
    masa = make_recipe(
        session,
        "Masa de pizza",
        "10",
        "kg",
        portions="40",
        safety_margin="0.05",
        is_subrecipe=True,
        items=[
            item(s["harina"], "6.2", "kg"),
            item(s["agua"], "3.7", "L"),
            item(s["sal"], "0.12", "kg"),
            item(s["levadura"], "0.03", "kg"),
            item(s["aceite"], "0.12", "L"),
        ],
    )
    pomodoro = make_recipe(
        session,
        "Salsa pomodoro",
        "5",
        "kg",
        portions="62.5",
        safety_margin="0.05",
        is_subrecipe=True,
        items=[
            item(s["tomate"], "4.5", "kg"),
            item(s["aceite"], "0.15", "L"),
            item(s["ajo"], "0.025", "kg", waste="0.13"),
            item(s["sal"], "0.03", "kg"),
            item(s["azucar"], "0.015", "kg"),
            item(s["albahaca"], "0.015", "kg"),
            item(s["oregano"], "0.01", "kg"),
            item(s["pimienta"], "0.05", "kg"),
        ],
    )
    margarita = make_recipe(
        session,
        "Pizza margarita",
        "0.473",
        "kg",
        portions="1",
        safety_margin="0.05",
        category="Pizzas",
        items=[
            item(masa, "0.25", "kg"),
            item(pomodoro, "0.08", "kg"),
            item(s["mozzarella"], "0.1", "kg"),
            item(s["albahaca"], "0.005", "kg"),
            item(s["parmesano"], "0.01", "kg"),
            item(s["aceite_ve"], "0.01", "L"),
            item(s["caja"], "1", "pz"),
            item(s["servilleta"], "4", "pz"),
            item(s["liner"], "1", "pz"),
            item(s["sticker"], "1", "pz"),
        ],
    )
    return {"supplies": s, "masa": masa, "pomodoro": pomodoro, "margarita": margarita}


def context(session, mode=CostMode.AVERAGE_LAST_3):
    return CostingContext.load(session, mode)


# --- Template reference cases -------------------------------------------------------------


def test_masa_de_pizza_matches_template_exactly(session, pizza):
    cost = context(session).recipe_cost(pizza["masa"].id)

    assert approx(cost.ingredients_cost, 55.83531101321586)
    assert approx(cost.safety_margin_cost, 2.7917655506607932)
    assert approx(cost.total_cost, 58.62707656387665)
    assert approx(cost.cost_per_reference_unit, 5.862707656387665)  # ₡ per kg
    assert approx(cost.cost_per_portion, 1.4656769140969161)
    assert cost.complete


def test_salsa_pomodoro_costs_waste_on_gross_quantity(session, pizza):
    cost = context(session).recipe_cost(pizza["pomodoro"].id)

    garlic = cost.items[2]
    assert garlic.gross_quantity == D("0.02825")
    assert approx(garlic.cost, D("0.02825") * D("374.7"))

    # Template (net quantities): 231.69890352422908. Gross adds 0.025 × 0.13 × 374.7.
    expected_ingredients = D("231.69890352422908") + D("0.025") * D("0.13") * D("374.7")
    assert approx(cost.ingredients_cost, expected_ingredients)
    assert approx(cost.total_cost, expected_ingredients * D("1.05"))


def test_pizza_margarita_uses_both_subrecipes(session, pizza):
    cost = context(session).recipe_cost(pizza["margarita"].id)

    # Template total 47.501547782675054, plus the pomodoro waste difference flowing through
    # 0.08 kg of sauce and the pizza's own 5 % margin.
    pomodoro_delta_per_kg = D("0.025") * D("0.13") * D("374.7") * D("1.05") / D("5")
    expected = D("47.501547782675054") + D("0.08") * pomodoro_delta_per_kg * D("1.05")
    assert approx(cost.total_cost, expected)
    assert approx(cost.cost_per_reference_unit, expected / D("0.473"))
    assert cost.complete

    masa_line = cost.items[0]
    assert masa_line.item_type == "recipe"
    assert approx(masa_line.cost, D("0.25") * D("5.862707656387665"))
    assert masa_line.subrecipe is not None
    assert masa_line.subrecipe.name == "Masa de pizza"


def test_breakdown_shares_add_up(session, pizza):
    cost = context(session).recipe_cost(pizza["margarita"].id)
    assert approx(sum(line.cost for line in cost.items), cost.ingredients_cost)
    assert approx(sum(line.share for line in cost.items), 1)


# --- Three-level chain: homemade mayo → chipotle mayo → burger -----------------------------


@pytest.fixture
def chain(session):
    egg = make_supply(session, "Huevo", "30", "pz", "2850", equivalence=("50", "g"))
    oil = make_supply(session, "Aceite vegetal", "1", "L", "1500")
    lemon = make_supply(session, "Limón", "1", "kg", "1000")
    chipotle = make_supply(session, "Chipotle en lata", "200", "g", "900")
    bun = make_supply(session, "Pan brioche", "8", "pz", "1600")
    beef = make_supply(session, "Carne molida", "1", "kg", "6000")

    mayo = make_recipe(
        session,
        "Mayo casera",
        "600",
        "g",
        portions="20",
        is_subrecipe=True,
        items=[item(egg, "3", "pz"), item(oil, "0.5", "L"), item(lemon, "30", "g", waste="0.5")],
    )
    chipotle_mayo = make_recipe(
        session,
        "Mayo chipotle",
        "350",
        "g",
        portions="10",
        is_subrecipe=True,
        items=[item(mayo, "300", "g"), item(chipotle, "50", "g")],
    )
    burger = make_recipe(
        session,
        "Hamburguesa chipotle",
        "1",
        "pz",
        category="Hamburguesas",
        items=[
            item(bun, "1", "pz"),
            item(beef, "150", "g", waste="0.1"),
            item(chipotle_mayo, "30", "g"),
        ],
    )
    return {"egg": egg, "mayo": mayo, "chipotle_mayo": chipotle_mayo, "burger": burger}


def test_three_level_chain(session, chain):
    ctx = context(session)
    mayo = ctx.recipe_cost(chain["mayo"].id)
    chipotle_mayo = ctx.recipe_cost(chain["chipotle_mayo"].id)
    burger = ctx.recipe_cost(chain["burger"].id)

    # 3 eggs × ₡95 + 0.5 L × ₡1500 + 45 g lemon (30 g + 50 % waste) × ₡1/g
    assert mayo.total_cost == D("1080")
    assert mayo.cost_per_base_unit == D("1.8")  # ₡ per g
    assert mayo.cost_per_reference_unit == D("1800")  # ₡ per kg
    assert mayo.cost_per_portion == D("54")
    # 300 g mayo × 1.8 + 50 g chipotle × 4.5
    assert chipotle_mayo.total_cost == D("765")
    # bun 200 + 165 g beef × 6 + 30 g chipotle mayo × (765 / 350)
    assert approx(burger.total_cost, D("200") + D("990") + D("30") * D("765") / D("350"))
    assert burger.reference_unit == "pz"


def test_egg_price_change_flows_through_the_chain(session, chain):
    before = context(session, CostMode.LATEST)
    mayo_before = before.recipe_cost(chain["mayo"].id).total_cost
    chipotle_before = before.recipe_cost(chain["chipotle_mayo"].id).total_cost
    burger_before = before.recipe_cost(chain["burger"].id).total_cost

    egg = chain["egg"]
    egg.prices.append(SupplyPrice(amount=D("3300"), purchased_on=date(2026, 10, 10)))
    session.add(egg)
    session.commit()

    after = context(session, CostMode.LATEST)
    # 3 eggs now cost ₡110 each instead of ₡95: +₡45 in the mayo
    assert after.recipe_cost(chain["mayo"].id).total_cost == mayo_before + D("45")
    assert after.recipe_cost(chain["chipotle_mayo"].id).total_cost > chipotle_before
    assert after.recipe_cost(chain["burger"].id).total_cost > burger_before


def test_supply_used_in_grams_via_piece_equivalence(session, chain):
    recipe = make_recipe(session, "Tortilla", "1", "pz", items=[item(chain["egg"], "100", "g")])
    line = context(session).recipe_cost(recipe.id).items[0]
    assert line.status == ItemStatus.OK
    assert line.cost == D("190")  # 100 g = 2 eggs × ₡95


# --- Errors and incomplete data ------------------------------------------------------------


def test_missing_price_marks_recipe_incomplete_but_keeps_other_costs(session):
    salt = make_supply(session, "Sal", "1", "kg", "1000")
    pepper = make_supply(session, "Pimienta", "1", "kg")  # no price
    recipe = make_recipe(
        session, "Sazonador", "1", "kg", items=[item(salt, "100", "g"), item(pepper, "50", "g")]
    )
    cost = context(session).recipe_cost(recipe.id)

    assert not cost.complete
    assert cost.items[1].status == ItemStatus.MISSING_PRICE
    assert cost.items[1].cost is None
    assert cost.total_cost == D("100")


def test_missing_equivalence_is_a_clear_item_error(session):
    egg = make_supply(session, "Huevo sin equivalencia", "30", "pz", "2850")
    recipe = make_recipe(session, "Mezcla", "1", "kg", items=[item(egg, "100", "g")])
    line = context(session).recipe_cost(recipe.id).items[0]

    assert line.status == ItemStatus.CONVERSION_ERROR
    assert "equivalencia" in line.message
    assert line.cost is None


def test_subrecipe_used_in_incompatible_unit(session, chain):
    recipe = make_recipe(session, "Aderezo", "1", "L", items=[item(chain["mayo"], "100", "ml")])
    line = context(session).recipe_cost(recipe.id).items[0]
    assert line.status == ItemStatus.CONVERSION_ERROR


def test_incomplete_subrecipe_propagates(session):
    unpriced = make_supply(session, "Sin precio", "1", "kg")
    sub = make_recipe(
        session, "Sub", "1", "kg", is_subrecipe=True, items=[item(unpriced, "1", "kg")]
    )
    parent = make_recipe(session, "Padre", "1", "kg", items=[item(sub, "500", "g")])
    cost = context(session).recipe_cost(parent.id)

    assert not cost.complete
    assert cost.items[0].status == ItemStatus.INCOMPLETE_SUBRECIPE


def test_recipe_without_items_costs_zero(session):
    recipe = make_recipe(session, "Vacía", "1", "kg", items=[])
    cost = context(session).recipe_cost(recipe.id)
    assert cost.total_cost == D(0)
    assert cost.complete


# --- Cycles --------------------------------------------------------------------------------


def test_cycle_is_detected_before_saving(session, chain):
    ctx = context(session)
    mayo_spec = ctx.spec_for(chain["mayo"].id)
    # Put the chipotle mayo inside the homemade mayo: mayo → chipotle mayo → mayo
    mayo_spec.items.append(ctx.item_spec_for_recipe(chain["chipotle_mayo"].id, "10", "g"))

    with pytest.raises(CycleError) as error:
        ctx.check_no_cycle(mayo_spec)
    assert "Mayo casera" in str(error.value)
    assert "Mayo chipotle" in str(error.value)


def test_self_reference_is_a_cycle(session, chain):
    ctx = context(session)
    spec = ctx.spec_for(chain["mayo"].id)
    spec.items.append(ctx.item_spec_for_recipe(chain["mayo"].id, "10", "g"))
    with pytest.raises(CycleError):
        ctx.check_no_cycle(spec)


def test_draft_cost_preview_uses_unsaved_changes(session, chain):
    ctx = context(session)
    spec = ctx.spec_for(chain["chipotle_mayo"].id)
    spec.items[1].quantity = D("100")  # double the chipotle
    preview = ctx.draft_cost(spec)
    assert preview.total_cost == D("540") + D("450")
    # The saved recipe is unchanged
    assert context(session).recipe_cost(chain["chipotle_mayo"].id).total_cost == D("765")
