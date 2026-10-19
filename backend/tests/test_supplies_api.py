from decimal import Decimal

import pytest

OLIVE_OIL = {
    "name": "Aceite de oliva",
    "brand": "Kirkland",
    "group": "Abarrotes",
    "supplier": "CostCo",
    "pack_qty": "6",
    "pack_unit": "L",
}


def create(client, **overrides):
    response = client.post("/api/supplies", json={**OLIVE_OIL, **overrides})
    assert response.status_code == 201, response.text
    return response.json()


def test_create_supply_with_initial_price(client):
    body = create(client, initial_price={"amount": "1300", "purchased_on": "2026-10-01"})

    assert body["base_unit"] == "ml"
    assert body["reference_unit"] == "L"
    assert Decimal(body["current_price"]) == Decimal("1300")
    assert round(Decimal(body["reference_unit_cost"]), 2) == Decimal("216.67")
    assert body["last_price_date"] == "2026-10-01"
    assert body["price_count"] == 1
    assert body["prices"][0]["supplier"] == "CostCo"  # defaults to the supply's supplier
    assert body["prices"][0]["in_effect"] is True


def test_create_supply_without_price_has_no_cost(client):
    body = create(client)
    assert body["current_price"] is None
    assert body["unit_cost"] is None
    assert body["prices"] == []


def test_money_is_serialized_as_strings(client):
    body = create(client, initial_price={"amount": 1300.5})
    assert body["current_price"] == "1300.5"
    assert body["pack_qty"] == "6"


@pytest.mark.parametrize(
    "overrides",
    [{"name": ""}, {"pack_qty": "0"}, {"pack_unit": "taza"}, {"group": "  "}],
)
def test_create_supply_validation(client, overrides):
    response = client.post("/api/supplies", json={**OLIVE_OIL, **overrides})
    assert response.status_code == 422


def test_blank_optional_text_becomes_null(client):
    body = create(client, brand="  ", notes="")
    assert body["brand"] is None
    assert body["notes"] is None


def test_add_prices_updates_current_cost_with_average_of_last_three(client):
    supply = create(client, initial_price={"amount": "1000", "purchased_on": "2026-09-01"})
    url = f"/api/supplies/{supply['id']}/prices"
    client.post(url, json={"amount": "100", "purchased_on": "2026-10-01"})
    client.post(url, json={"amount": "200", "purchased_on": "2026-10-02"})
    body = client.post(url, json={"amount": "300", "purchased_on": "2026-10-03"}).json()

    assert Decimal(body["current_price"]) == Decimal("200")
    assert body["price_count"] == 4
    assert [p["amount"] for p in body["prices"]] == ["300", "200", "100", "1000"]
    assert [p["in_effect"] for p in body["prices"]] == [True, True, True, False]


def test_two_prices_average_of_two(client):
    supply = create(client, initial_price={"amount": "100", "purchased_on": "2026-10-01"})
    body = client.post(
        f"/api/supplies/{supply['id']}/prices", json={"amount": "200", "purchased_on": "2026-10-02"}
    ).json()
    assert Decimal(body["current_price"]) == Decimal("150")


def test_latest_cost_mode_setting(client):
    supply = create(client, initial_price={"amount": "100", "purchased_on": "2026-10-01"})
    client.post(
        f"/api/supplies/{supply['id']}/prices", json={"amount": "200", "purchased_on": "2026-10-02"}
    )
    assert (
        client.patch("/api/settings", json={"cost_mode": "latest"}).json()["cost_mode"] == "latest"
    )

    body = client.get(f"/api/supplies/{supply['id']}").json()
    assert Decimal(body["current_price"]) == Decimal("200")
    assert [p["in_effect"] for p in body["prices"]] == [True, False]


