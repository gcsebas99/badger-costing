from decimal import Decimal

import pytest
from sqlmodel import Session

from app.models.product import MenuGroup, Product, ProductItem, ProductItemRole
from app.models.recipe import RecipeItemType
from app.models.settings import CostMode
from app.services.costing import CostingContext
from app.services.prep_plan import PlanLine, PrepPlanError, build_prep_plan
from app.services.product_cost import product_cost, spec_from_product
from app.services.units import Unit
from tests.factories import item, make_recipe, make_supply

D = Decimal


def product_line(
    ref, quantity: str, unit: str, role=ProductItemRole.ITEM, waste="0"
) -> ProductItem:
    is_supply = hasattr(ref, "pack_qty")
    return ProductItem(
        role=role,
        item_type=RecipeItemType.SUPPLY if is_supply else RecipeItemType.RECIPE,
        supply_id=ref.id if is_supply else None,
        subrecipe_id=None if is_supply else ref.id,
        quantity=D(quantity),
        unit=Unit(unit),
        waste_rate=D(waste),
    )


def make_product(
    session: Session, name="Combo", recipe=None, portions="1", lines=(), active=True
) -> Product:
    group = MenuGroup(name=f"Grupo {name}")
    session.add(group)
    session.commit()
    product = Product(
        name=name,
        menu_group_id=group.id,
        recipe_id=recipe.id if recipe else None,
        recipe_portions=D(portions),
        active=active,
        components=list(lines),
    )
    session.add(product)
    session.commit()
    session.refresh(product)
    return product


@pytest.fixture
def combo(session: Session) -> dict:
    """Shaped like the real menu: sub-recipes on the burger, side + sauce on the combo."""
    meat = make_supply(session, "Carne", "1", "kg", "8000", group="Carnes y pescados")
    arugula = make_supply(session, "Arugula", "100", "g", "1000", group="Frutas y verduras")
    egg = make_supply(session, "Huevo", "30", "pz", "3000", group="Lácteos y huevos")
    onion = make_supply(session, "Cebolla", "1", "kg", "1000", group="Frutas y verduras")
    potato = make_supply(session, "Papa", "1", "kg", "1500", group="Frutas y verduras")
    box = make_supply(session, "Caja", "50", "pz", "5000", group="Desechables")
    drink = make_supply(session, "Bebida", "24", "pz", "12000", group="Bebidas")

    patty = make_recipe(
        session,
        "Torta",
        "1",
        "pz",
        [item(meat, "150", "g")],
        is_subrecipe=True,
        category="Proteínas",
    )
    bun = make_recipe(
        session,
        "Pan",
        "10",
        "pz",
        [item(onion, "100", "g"), item(egg, "2", "pz")],
        is_subrecipe=True,
        category="Panes",
    )
    sauce = make_recipe(
        session,
        "Mermelada",
        "320",
        "g",
        [item(onion, "400", "g")],
        is_subrecipe=True,
        category="Salsas",
    )
    fries = make_recipe(
        session,
        "Papas",
        "1",
        "pz",
        [item(potato, "200", "g", waste="0.1")],
        is_subrecipe=True,
        category="Acompañamientos",
    )
    burger = make_recipe(
        session,
        "Hamburguesa",
        "1",
        "pz",
        [
            item(patty, "1", "pz"),
            item(bun, "1", "pz"),
            item(sauce, "50", "g"),
            item(arugula, "10", "g"),
        ],
        category="Hamburguesas",
    )
    product = make_product(
        session,
        recipe=burger,
        lines=[
            product_line(fries, "1", "pz"),
            product_line(drink, "1", "pz"),
            product_line(box, "1", "pz", role=ProductItemRole.PACKAGING),
        ],
    )
    return {"product": product, "burger": burger}


def by_name(rows) -> dict:
    return {row.name: row for row in rows}


