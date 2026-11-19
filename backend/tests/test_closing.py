from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import SupplyPrice
from app.models.product import ProductItemRole
from app.services.closing import (
    ClosingError,
    ClosingInput,
    ExpenseLineIn,
    LaborLineIn,
    ProductLineIn,
    ProductSnapshot,
    build_report,
    validate_input,
)
from tests.factories import item, make_recipe, make_supply
from tests.test_prep_plan import make_product, product_line

D = Decimal


def snap(name, unit_cost, price=None, packaging="0", complete=True) -> ProductSnapshot:
    return ProductSnapshot(
        name=name,
        unit_cost=D(unit_cost),
        food_cost=D(unit_cost) - D(packaging),
        packaging_cost=D(packaging),
        unit_price=D(price) if price is not None else None,
        complete=complete,
    )


def report(data: ClosingInput, snapshots, vat="0.13", fee="0.02"):
    return build_report(data, snapshots, frozen=False, vat_rate=D(vat), bank_fee_rate=D(fee))


# --- Pure calculation ------------------------------------------------------------------------


def test_report_totals_and_rates():
    data = ClosingInput(
        billed_amount=D("113000"),
        vat_amount=D("13000"),
        bank_fee_amount=D("2000"),
        products=[ProductLineIn(1, 10), ProductLineIn(2, 20)],
        labor=[LaborLineIn("Ana", D("8"), D("2500")), LaborLineIn("Luis", D("4.5"), D("3000"))],
        expenses=[ExpenseLineIn("Aceite fritura", D("5000")), ExpenseLineIn("Luz", D("3000"))],
    )
    r = report(data, [snap("Combo", "2000", "6000", packaging="300"), snap("Soda", "500")])

    assert r.net_income == D("98000")
    assert r.products[0].total_cost == D("20000")
    assert r.product_cost == D("30000")
    assert r.packaging_cost == D("3000")
    assert r.food_cost == D("27000")
    assert r.labor[1].total == D("13500")
    assert r.labor_cost == D("33500")
    assert r.labor_hours == D("12.5")
    assert r.other_expenses == D("8000")
    assert r.total_expenses == D("71500")
    assert r.net_profit == D("26500")
    assert r.net_margin_rate == D("26500") / D("98000")
    assert r.food_cost_rate == D("30000") / D("98000")
    assert r.prime_cost_rate == D("63500") / D("98000")
    assert r.total_units == 30
    # Only the combo has a direct price: 10 × 6000.
    assert r.expected_billing == D("60000")
    assert r.billing_difference == D("53000")
    assert r.products_without_price == ["Soda"]
    assert r.complete is True
    assert r.warnings == []


def test_suggested_vat_and_fee_come_from_rates():
    r = report(ClosingInput(billed_amount=D("113000")), [])
    assert r.suggested_vat_amount == D("13000")
    assert r.suggested_bank_fee_amount == D("2260")
    # Hints only: nothing is subtracted unless typed.
    assert r.net_income == D("113000")


def test_rates_are_none_without_income_and_no_expected_billing_without_prices():
    r = report(ClosingInput(products=[ProductLineIn(1, 3)]), [snap("Soda", "500")])
    assert r.net_income == 0
    assert r.net_margin_rate is None and r.food_cost_rate is None
    assert r.expected_billing is None and r.billing_difference is None
    assert r.net_profit == D("-1500")


def test_incomplete_cost_is_flagged():
    r = report(ClosingInput(products=[ProductLineIn(1, 1)]), [snap("Combo", "0", complete=False)])
    assert r.complete is False
    assert r.warnings == ["«Combo» tiene costo incompleto."]


def test_deductions_above_billed_warn():
    r = report(ClosingInput(billed_amount=D("100"), vat_amount=D("200")), [])
    assert r.net_income == D("-100")
    assert "superan" in r.warnings[0]


def test_repeated_product_is_rejected():
    with pytest.raises(ClosingError):
        validate_input(ClosingInput(products=[ProductLineIn(1, 1), ProductLineIn(1, 2)]))


# --- API -------------------------------------------------------------------------------------


@pytest.fixture
def menu(session: Session) -> dict:
    cheese = make_supply(session, "Queso", "1", "kg", "10000")
    box = make_supply(session, "Caja", "10", "pz", "1000")
    recipe = make_recipe(session, "Burger", "1", "pz", [item(cheese, "100", "g")])
    burger = make_product(
        session,
        "Burger",
        recipe=recipe,
        lines=[product_line(box, "1", "pz", role=ProductItemRole.PACKAGING)],
    )
    burger.direct_price = D("5000")
    session.add(burger)
    session.commit()
    return {"cheese": cheese, "burger": burger}


