import sqlite3
from decimal import Decimal

import pytest

from app.config import settings
from tests.test_products_api import create_product, line, setup, supply  # noqa: F401 (fixture)

D = Decimal


def test_dashboard_lists_products_to_review(client, setup):  # noqa: F811
    product = create_product(client, setup)
    data = client.get("/api/dashboard").json()

    assert data["active_products"] == 1
    assert data["products_below_margin"] == 1  # Uber Eats at 39.5 %
    alert = data["products_to_review"][0]
    assert alert["id"] == product["id"]
    assert alert["status"] == "bad"
    assert alert["worst_channel"] == "Uber Eats"
    assert any("Margen 39,5 % en Uber Eats" in r for r in alert["reasons"])


def test_dashboard_price_increases_and_unpriced(client, setup):  # noqa: F811
    beef = setup["beef"]
    client.post(
        f"/api/supplies/{beef['id']}/prices", json={"amount": "6600", "purchased_on": "2026-10-10"}
    )
    client.post(
        "/api/supplies",
        json={"name": "Sin precio", "group": "Otros", "pack_qty": "1", "pack_unit": "kg"},
    )
    data = client.get("/api/dashboard").json()

    increase = data["price_increases"][0]
    assert increase["name"] == "Carne"
    assert D(increase["change_rate"]) == D("0.1")
    assert [s["name"] for s in data["unpriced_supplies"]] == ["Sin precio"]
    assert data["supplies_without_price"] == 1


def test_dashboard_flags_incomplete_recipes(client):
    unpriced = client.post(
        "/api/supplies", json={"name": "Sal", "group": "Otros", "pack_qty": "1", "pack_unit": "kg"}
    ).json()
    client.post(
        "/api/recipes",
        json={
            "name": "Salsa",
            "category": "Salsas",
            "yield_qty": "1",
            "yield_unit": "kg",
            "portions": "1",
            "items": [line("supply", unpriced, "10", "g")],
        },
    )
    data = client.get("/api/dashboard").json()
    assert data["incomplete"][0]["kind"] == "recipe"
    assert data["incomplete"][0]["name"] == "Salsa"
    assert data["incomplete"][0]["issues"] == ["Sal: El suministro no tiene precio."]


def test_simulation_shows_affected_products_and_recipes(client, setup):  # noqa: F811
    create_product(client, setup)
    response = client.post(
        "/api/simulate",
        json={
            "changes": [{"supply_id": setup["beef"]["id"], "change_rate": "0.1"}],
        },
    )
    assert response.status_code == 200
    result = response.json()

    assert D(result["changes"][0]["cost_after"]) == D("6600")  # ₡/kg
    assert [r["name"] for r in result["recipes"]] == ["Hamburguesa clásica"]
    product = result["products"][0]
    # The burger uses 150 g of beef: +10 % on ₡6/g → +₡90
    assert D(product["delta"]) == D("90")
    assert D(product["cost_after"]) == D("1420")
    uber = product["channels"][1]
    assert D(uber["margin_after"]) == D(uber["margin_before"]) - D("90")
    assert uber["status_after"] == "bad"


def test_simulation_with_unrelated_supply_affects_nothing(client, setup):  # noqa: F811
    create_product(client, setup)
    other = supply(client, "Sin uso", "1", "kg", "100")
    result = client.post(
        "/api/simulate",
        json={
            "changes": [{"supply_id": other["id"], "change_rate": "0.5"}],
        },
    ).json()
    assert result["recipes"] == []
    assert result["products"] == []


@pytest.mark.parametrize(
    "payload",
    [
        {"changes": []},
        {"changes": [{"supply_id": 999, "change_rate": "0.1"}]},
        {"changes": [{"supply_id": 1, "change_rate": "-1"}]},
    ],
)
def test_simulation_validation(client, payload):
    assert client.post("/api/simulate", json=payload).status_code == 422


def test_csv_exports(client, setup):  # noqa: F811
    create_product(client, setup)

    products = client.get("/api/export/productos.csv")
    assert products.status_code == 200
    assert products.headers["content-type"].startswith("text/csv")
    assert "attachment" in products.headers["content-disposition"]
    text = products.content.decode("utf-8")
    assert text.startswith("﻿Grupo;Producto;")
    assert "Hamburguesas;Hamburguesa clásica;Sí;Venta directa;4520,00;4000,00;1330,00" in text
    assert "Uber Eats" in text

    supplies = client.get("/api/export/suministros.csv").content.decode("utf-8")
    assert "Carne;;Otros;;1,000;kg;6000,00;6000,0000;kg" in supplies

    recipes = client.get("/api/export/recetas.csv").content.decode("utf-8")
    assert "Hamburguesas;Hamburguesa clásica;No;1,000;pz;1,00" in recipes

    assert client.get("/api/export/otra.csv").status_code == 404


@pytest.fixture
def backup_env(tmp_path, monkeypatch):
    db = tmp_path / "costeo.db"
    with sqlite3.connect(db) as conn:
        conn.execute("CREATE TABLE t (x INTEGER)")
        conn.execute("INSERT INTO t VALUES (42)")
    monkeypatch.setattr(settings, "database_url", f"sqlite:///{db}")
    monkeypatch.setattr(settings, "backup_dir", tmp_path / "backups")
    return tmp_path


def test_backups_create_list_download(client, backup_env):
    assert client.get("/api/backups").json() == []
    created = client.post("/api/backups")
    assert created.status_code == 201
    name = created.json()["name"]
    assert name.startswith("costeo-") and name.endswith(".db")

    assert [b["name"] for b in client.get("/api/backups").json()] == [name]

    download = client.get(f"/api/backups/{name}")
    assert download.status_code == 200
    copy = backup_env / "downloaded.db"
    copy.write_bytes(download.content)
    with sqlite3.connect(copy) as conn:
        assert conn.execute("SELECT x FROM t").fetchone() == (42,)


def test_backup_download_rejects_other_names(client, backup_env):
    assert client.get("/api/backups/..%2Fcosteo.db").status_code == 404
    assert client.get("/api/backups/costeo.db").status_code == 404