def test_units_are_target_plus_extra_across_the_tree(session, combo):
    plan = build_prep_plan(session, [PlanLine(combo["product"].id, 20, 5)], D(0))
    recipes, supplies = by_name(plan.recipes), by_name(plan.supplies)

    assert recipes["Hamburguesa"].batches == 25
    assert recipes["Torta"].batches == 25
    assert recipes["Pan"].batches == D("2.5")
    assert recipes["Pan"].yield_qty == 25
    assert recipes["Mermelada"].batches == D("3.90625")
    assert recipes["Papas"].batches == 25
    assert supplies["Carne"].quantity == D("3.75")
    assert supplies["Carne"].unit == Unit.KG
    assert supplies["Bebida"].quantity == 25
    assert supplies["Caja"].quantity == 25
    assert plan.warnings == []
    assert not any(row.buffered for row in [*plan.recipes, *plan.supplies])


def test_supplies_use_gross_quantity(session, combo):
    plan = build_prep_plan(session, [PlanLine(combo["product"].id, 10)], D(0))
    assert by_name(plan.supplies)["Papa"].quantity == D("2.2")  # 200 g + 10 % × 10


def test_buffer_multiplies_only_the_buffered_categories(session, combo):
    plan = build_prep_plan(session, [PlanLine(combo["product"].id, 20, 5)], D("0.10"))
    recipes, supplies = by_name(plan.recipes), by_name(plan.supplies)

    assert recipes["Mermelada"].batches == D("4.296875")  # 1250 g × 1.1 ÷ 320 g
    assert recipes["Mermelada"].buffered
    assert recipes["Papas"].batches == D("27.5")
    assert recipes["Papas"].buffered
    assert recipes["Hamburguesa"].batches == 25
    assert not recipes["Hamburguesa"].buffered
    assert recipes["Torta"].batches == 25
    assert recipes["Pan"].batches == D("2.5")
    assert supplies["Carne"].quantity == D("3.75")
    assert supplies["Bebida"].quantity == 25


def test_buffer_on_direct_produce_but_not_inside_other_subrecipes(session, combo):
    plan = build_prep_plan(session, [PlanLine(combo["product"].id, 10)], D("0.10"))
    supplies = by_name(plan.supplies)

    assert supplies["Arugula"].quantity == D("0.11")  # direct on the burger: 10 g × 10 × 1.1
    assert supplies["Arugula"].buffered
    # 1 batch of buns (100 g, no buffer) + 1.5625 × 1.1 batches of sauce (400 g each)
    assert supplies["Cebolla"].quantity == D("0.1") + D("0.6875")
    assert supplies["Huevo"].quantity == 2
    assert not supplies["Huevo"].buffered


def test_buffer_on_direct_product_component_and_never_on_packaging(session):
    lettuce = make_supply(session, "Lechuga", "1", "kg", "1000", group="Frutas y verduras")
    sachet = make_supply(session, "Sachet", "100", "pz", "1000", group="Salsas y condimentos")
    tray = make_supply(session, "Bandeja hoja", "10", "pz", "1000", group="Frutas y verduras")
    product = make_product(
        session,
        lines=[
            product_line(lettuce, "100", "g"),
            product_line(sachet, "1", "pz"),
            product_line(tray, "1", "pz", role=ProductItemRole.PACKAGING),
        ],
    )
    supplies = by_name(build_prep_plan(session, [PlanLine(product.id, 10)], D("0.5")).supplies)

    assert supplies["Lechuga"].quantity == D("1.5")
    assert supplies["Sachet"].quantity == 10
    assert supplies["Bandeja hoja"].quantity == 10


def test_buffer_does_not_compound_on_nested_buffered_recipes(session):
    chili = make_supply(session, "Chile", "1", "kg", "1000", group="Frutas y verduras")
    base = make_recipe(
        session, "Base", "100", "g", [item(chili, "100", "g")], is_subrecipe=True, category="salsas"
    )
    sauce = make_recipe(
        session,
        "Picante",
        "100",
        "g",
        [item(base, "100", "g")],
        is_subrecipe=True,
        category="Salsas",
    )
    product = make_product(session, lines=[product_line(sauce, "100", "g")])
    plan = build_prep_plan(session, [PlanLine(product.id, 1)], D("0.5"))

    assert by_name(plan.recipes)["Picante"].batches == D("1.5")
    assert by_name(plan.recipes)["Base"].batches == D("1.5")
    assert by_name(plan.supplies)["Chile"].quantity == D("0.15")


