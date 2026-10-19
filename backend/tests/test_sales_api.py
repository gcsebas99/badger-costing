"""Sales periods and menu engineering. The classification case mirrors the template's pizza group:
8 dishes, 335 units, popularity threshold 1/8."""

from decimal import Decimal

import pytest

D = Decimal

PIZZAS = [  # name, units, PVP (VAT 13 %, no cost → margin = PVP / 1.13)
    ("Margarita", 50, "2260"),  # margin 2000
    ("4 Quesos", 30, "3390"),  # 3000
    ("Funghi", 40, "1130"),  # 1000
    ("Pepperoni", 60, "1130"),  # 1000
    ("Hawaiana", 35, "2260"),  # 2000
    ("BBQ", 45, "3390"),  # 3000
    ("Vegetariana", 25, "1130"),  # 1000
    ("Mediterránea", 50, "2260"),  # 2000
]
EXPECTED = {
    "Margarita": "star",
    "4 Quesos": "puzzle",
    "Funghi": "dog",
    "Pepperoni": "plowhorse",
    "Hawaiana": "puzzle",
    "BBQ": "star",
    "Vegetariana": "dog",
    "Mediterránea": "star",
}


@pytest.fixture
def pizzas(client):
    group = client.post("/api/menu-groups", json={"name": "Pizzas"}).json()
    products = {}
    for name, _units, price in PIZZAS:
        products[name] = client.post(
            "/api/products",
            json={
                "name": name,
                "menu_group_id": group["id"],
                "direct_price": price,
            },
        ).json()
    period = client.post(
        "/api/sales-periods",
        json={
            "name": "Diciembre 2024",
            "start_date": "2024-12-01",
            "end_date": "2024-12-31",
        },
    ).json()
    return {"group": group, "products": products, "period": period}


def put_units(client, pizzas, units):
    return client.put(
        f"/api/sales-periods/{pizzas['period']['id']}/entries",
        json={
            "entries": [{"product_id": pizzas["products"][n]["id"], "units": u} for n, u in units]
        },
    )


def test_menu_engineering_matches_template_method(client, pizzas):
    assert put_units(client, pizzas, [(n, u) for n, u, _ in PIZZAS]).status_code == 200
    groups = client.get(f"/api/sales-periods/{pizzas['period']['id']}/menu-engineering").json()

    assert len(groups) == 1
    group = groups[0]
    assert group["total_units"] == 335
    assert D(group["popularity_threshold"]) == D("0.125")
    # (50·2000 + 30·3000 + 40·1000 + 60·1000 + 35·2000 + 45·3000 + 25·1000 + 50·2000) / 335
    assert round(D(group["average_margin"]), 2) == round(D(620000) / D(335), 2)
    classes = {item["name"]: item["classification"] for item in group["items"]}
    assert classes == EXPECTED
    margarita = next(i for i in group["items"] if i["name"] == "Margarita")
    assert round(D(margarita["popularity"]), 4) == round(D(50) / D(335), 4)
    assert D(margarita["unit_margin"]) == D("2000")
    assert D(margarita["total_margin"]) == D("100000")


def test_channel_units_weight_the_margin(client, pizzas):
    uber = client.post("/api/platforms", json={"name": "Uber Eats", "fee_rate": "0.3"}).json()
    product = pizzas["products"]["Margarita"]
    client.patch(
        f"/api/products/{product['id']}",
        json={"platform_prices": [{"platform_id": uber["id"], "price": "2260"}]},
    )
    client.put(
        f"/api/sales-periods/{pizzas['period']['id']}/entries",
        json={
            "entries": [
                {"product_id": product["id"], "units": 30},
                {"product_id": product["id"], "platform_id": uber["id"], "units": 10},
            ]
        },
    )
    groups = client.get(f"/api/sales-periods/{pizzas['period']['id']}/menu-engineering").json()
    item = next(i for i in groups[0]["items"] if i["name"] == "Margarita")
    # direct margin 2000; Uber 2000 − 678 fee = 1322 → (30·2000 + 10·1322) / 40
    assert item["units"] == 40
    assert D(item["unit_margin"]) == (D(30) * 2000 + D(10) * 1322) / 40


def test_entries_replace_and_zero_removes(client, pizzas):
    put_units(client, pizzas, [("Margarita", 5), ("BBQ", 3)])
    body = put_units(client, pizzas, [("Margarita", 7)]).json()
    assert [(e["product_id"], e["units"]) for e in body["entries"]] == [
        (pizzas["products"]["Margarita"]["id"], 7)
    ]
    assert body["total_units"] == 7
    assert body["product_count"] == 1


def test_csv_import_replace_and_add(client, pizzas):
    url = f"/api/sales-periods/{pizzas['period']['id']}/import"
    result = client.post(
        url, json={"content": "Producto;Unidades\nMargarita;10\nCalzone;4\n"}
    ).json()
    assert result == {
        "imported_rows": 1,
        "unmatched_products": ["Calzone"],
        "unmatched_channels": [],
        "invalid_rows": [],
    }
    client.post(url, json={"content": "producto,cantidad\nmargarita,5\n", "replace": False})
    detail = client.get(f"/api/sales-periods/{pizzas['period']['id']}").json()
    assert detail["total_units"] == 15

    bad = client.post(url, json={"content": "fecha;total\n1;2\n"})
    assert bad.status_code == 422


def test_period_validation_and_crud(client, pizzas):
    bad_dates = client.post(
        "/api/sales-periods",
        json={"name": "X", "start_date": "2024-12-31", "end_date": "2024-12-01"},
    )
    assert bad_dates.status_code == 422
    duplicate = client.post(
        "/api/sales-periods",
        json={"name": "Diciembre 2024", "start_date": "2024-12-01", "end_date": "2024-12-31"},
    )
    assert duplicate.status_code == 409

    url = f"/api/sales-periods/{pizzas['period']['id']}"
    assert client.patch(url, json={"name": "Dic 2024"}).json()["name"] == "Dic 2024"
    assert [p["name"] for p in client.get("/api/sales-periods").json()] == ["Dic 2024"]
    assert client.delete(url).status_code == 204
    assert client.get(url).status_code == 404


def test_products_and_platforms_with_sales_cannot_be_deleted(client, pizzas):
    uber = client.post("/api/platforms", json={"name": "Uber Eats", "fee_rate": "0.3"}).json()
    product = pizzas["products"]["Funghi"]
    client.put(
        f"/api/sales-periods/{pizzas['period']['id']}/entries",
        json={
            "entries": [
                {"product_id": product["id"], "platform_id": uber["id"], "units": 2},
            ]
        },
    )
    assert client.delete(f"/api/products/{product['id']}").status_code == 409
    assert client.delete(f"/api/platforms/{uber['id']}").status_code == 409


def test_entries_validation(client, pizzas):
    url = f"/api/sales-periods/{pizzas['period']['id']}/entries"
    pid = pizzas["products"]["Funghi"]["id"]
    assert client.put(url, json={"entries": [{"product_id": 999, "units": 1}]}).status_code == 422
    assert client.put(url, json={"entries": [{"product_id": pid, "units": -1}]}).status_code == 422
    dup = {"entries": [{"product_id": pid, "units": 1}, {"product_id": pid, "units": 2}]}
    assert client.put(url, json=dup).status_code == 422