def payload(product_id: int, **extra) -> dict:
    return {
        "name": "Sesión 1",
        "start_date": "2026-11-14",
        "end_date": "2026-11-15",
        "billed_amount": "56500",
        "vat_amount": "6500",
        "bank_fee_amount": "0",
        "products": [{"product_id": product_id, "units": 10}],
        "labor": [{"name": "Ana", "hours": "8", "hourly_rate": "2500"}],
        "expenses": [{"name": "Aceite fritura", "amount": "4000"}],
        **extra,
    }


def add_price(session: Session, supply, amount: str) -> None:
    session.add(SupplyPrice(supply_id=supply.id, amount=D(amount), purchased_on=date(2026, 11, 2)))
    session.commit()


def test_create_closing_reports_live_costs(client: TestClient, menu):
    res = client.post("/api/closings", json=payload(menu["burger"].id))
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["status"] == "draft"
    r = body["report"]
    # Burger: 100 g cheese (1000) + box (100) = 1100 per unit.
    assert r["products"][0]["unit_cost"] == "1100"
    assert r["products"][0]["packaging_cost"] == "100"
    assert D(r["net_income"]) == D("50000")
    assert D(r["product_cost"]) == D("11000")
    assert D(r["labor_cost"]) == D("20000")
    assert D(r["total_expenses"]) == D("35000")
    assert D(r["net_profit"]) == D("15000")
    assert D(r["expected_billing"]) == D("50000")
    assert r["frozen"] is False


def test_closing_freezes_costs_and_reopen_goes_live(client: TestClient, session: Session, menu):
    closing_id = client.post("/api/closings", json=payload(menu["burger"].id)).json()["id"]

    # Draft follows price changes (average of 2: 10000 and 20000 → 15000/kg).
    add_price(session, menu["cheese"], "20000")
    draft = client.get(f"/api/closings/{closing_id}").json()["report"]
    assert draft["products"][0]["unit_cost"] == "1600"

    closed = client.post(f"/api/closings/{closing_id}/close")
    assert closed.status_code == 200, closed.text
    assert closed.json()["status"] == "closed"
    assert closed.json()["closed_at"] is not None

    # A later price change and a rename don't touch the closed report.
    add_price(session, menu["cheese"], "40000")
    menu["burger"].name = "Burger renombrada"
    session.add(menu["burger"])
    session.commit()
    frozen = client.get(f"/api/closings/{closing_id}").json()["report"]
    assert frozen["frozen"] is True
    assert frozen["products"][0]["unit_cost"] == "1600"
    assert frozen["products"][0]["name"] == "Burger"

    assert (
        client.put(f"/api/closings/{closing_id}", json=payload(menu["burger"].id)).status_code
        == 409
    )
    assert client.post(f"/api/closings/{closing_id}/close").status_code == 409

    reopened = client.post(f"/api/closings/{closing_id}/reopen").json()
    assert reopened["status"] == "draft"
    assert reopened["closed_at"] is None
    # avg of 10000, 20000, 40000 = 23333.33…/kg → 2333.33… + 100
    assert D(reopened["report"]["products"][0]["unit_cost"]).quantize(D("0.01")) == D("2433.33")
    assert reopened["report"]["products"][0]["name"] == "Burger renombrada"
    assert client.post(f"/api/closings/{closing_id}/reopen").status_code == 409


def test_update_replaces_lines(client: TestClient, menu):
    closing_id = client.post("/api/closings", json=payload(menu["burger"].id)).json()["id"]
    res = client.put(
        f"/api/closings/{closing_id}",
        json=payload(menu["burger"].id, name="Sesión 1b", labor=[], expenses=[]),
    )
    assert res.status_code == 200, res.text
    assert res.json()["name"] == "Sesión 1b"
    assert res.json()["labor"] == [] and res.json()["expenses"] == []


def test_invalid_closings(client: TestClient, menu):
    pid = menu["burger"].id
    repeated = payload(pid, products=[{"product_id": pid, "units": 1}] * 2)
    assert client.post("/api/closings", json=repeated).status_code == 422
    unknown = payload(pid, products=[{"product_id": 999, "units": 1}])
    assert client.post("/api/closings", json=unknown).status_code == 422
    backwards = payload(pid, start_date="2026-11-16")
    assert client.post("/api/closings", json=backwards).status_code == 422
    bad_collab = payload(
        pid, labor=[{"collaborator_id": 99, "name": "X", "hours": "1", "hourly_rate": "1"}]
    )
    assert client.post("/api/closings", json=bad_collab).status_code == 422

    empty = client.post("/api/closings", json=payload(pid, products=[])).json()
    res = client.post(f"/api/closings/{empty['id']}/close")
    assert res.status_code == 422
    assert "producto" in res.json()["detail"]