def test_delete_price(client):
    supply = create(client, initial_price={"amount": "100", "purchased_on": "2026-10-01"})
    price_id = supply["prices"][0]["id"]

    body = client.delete(f"/api/supplies/{supply['id']}/prices/{price_id}").json()
    assert body["prices"] == []
    assert body["current_price"] is None

    missing = client.delete(f"/api/supplies/{supply['id']}/prices/{price_id}")
    assert missing.status_code == 404


def test_update_supply_fields(client):
    supply = create(client, initial_price={"amount": "1300"})
    body = client.patch(
        f"/api/supplies/{supply['id']}", json={"pack_qty": "5", "active": False}
    ).json()

    assert body["active"] is False
    assert round(Decimal(body["reference_unit_cost"]), 2) == Decimal("260.00")
    assert body["name"] == OLIVE_OIL["name"]


def test_update_rejects_null_required_field(client):
    supply = create(client)
    response = client.patch(f"/api/supplies/{supply['id']}", json={"name": None})
    assert response.status_code == 422


def test_equivalence_create_update_remove(client):
    egg = create(
        client,
        name="Huevo",
        pack_qty="30",
        pack_unit="pz",
        equivalence={"quantity": "50", "unit": "g"},
    )
    assert egg["equivalence"] == {"quantity": "50", "unit": "g"}

    url = f"/api/supplies/{egg['id']}"
    updated = client.patch(url, json={"equivalence": {"quantity": "55", "unit": "g"}}).json()
    assert updated["equivalence"] == {"quantity": "55", "unit": "g"}

    untouched = client.patch(url, json={"brand": "Kikiriki"}).json()
    assert untouched["equivalence"] == {"quantity": "55", "unit": "g"}

    removed = client.patch(url, json={"equivalence": None}).json()
    assert removed["equivalence"] is None


def test_equivalence_must_be_mass_or_volume(client):
    response = client.post(
        "/api/supplies", json={**OLIVE_OIL, "equivalence": {"quantity": "1", "unit": "pz"}}
    )
    assert response.status_code == 422


def test_list_filters_and_accent_insensitive_search(client):
    create(client, name="Orégano seco", group="Secos y granos", supplier="Fruza")
    create(client, name="Queso mozzarella", group="Lácteos y huevos", supplier="Mexideli")
    create(client, name="Albahaca", group="Frutas y verduras", supplier="Fruza", active=False)

    def names(**params):
        return [s["name"] for s in client.get("/api/supplies", params=params).json()]

    assert names() == ["Albahaca", "Orégano seco", "Queso mozzarella"]
    assert names(q="oregano") == ["Orégano seco"]
    assert names(q="QUESO") == ["Queso mozzarella"]
    assert names(supplier="Fruza") == ["Albahaca", "Orégano seco"]
    assert names(group="Lácteos y huevos") == ["Queso mozzarella"]
    assert names(active=True) == ["Orégano seco", "Queso mozzarella"]
    assert names(active=False) == ["Albahaca"]


def test_search_matches_brand(client):
    create(client)
    assert len(client.get("/api/supplies", params={"q": "kirk"}).json()) == 1


def test_facets_include_defaults_and_used_values(client):
    create(client, group="Grupo propio", supplier="Proveedor A")
    facets = client.get("/api/supplies/facets").json()

    assert "Abarrotes" in facets["groups"]
    assert "Grupo propio" in facets["groups"]
    assert facets["suppliers"] == ["Proveedor A"]


def test_delete_supply_removes_prices(client, session):
    supply = create(client, initial_price={"amount": "100"})
    assert client.delete(f"/api/supplies/{supply['id']}").status_code == 204
    assert client.get(f"/api/supplies/{supply['id']}").status_code == 404

    from sqlmodel import select

    from app.models import SupplyPrice

    assert session.exec(select(SupplyPrice)).all() == []


def test_unknown_supply_returns_404(client):
    assert client.get("/api/supplies/999").status_code == 404
    assert client.patch("/api/supplies/999", json={"name": "x"}).status_code == 404
