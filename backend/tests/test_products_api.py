"""The M3 milestone: a burger with bun, protein, two sauces and packaging, priced for direct sale
and a delivery platform, flagged when its margin falls below the threshold."""

from decimal import Decimal

import pytest

D = Decimal


def supply(client, name, pack_qty, pack_unit, price):
    body = {
        "name": name,
        "group": "Otros",
        "pack_qty": pack_qty,
        "pack_unit": pack_unit,
        "initial_price": {"amount": price, "purchased_on": "2026-10-01"},
    }
    return client.post("/api/supplies", json=body).json()


def line(kind, ref, quantity, unit):
    return {"item_type": kind, "ref_id": ref["id"], "quantity": quantity, "unit": unit}


@pytest.fixture
def setup(client):
    client.patch("/api/settings", json={"bank_fee_rate": "0.02", "margin_alert_rate": "0.4"})
    bun = supply(client, "Pan brioche", "8", "pz", "1600")  # 200 / pz
    beef = supply(client, "Carne", "1", "kg", "6000")  # 6 / g
    oil = supply(client, "Aceite", "1", "L", "1500")
    chipotle = supply(client, "Chipotle", "200", "g", "900")
    box = supply(client, "Caja hamburguesa", "100", "pz", "15000")  # 150 / pz
    napkin = supply(client, "Servilleta", "1000", "pz", "5000")  # 5 / pz

    def recipe(name, yield_qty, yield_unit, items, **extra):
        body = {
            "name": name,
            "category": "Salsas",
            "yield_qty": yield_qty,
            "yield_unit": yield_unit,
            "portions": "1",
            "items": items,
            **extra,
        }
        return client.post("/api/recipes", json=body).json()

    mayo = recipe("Mayo", "500", "g", [line("supply", oil, "0.5", "L")], is_subrecipe=True)  # 1.5/g
    chipotle_mayo = recipe(
        "Mayo chipotle",
        "300",
        "g",
        [line("recipe", mayo, "250", "g"), line("supply", chipotle, "50", "g")],
        is_subrecipe=True,
    )  # (375 + 225) / 300 = 2 / g
    burger = recipe(
        "Hamburguesa clásica",
        "1",
        "pz",
        [
            line("supply", bun, "1", "pz"),  # 200
            line("supply", beef, "150", "g"),  # 900
            line("recipe", mayo, "20", "g"),  # 30
            line("recipe", chipotle_mayo, "20", "g"),  # 40
        ],
        category="Hamburguesas",
    )
    group = client.post("/api/menu-groups", json={"name": "Hamburguesas"}).json()
    uber = client.post("/api/platforms", json={"name": "Uber Eats", "fee_rate": "0.3"}).json()
    return {
        "burger": burger,
        "group": group,
        "uber": uber,
        "box": box,
        "napkin": napkin,
        "chipotle_mayo": chipotle_mayo,
        "beef": beef,
    }