def test_nested_recipe_in_unbuffered_parent_inherits_only_through_buffered_path(session):
    salt = make_supply(session, "Sal", "1", "kg", "1000")
    base = make_recipe(
        session, "Fondo", "100", "g", [item(salt, "100", "g")], is_subrecipe=True, category="Bases"
    )
    sauce = make_recipe(
        session, "Salsa", "100", "g", [item(base, "100", "g")], is_subrecipe=True, category="Salsas"
    )
    product = make_product(
        session, lines=[product_line(sauce, "100", "g"), product_line(base, "100", "g")]
    )
    plan = build_prep_plan(session, [PlanLine(product.id, 1)], D("0.5"))

    fondo = by_name(plan.recipes)["Fondo"]
    assert fondo.batches == D("2.5")  # 1.5 through the sauce + 1 on its own
    assert fondo.buffered


def test_quantities_add_up_across_products(session):
    mayo = make_recipe(session, "Mayo", "100", "g", [], is_subrecipe=True, category="Bases")
    one = make_product(session, "Uno", lines=[product_line(mayo, "30", "g")])
    two = make_product(session, "Dos", lines=[product_line(mayo, "50", "g")])
    plan = build_prep_plan(session, [PlanLine(one.id, 10), PlanLine(two.id, 2)], D(0))
    assert plan.recipes[0].batches == 4


def test_main_recipe_batches_use_product_and_recipe_portions(session):
    flour = make_supply(session, "Harina", "1", "kg", "1000")
    pizza = make_recipe(session, "Pizza", "8", "pz", [item(flour, "800", "g")], portions="8")
    product = make_product(session, recipe=pizza, portions="2")
    plan = build_prep_plan(session, [PlanLine(product.id, 10)], D(0))

    assert plan.recipes[0].batches == D("2.5")
    assert plan.recipes[0].portions == 20
    assert plan.supplies[0].quantity == 2


def test_supply_without_price_still_gets_its_quantity(session):
    salt = make_supply(session, "Sal", "1", "kg")
    product = make_product(session, lines=[product_line(salt, "5", "g")])
    plan = build_prep_plan(session, [PlanLine(product.id, 100)], D(0))

    assert plan.supplies[0].quantity == D("0.5")
    assert plan.warnings == []


def test_bad_conversion_is_left_out_with_a_warning(session):
    egg = make_supply(session, "Huevo", "30", "pz", "3000")
    salt = make_supply(session, "Sal", "1", "kg", "1000")
    product = make_product(
        session, lines=[product_line(egg, "50", "g"), product_line(salt, "1", "g")]
    )
    plan = build_prep_plan(session, [PlanLine(product.id, 1)], D(0))

    assert [s.name for s in plan.supplies] == ["Sal"]
    assert len(plan.warnings) == 1
    assert plan.warnings[0].startswith("Combo: Huevo no se incluyó.")


def test_quantities_match_the_costing_engine(session, combo):
    """Without buffer, supplies × unit cost must equal the product's cost × units."""
    product = combo["product"]
    plan = build_prep_plan(session, [PlanLine(product.id, 7)], D(0))
    ctx = CostingContext.load(session, CostMode.AVERAGE_LAST_3)

    from_plan = sum(
        s.quantity * ctx.supply_cost(s.supply_id).reference_unit_cost for s in plan.supplies
    )
    expected = product_cost(ctx, spec_from_product(product)).total_cost * 7
    assert from_plan == pytest.approx(expected, abs=D("0.000001"))


