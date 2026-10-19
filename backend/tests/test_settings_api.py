def test_settings_defaults(client):
    assert client.get("/api/settings").json() == {
        "cost_mode": "average_last_3",
        "vat_rate": "0.13",
        "bank_fee_rate": "0",
        "margin_alert_rate": "0.4",
        "target_food_cost_rate": "0.3",
        "deviation_upper_rate": "0.05",
        "deviation_lower_rate": "-0.1",
    }


def test_update_settings_partially(client):
    body = client.patch("/api/settings", json={"bank_fee_rate": "0.021", "vat_rate": 0.13}).json()
    assert body["bank_fee_rate"] == "0.021"
    assert body["margin_alert_rate"] == "0.4"


def test_settings_validation(client):
    assert client.patch("/api/settings", json={"vat_rate": "1.5"}).status_code == 422
    assert client.patch("/api/settings", json={"target_food_cost_rate": "0"}).status_code == 422
    assert client.patch("/api/settings", json={"deviation_lower_rate": "0.1"}).status_code == 422


def test_platform_crud(client):
    created = client.post("/api/platforms", json={"name": "Uber Eats", "fee_rate": "0.3"})
    assert created.status_code == 201
    platform = created.json()

    duplicate = client.post("/api/platforms", json={"name": "Uber Eats", "fee_rate": "0.2"})
    assert duplicate.status_code == 409

    updated = client.patch(f"/api/platforms/{platform['id']}", json={"fee_rate": "0.28"}).json()
    assert updated["fee_rate"] == "0.28"
    assert [p["name"] for p in client.get("/api/platforms").json()] == ["Uber Eats"]
    assert client.delete(f"/api/platforms/{platform['id']}").status_code == 204
    assert client.get("/api/platforms").json() == []


def test_menu_group_crud(client):
    group = client.post("/api/menu-groups", json={"name": "Hamburguesas"}).json()
    assert group["target_food_cost_rate"] is None
    assert group["product_count"] == 0

    url = f"/api/menu-groups/{group['id']}"
    assert (
        client.patch(url, json={"target_food_cost_rate": "0.32"}).json()["target_food_cost_rate"]
        == "0.32"
    )
    # null resets to "use the default"
    assert (
        client.patch(url, json={"target_food_cost_rate": None}).json()["target_food_cost_rate"]
        is None
    )
    assert client.post("/api/menu-groups", json={"name": "Hamburguesas"}).status_code == 409
    assert client.delete(url).status_code == 204
