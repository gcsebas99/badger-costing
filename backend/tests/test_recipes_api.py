from decimal import Decimal

import pytest

D = Decimal


def supply(client, name, pack_qty, pack_unit, price=None, equivalence=None):
    body = {"name": name, "group": "Otros", "pack_qty": pack_qty, "pack_unit": pack_unit}
    if price:
        body["initial_price"] = {"amount": price, "purchased_on": "2026-10-01"}
    if equivalence:
        body["equivalence"] = {"quantity": equivalence[0], "unit": equivalence[1]}
    response = client.post("/api/supplies", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def line(kind, ref, quantity, unit, waste="0"):
    return {
        "item_type": kind,
        "ref_id": ref["id"],
        "quantity": quantity,
        "unit": unit,
        "waste_rate": waste,
    }


def recipe(client, name, yield_qty, yield_unit, items, **extra):
    body = {
        "name": name,
        "category": "Salsas",
        "yield_qty": yield_qty,
        "yield_unit": yield_unit,
        "portions": "1",
        "items": items,
        **extra,
    }
    response = client.post("/api/recipes", json=body)
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def mayo_chain(client):
    egg = supply(client, "Huevo", "30", "pz", "2850", equivalence=("50", "g"))
    oil = supply(client, "Aceite", "1", "L", "1500")
    chipotle = supply(client, "Chipotle", "200", "g", "900")
    mayo = recipe(
        client,
        "Mayo casera",
        "600",
        "g",
        [line("supply", egg, "3", "pz"), line("supply", oil, "0.5", "L")],
        is_subrecipe=True,
        portions="20",
    )
    chipotle_mayo = recipe(
        client,
        "Mayo chipotle",
        "350",
        "g",
        [line("recipe", mayo, "300", "g"), line("supply", chipotle, "50", "g")],
        is_subrecipe=True,
    )
    return {
        "egg": egg,
        "oil": oil,
        "chipotle": chipotle,
        "mayo": mayo,
        "chipotle_mayo": chipotle_mayo,
    }


def test_create_recipe_returns_cost_breakdown(mayo_chain):
    mayo = mayo_chain["mayo"]

    assert D(mayo["cost"]["total_cost"]) == D("1035")  # 3 × 95 + 0.5 L × 1500
    assert D(mayo["cost"]["cost_per_portion"]) == D("51.75")
    assert mayo["cost"]["reference_unit"] == "kg"
    assert D(mayo["cost"]["cost_per_reference_unit"]) == D("1725")
    assert [i["ref_id"] for i in mayo["items"]] == [
        mayo_chain["egg"]["id"],
        mayo_chain["oil"]["id"],
    ]
    assert mayo["cost"]["items"][0]["name"] == "Huevo"
    assert mayo["cost"]["complete"] is True


def test_nested_breakdown_includes_subrecipe_tree(client, mayo_chain):
    cost = client.get(f"/api/recipes/{mayo_chain['chipotle_mayo']['id']}/cost").json()
    first = cost["items"][0]
    assert first["item_type"] == "recipe"
    assert first["subrecipe"]["name"] == "Mayo casera"
    assert len(first["subrecipe"]["items"]) == 2


def test_egg_price_change_updates_both_mayos(client, mayo_chain):
    client.patch("/api/settings", json={"cost_mode": "latest"})
    before = D(
        client.get(f"/api/recipes/{mayo_chain['chipotle_mayo']['id']}").json()["cost"]["total_cost"]
    )

    client.post(
        f"/api/supplies/{mayo_chain['egg']['id']}/prices",
        json={"amount": "3300", "purchased_on": "2026-10-10"},
    )

    mayo = client.get(f"/api/recipes/{mayo_chain['mayo']['id']}").json()
    chipotle = client.get(f"/api/recipes/{mayo_chain['chipotle_mayo']['id']}").json()
    assert D(mayo["cost"]["total_cost"]) == D("1080")  # +₡45 (3 eggs × ₡15)
    assert D(chipotle["cost"]["total_cost"]) > before


def test_list_recipes_with_costs_and_filters(client, mayo_chain):
    recipe(
        client,
        "Hamburguesa",
        "1",
        "pz",
        [line("recipe", mayo_chain["chipotle_mayo"], "30", "g")],
        category="Hamburguesas",
    )

    rows = client.get("/api/recipes").json()
    assert [r["name"] for r in rows] == ["Hamburguesa", "Mayo casera", "Mayo chipotle"]
    assert rows[1]["item_count"] == 2
    assert rows[1]["complete"] is True

    subs = client.get("/api/recipes", params={"is_subrecipe": True}).json()
    assert {r["name"] for r in subs} == {"Mayo casera", "Mayo chipotle"}
    assert [r["name"] for r in client.get("/api/recipes", params={"q": "CHIPO"}).json()] == [
        "Mayo chipotle"
    ]
    assert len(client.get("/api/recipes", params={"category": "Hamburguesas"}).json()) == 1


def test_update_replaces_items_and_detects_cycles(client, mayo_chain):
    mayo_id = mayo_chain["mayo"]["id"]
    response = client.patch(
        f"/api/recipes/{mayo_id}",
        json={"items": [line("recipe", mayo_chain["chipotle_mayo"], "10", "g")]},
    )
    assert response.status_code == 422
    assert "Ciclo" in response.json()["detail"]

    # The recipe is unchanged after the rejected update
    assert len(client.get(f"/api/recipes/{mayo_id}").json()["items"]) == 2

    ok = client.patch(
        f"/api/recipes/{mayo_id}",
        json={"items": [line("supply", mayo_chain["oil"], "1", "L")], "portions": "4"},
    )
    assert ok.status_code == 200
    body = ok.json()
    assert len(body["items"]) == 1
    assert D(body["cost"]["total_cost"]) == D("1500")
    assert D(body["cost"]["cost_per_portion"]) == D("375")


def test_update_without_items_keeps_items(client, mayo_chain):
    mayo_id = mayo_chain["mayo"]["id"]
    body = client.patch(f"/api/recipes/{mayo_id}", json={"name": "Mayonesa"}).json()
    assert body["name"] == "Mayonesa"
    assert len(body["items"]) == 2


def test_unknown_ingredient_is_rejected(client):
    response = client.post(
        "/api/recipes",
        json={
            "name": "X",
            "category": "Salsas",
            "yield_qty": "1",
            "yield_unit": "kg",
            "portions": "1",
            "items": [{"item_type": "supply", "ref_id": 999, "quantity": "1", "unit": "kg"}],
        },
    )
    assert response.status_code == 422
    assert "no existe" in response.json()["detail"]


@pytest.mark.parametrize(
    "field,value",
    [("yield_qty", "0"), ("portions", "0"), ("safety_margin_rate", "1.5"), ("name", "")],
)
def test_recipe_validation(client, field, value):
    body = {
        "name": "X",
        "category": "Salsas",
        "yield_qty": "1",
        "yield_unit": "kg",
        "portions": "1",
        field: value,
    }
    assert client.post("/api/recipes", json=body).status_code == 422


def test_preview_costs_unsaved_changes(client, mayo_chain):
    mayo = mayo_chain["mayo"]
    response = client.post(
        "/api/recipes/preview",
        json={
            "id": mayo["id"],
            "yield_qty": "600",
            "yield_unit": "g",
            "portions": "20",
            "safety_margin_rate": "0.1",
            "items": [line("supply", mayo_chain["egg"], "6", "pz")],
        },
    )
    assert response.status_code == 200
    cost = response.json()
    assert D(cost["ingredients_cost"]) == D("570")
    assert D(cost["total_cost"]) == D("627")
    # nothing was saved
    assert D(client.get(f"/api/recipes/{mayo['id']}").json()["cost"]["total_cost"]) == D("1035")


def test_preview_rejects_cycles(client, mayo_chain):
    response = client.post(
        "/api/recipes/preview",
        json={
            "id": mayo_chain["mayo"]["id"],
            "yield_qty": "1",
            "yield_unit": "kg",
            "portions": "1",
            "items": [line("recipe", mayo_chain["chipotle_mayo"], "10", "g")],
        },
    )
    assert response.status_code == 422


def test_preview_flags_conversion_errors(client, mayo_chain):
    cost = client.post(
        "/api/recipes/preview",
        json={
            "yield_qty": "1",
            "yield_unit": "kg",
            "portions": "1",
            "items": [line("supply", mayo_chain["oil"], "100", "g")],
        },
    ).json()
    assert cost["items"][0]["status"] == "conversion_error"
    assert cost["complete"] is False


def test_usages_and_delete_guards(client, mayo_chain):
    mayo_id = mayo_chain["mayo"]["id"]
    usages = client.get(f"/api/recipes/{mayo_id}/usages").json()
    assert [u["name"] for u in usages] == ["Mayo chipotle"]
    assert client.get(f"/api/recipes/{mayo_id}").json()["used_in"][0]["name"] == "Mayo chipotle"

    egg_users = client.get(f"/api/supplies/{mayo_chain['egg']['id']}/usages").json()
    assert [u["name"] for u in egg_users] == ["Mayo casera"]

    blocked = client.delete(f"/api/recipes/{mayo_id}")
    assert blocked.status_code == 409
    assert "Mayo chipotle" in blocked.json()["detail"]

    supply_blocked = client.delete(f"/api/supplies/{mayo_chain['egg']['id']}")
    assert supply_blocked.status_code == 409
    assert "Desactívalo" in supply_blocked.json()["detail"]

    assert client.patch(f"/api/recipes/{mayo_id}", json={"is_subrecipe": False}).status_code == 409

    assert client.delete(f"/api/recipes/{mayo_chain['chipotle_mayo']['id']}").status_code == 204
    assert client.delete(f"/api/recipes/{mayo_id}").status_code == 204
    assert client.delete(f"/api/supplies/{mayo_chain['egg']['id']}").status_code == 204


def test_ingredient_options(client, mayo_chain):
    options = client.get(
        "/api/recipes/ingredients", params={"exclude_recipe_id": mayo_chain["mayo"]["id"]}
    ).json()
    by_name = {o["name"]: o for o in options}

    assert "Mayo casera" not in by_name  # the recipe being edited
    assert "Mayo chipotle" not in by_name  # contains the recipe being edited → would be a cycle
    assert by_name["Aceite"]["item_type"] == "supply"

    unrestricted = {o["name"]: o for o in client.get("/api/recipes/ingredients").json()}
    assert unrestricted["Mayo chipotle"]["item_type"] == "recipe"
    assert unrestricted["Mayo chipotle"]["allowed_units"] == ["g", "kg"]
    assert by_name["Aceite"]["allowed_units"] == ["ml", "L"]
    # egg: bought in pz, 1 pz = 50 g → usable in pz and in g/kg
    assert by_name["Huevo"]["allowed_units"] == ["pz", "g", "kg"]
    assert D(by_name["Huevo"]["reference_unit_cost"]) == D("95")


def test_recipe_facets(client, mayo_chain):
    categories = client.get("/api/recipes/facets").json()["categories"]
    assert "Salsas" in categories
    assert "Proteínas" in categories


def test_unknown_recipe_404(client):
    assert client.get("/api/recipes/999").status_code == 404
    assert client.delete("/api/recipes/999").status_code == 404


# --- Preparation steps ---------------------------------------------------------------------


def test_steps_are_saved_in_order_and_blank_ones_dropped(client, mayo_chain):
    egg = mayo_chain["egg"]
    created = recipe(
        client,
        "Huevo frito",
        "1",
        "pz",
        [line("supply", egg, "1", "pz")],
        steps=["Calentar la sartén", "  ", "Freír el huevo 2 min  "],
    )
    assert created["steps"] == ["Calentar la sartén", "Freír el huevo 2 min"]

    detail = client.get(f"/api/recipes/{created['id']}").json()
    assert detail["steps"] == ["Calentar la sartén", "Freír el huevo 2 min"]


def test_patch_steps_replaces_reorders_and_clears(client, mayo_chain):
    mayo = mayo_chain["mayo"]
    url = f"/api/recipes/{mayo['id']}"
    assert mayo["steps"] == []

    response = client.patch(url, json={"steps": ["Uno", "Dos", "Tres"]})
    assert response.json()["steps"] == ["Uno", "Dos", "Tres"]

    response = client.patch(url, json={"steps": ["Tres", "Uno"]})
    assert response.json()["steps"] == ["Tres", "Uno"]

    # Patching other fields leaves steps alone
    response = client.patch(url, json={"notes": "Refrigerar"})
    assert response.json()["steps"] == ["Tres", "Uno"]

    response = client.patch(url, json={"steps": []})
    assert response.json()["steps"] == []

    assert client.patch(url, json={"steps": None}).status_code == 422


def test_step_text_is_limited(client, mayo_chain):
    url = f"/api/recipes/{mayo_chain['mayo']['id']}"
    assert client.patch(url, json={"steps": ["x" * 1001]}).status_code == 422


def test_deleting_recipe_deletes_its_steps(client, session):
    from sqlmodel import select

    from app.models import RecipeStep

    created = recipe(client, "Agua", "1", "L", [], steps=["Servir"])
    assert client.delete(f"/api/recipes/{created['id']}").status_code == 204
    assert session.exec(select(RecipeStep)).all() == []


# --- Scaling -------------------------------------------------------------------------------


def test_scaled_by_factor(client, mayo_chain):
    mayo = mayo_chain["mayo"]
    response = client.get(f"/api/recipes/{mayo['id']}/scaled", params={"factor": "0.5"})
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["factor"] == "0.5"
    assert body["anchor_item_id"] is None
    assert D(body["cost"]["yield_qty"]) == D("300")
    assert D(body["cost"]["portions"]) == D("10")
    assert D(body["cost"]["total_cost"]) == D("517.5")
    assert [D(i["quantity"]) for i in body["cost"]["items"]] == [D("1.5"), D("0.25")]
    # Nothing was stored
    assert D(client.get(f"/api/recipes/{mayo['id']}").json()["cost"]["total_cost"]) == D("1035")


def test_scaled_by_anchor_ingredient(client, mayo_chain):
    mayo = mayo_chain["mayo"]
    oil_line = mayo["items"][1]  # 0.5 L
    response = client.get(
        f"/api/recipes/{mayo['id']}/scaled",
        params={"anchor_item_id": oil_line["id"], "anchor_qty": "750", "anchor_unit": "ml"},
    )
    assert response.status_code == 200, response.text
    body = response.json()

    assert D(body["factor"]) == D("1.5")
    assert body["anchor_item_id"] == oil_line["id"]
    assert D(body["cost"]["items"][0]["quantity"]) == D("4.5")  # eggs


@pytest.mark.parametrize(
    "params",
    [
        {},
        {"factor": "2", "anchor_item_id": 1, "anchor_qty": "1", "anchor_unit": "g"},
        {"anchor_item_id": 1, "anchor_qty": "1"},
        {"factor": "0"},
        {"factor": "101"},
        {"factor": "abc"},
    ],
)
def test_scaled_rejects_bad_params(client, mayo_chain, params):
    response = client.get(f"/api/recipes/{mayo_chain['mayo']['id']}/scaled", params=params)
    assert response.status_code == 422


def test_scaled_anchor_errors_are_spanish(client, mayo_chain):
    mayo = mayo_chain["mayo"]
    oil_line = mayo["items"][1]
    response = client.get(
        f"/api/recipes/{mayo['id']}/scaled",
        params={"anchor_item_id": oil_line["id"], "anchor_qty": "500", "anchor_unit": "g"},
    )
    assert response.status_code == 422
    assert "No se puede convertir" in response.json()["detail"]


def test_scaled_unknown_recipe(client):
    assert client.get("/api/recipes/999/scaled", params={"factor": "2"}).status_code == 404