def test_results_are_sorted_by_category_and_name(session, combo):
    plan = build_prep_plan(session, [PlanLine(combo["product"].id, 1)], D(0))
    assert [r.category for r in plan.recipes] == [
        "Acompañamientos",
        "Hamburguesas",
        "Panes",
        "Proteínas",
        "Salsas",
    ]
    assert [s.group for s in plan.supplies][:3] == ["Bebidas", "Carnes y pescados", "Desechables"]


def test_invalid_plans_are_rejected(session, combo):
    product = combo["product"]
    inactive = make_product(session, "Viejo", active=False)

    with pytest.raises(PrepPlanError, match="al menos un producto"):
        build_prep_plan(session, [], D(0))
    with pytest.raises(PrepPlanError, match="al menos un producto"):
        build_prep_plan(session, [PlanLine(product.id, 0, 0)], D(0))
    with pytest.raises(PrepPlanError, match="repetidos"):
        build_prep_plan(session, [PlanLine(product.id, 1), PlanLine(product.id, 2)], D(0))
    with pytest.raises(PrepPlanError, match="no existe"):
        build_prep_plan(session, [PlanLine(9999, 1)], D(0))
    with pytest.raises(PrepPlanError, match="inactivo"):
        build_prep_plan(session, [PlanLine(inactive.id, 1)], D(0))


def test_product_without_contents_warns(session):
    empty = make_product(session, "Vacío")
    plan = build_prep_plan(session, [PlanLine(empty.id, 1)], D(0))
    assert plan.warnings == ["Vacío no tiene receta ni componentes."]


# --- API ---------------------------------------------------------------------------------------


def test_api_calculates_plan(client, combo):
    response = client.post(
        "/api/prep-plan",
        json={
            "buffer_rate": "0.10",
            "items": [{"product_id": combo["product"].id, "target_qty": 20, "extra_qty": 5}],
        },
    )
    assert response.status_code == 200
    data = response.json()
    sauce = next(r for r in data["recipes"] if r["name"] == "Mermelada")
    assert D(sauce["batches"]) == D("4.296875")
    assert sauce["buffered"] is True
    assert sauce["yield_unit"] == "g"
    assert next(s for s in data["supplies"] if s["name"] == "Caja")["quantity"] == "25"


@pytest.mark.parametrize(
    "payload, status_code, message",
    [
        ({"items": []}, 422, "al menos un producto"),
        ({"items": [{"product_id": 9999, "target_qty": 1}]}, 422, "no existe"),
    ],
)
def test_api_rejections_are_in_spanish(client, payload, status_code, message):
    response = client.post("/api/prep-plan", json=payload)
    assert response.status_code == status_code
    assert message in response.json()["detail"]


def test_api_validates_ranges(client, combo):
    product_id = combo["product"].id
    for payload in (
        {"buffer_rate": "1.5", "items": [{"product_id": product_id, "target_qty": 1}]},
        {"items": [{"product_id": product_id, "target_qty": -1}]},
    ):
        assert client.post("/api/prep-plan", json=payload).status_code == 422


def test_csv_export(client, combo):
    response = client.post(
        "/api/prep-plan/export.csv",
        json={
            "name": "Planeación sesión 0",
            "buffer_rate": "0.10",
            "items": [{"product_id": combo["product"].id, "target_qty": 20, "extra_qty": 5}],
        },
    )
    assert response.status_code == 200
    assert 'filename="badger-planeacion-sesion-0-' in response.headers["content-disposition"]
    rows = response.content.decode("utf-8-sig").splitlines()
    assert rows[0].startswith("Tipo;Nombre;Categoría o grupo;Cantidad;Unidad")
    assert "Receta;Mermelada;Salsas;4,30;recetas;1375,000;g;4,30;Sí" in rows
    assert "Suministro;Caja;Desechables;25,000;pz;;;;No" in rows


def test_csv_export_without_name_uses_a_default_filename(client, combo):
    response = client.post(
        "/api/prep-plan/export.csv",
        json={"items": [{"product_id": combo["product"].id, "target_qty": 1}]},
    )
    assert 'filename="badger-plan-' in response.headers["content-disposition"]