def create_product(client, setup, **overrides):
    body = {
        "name": "Hamburguesa clásica",
        "menu_group_id": setup["group"]["id"],
        "recipe_id": setup["burger"]["id"],
        "direct_price": "4520",
        "target_cost": "1300",
        "packaging": [
            line("supply", setup["box"], "1", "pz"),
            line("supply", setup["napkin"], "2", "pz"),
        ],  # 160
        "platform_prices": [{"platform_id": setup["uber"]["id"], "price": "5650"}],
        **overrides,
    }
    response = client.post("/api/products", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_burger_cost_and_channels(client, setup):
    product = create_product(client, setup)
    pricing = product["pricing"]

    assert D(pricing["cost"]["recipe_cost"]) == D("1170")
    assert D(pricing["cost"]["packaging_cost"]) == D("160")
    assert D(pricing["cost"]["total_cost"]) == D("1330")
    assert pricing["cost"]["recipe"]["name"] == "Hamburguesa clásica"

    direct, uber = pricing["channels"]
    assert direct["kind"] == "direct"
    assert D(direct["price_ex_vat"]) == D("4000")
    assert D(direct["fee"]) == D("90.4")  # 2 % bank fee
    assert D(direct["margin"]) == D("4000") - D("1330") - D("90.4")
    assert direct["margin_status"] == "ok"

    assert uber["name"] == "Uber Eats"
    assert D(uber["fee"]) == D("1695")  # 30 % of 5650, no bank fee
    assert D(uber["margin"]) == D("5000") - D("1330") - D("1695")  # 1975 → 39.5 %
    assert uber["margin_status"] == "bad"
    assert pricing["status"] == "bad"

    # 1330 / 30 % × 1.13
    assert D(pricing["suggested_price"]) == D("1330") / D("0.3") * D("1.13")
    assert round(D(pricing["deviation"]), 6) == round((D("1330") - D("1300")) / D("1300"), 6)
    assert pricing["deviation_status"] == "ok"


def test_group_target_overrides_default(client, setup):
    client.patch(f"/api/menu-groups/{setup['group']['id']}", json={"target_food_cost_rate": "0.25"})
    pricing = create_product(client, setup)["pricing"]
    assert D(pricing["target_food_cost_rate"]) == D("0.25")
    assert pricing["channels"][0]["food_cost_status"] == "warn"  # 1330 / 4000 = 33 %


def test_price_change_flows_into_product(client, setup):
    product = create_product(client, setup)
    client.patch("/api/settings", json={"cost_mode": "latest"})
    client.post(
        f"/api/supplies/{setup['beef']['id']}/prices",
        json={"amount": "8000", "purchased_on": "2026-10-10"},
    )
    updated = client.get(f"/api/products/{product['id']}").json()
    assert D(updated["pricing"]["cost"]["total_cost"]) == D("1330") + D("300")  # 150 g × +2


def test_direct_items_and_list(client, setup):
    create_product(
        client, setup, name="Combo", items=[line("recipe", setup["chipotle_mayo"], "30", "g")]
    )
    rows = client.get("/api/products").json()
    assert len(rows) == 1
    row = rows[0]
    assert row["menu_group_name"] == "Hamburguesas"
    assert row["recipe_name"] == "Hamburguesa clásica"
    assert D(row["total_cost"]) == D("1330") + D("60")
    assert [c["name"] for c in row["channels"]] == ["Venta directa", "Uber Eats"]


def test_update_replaces_lists_and_prices(client, setup):
    product = create_product(client, setup)
    url = f"/api/products/{product['id']}"
    body = client.patch(url, json={"platform_prices": [], "direct_price": "5000"}).json()
    assert [c["kind"] for c in body["pricing"]["channels"]] == ["direct"]
    assert len(body["packaging"]) == 2  # untouched

    body = client.patch(url, json={"packaging": []}).json()
    assert body["packaging"] == []
    assert D(body["pricing"]["cost"]["total_cost"]) == D("1170")


def test_inactive_platform_is_not_priced(client, setup):
    product = create_product(client, setup)
    client.patch(f"/api/platforms/{setup['uber']['id']}", json={"active": False})
    body = client.get(f"/api/products/{product['id']}").json()
    assert [c["kind"] for c in body["pricing"]["channels"]] == ["direct"]
    assert len(body["platform_prices"]) == 1  # the price is kept


def test_preview(client, setup):
    response = client.post(
        "/api/products/preview",
        json={
            "menu_group_id": setup["group"]["id"],
            "recipe_id": setup["burger"]["id"],
            "recipe_portions": "2",
            "direct_price": "4520",
        },
    )
    assert response.status_code == 200
    assert D(response.json()["cost"]["total_cost"]) == D("2340")


def test_validation(client, setup):
    bad_group = client.post("/api/products", json={"name": "X", "menu_group_id": 999})
    assert bad_group.status_code == 422
    response = client.post(
        "/api/products",
        json={
            "name": "X",
            "menu_group_id": setup["group"]["id"],
            "platform_prices": [
                {"platform_id": setup["uber"]["id"], "price": "1"},
                {"platform_id": setup["uber"]["id"], "price": "2"},
            ],
        },
    )
    assert response.status_code == 422


def test_usages_and_delete_guards_include_products(client, setup):
    product = create_product(client, setup)
    usages = client.get(f"/api/recipes/{setup['burger']['id']}/usages").json()
    assert usages == [
        {
            "kind": "product",
            "id": product["id"],
            "name": "Hamburguesa clásica",
            "category": "Hamburguesas",
            "is_subrecipe": False,
        }
    ]
    assert client.delete(f"/api/recipes/{setup['burger']['id']}").status_code == 409
    assert client.delete(f"/api/supplies/{setup['box']['id']}").status_code == 409
    assert client.delete(f"/api/menu-groups/{setup['group']['id']}").status_code == 409

    assert client.delete(f"/api/products/{product['id']}").status_code == 204
    assert client.delete(f"/api/supplies/{setup['box']['id']}").status_code == 204


def test_decimals_are_never_in_exponent_notation(client, setup):
    # 4520 / 1.13 is exactly 4000, which str(Decimal) renders as "4.0E+3".
    product = create_product(client, setup)
    response = client.get(f"/api/products/{product['id']}")
    assert "E+" not in response.text
    assert response.json()["pricing"]["channels"][0]["price_ex_vat"] == "4000"