def test_preview_does_not_store(client: TestClient, menu):
    body = payload(menu["burger"].id)
    del body["name"], body["start_date"], body["end_date"]
    res = client.post("/api/closings/preview", json=body)
    assert res.status_code == 200, res.text
    assert D(res.json()["net_profit"]) == D("15000")
    assert client.get("/api/closings").json() == []


def test_retention_deletes_oldest_by_end_date(client: TestClient, menu):
    assert client.patch("/api/settings", json={"closings_to_keep": 2}).status_code == 200
    pid = menu["burger"].id
    newer = client.post(
        "/api/closings", json=payload(pid, name="B", start_date="2026-11-20", end_date="2026-11-21")
    ).json()
    older = client.post("/api/closings", json=payload(pid, name="A")).json()

    retention = client.get("/api/closings/retention").json()
    assert retention["keep"] == 2 and retention["count"] == 2
    assert [c["id"] for c in retention["will_delete"]] == [older["id"]]

    client.post(
        "/api/closings", json=payload(pid, name="C", start_date="2026-11-28", end_date="2026-11-29")
    )
    names = [c["name"] for c in client.get("/api/closings").json()]
    assert names == ["C", "B"]  # newest first
    assert client.get(f"/api/closings/{newer['id']}").status_code == 200
    assert client.get(f"/api/closings/{older['id']}").status_code == 404

    assert client.patch("/api/settings", json={"closings_to_keep": 0}).status_code == 422


def test_catalogs_and_name_snapshot(client: TestClient, menu):
    ana = client.post("/api/collaborators", json={"name": "Ana", "hourly_rate": "2500"})
    assert ana.status_code == 201
    assert client.post("/api/collaborators", json={"name": "Ana"}).status_code == 409
    oil = client.post("/api/expense-types", json={"name": "Aceite fritura"}).json()
    assert oil["last_amount"] is None
    assert client.post("/api/expense-types", json={"name": "Aceite fritura"}).status_code == 409

    ana_id = ana.json()["id"]
    body = payload(
        menu["burger"].id,
        labor=[{"collaborator_id": ana_id, "name": "Ana", "hours": "6", "hourly_rate": "3000"}],
        expenses=[{"expense_type_id": oil["id"], "name": "Aceite fritura", "amount": "4500"}],
    )
    closing_id = client.post("/api/closings", json=body).json()["id"]
    types = client.get("/api/expense-types").json()
    assert types[0]["last_amount"] == "4500"

    # While a draft, saving follows a rename of the collaborator.
    client.patch(f"/api/collaborators/{ana_id}", json={"name": "Ana María"})
    detail = client.put(f"/api/closings/{closing_id}", json=body).json()
    assert detail["labor"][0]["name"] == "Ana María"
    # The line keeps its own rate, not the collaborator's default.
    assert detail["report"]["labor"][0]["total"] == "18000"

    # Deleting catalog entries keeps the closing lines.
    assert client.delete(f"/api/collaborators/{ana_id}").status_code == 204
    assert client.delete(f"/api/expense-types/{oil['id']}").status_code == 204
    detail = client.get(f"/api/closings/{closing_id}").json()
    assert detail["labor"][0] == {
        "collaborator_id": None,
        "name": "Ana María",
        "hours": "6",
        "hourly_rate": "3000",
    }
    assert detail["expenses"][0]["expense_type_id"] is None


def test_product_in_closing_cannot_be_deleted(client: TestClient, menu):
    client.post("/api/closings", json=payload(menu["burger"].id))
    res = client.delete(f"/api/products/{menu['burger'].id}")
    assert res.status_code == 409
    assert "cierre" in res.json()["detail"]


def test_export_csv(client: TestClient, menu):
    closing_id = client.post("/api/closings", json=payload(menu["burger"].id)).json()["id"]
    res = client.get(f"/api/closings/{closing_id}/export.csv")
    assert res.status_code == 200
    assert "badger-cierre-sesion-1-20261115.csv" in res.headers["content-disposition"]
    text = res.content.decode("utf-8-sig")
    assert text.startswith("Sección;Concepto;Cantidad;Unitario;Total")
    assert "Resultado;Ganancia neta;;;15000,00" in text
    assert "Productos;Burger;10;1100,00;11000,00" in text


def test_ids_are_not_reused_after_delete(client: TestClient, menu):
    """Retention deletes closings; an old report link must not open a different closing."""
    first = client.post("/api/closings", json=payload(menu["burger"].id)).json()["id"]
    second = client.post("/api/closings", json=payload(menu["burger"].id)).json()["id"]
    client.delete(f"/api/closings/{second}")
    third = client.post("/api/closings", json=payload(menu["burger"].id)).json()["id"]
    assert third > second > first
