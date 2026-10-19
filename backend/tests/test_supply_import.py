from datetime import date
from decimal import Decimal

import pytest
from openpyxl import Workbook
from sqlmodel import select

from app.models import Supply
from app.services.supply_import import ImportFormatError, apply_import, parse_workbook
from app.services.units import Unit

HEADERS = [
    None,
    "Producto",
    "Marca comercial",
    "Formato de compra",
    "Unidad de medida",
    "Unidad de compra",
    "Coste medio de compra",
    "Grupo",
    "Proveedor",
    "Precio 1",
    "Precio 2",
    "Precio 3",
]


def make_workbook(tmp_path, rows, sheet="Base Datos Productos"):
    wb = Workbook()
    ws = wb.active
    ws.title = sheet
    ws.append([None, "BASE DE DATOS DE PRODUCTOS"])
    ws.append(HEADERS)
    for row in rows:
        ws.append([None, *row])
    path = tmp_path / "costeo.xlsx"
    wb.save(path)
    return path


SAMPLE_ROWS = [
    ["Aceite de oliva suave ", "Kirkland", 6, "L", "pz", 1300, "Abarrotes", "CostCo", 1300],
    [
        "Queso mozarella",
        "Zanetti",
        1.36,
        "kg ",
        "pz",
        350,
        "Lácteos y huevos",
        "Mexideli",
        331.12,
        350,
        368.88,
    ],
    ["Sticker logo", None, 500, "pz", "pz", None, "Desechables", None],
    ["Masa de pizza", None, 1, "kg", "kg", 5.86, "Subrecetas", None, 5.86],
    ["Vinagre", None, None, None, None, " ", None, None],
    ["Sal", "La Fina", 5, "taza", "pz", 100, "Secos y granos", "Soriana", 100],
    [None, None, None, None, None, None, None, None],
]


def test_parse_workbook(tmp_path):
    plan = parse_workbook(make_workbook(tmp_path, SAMPLE_ROWS))

    names = [r.name for r in plan.rows]
    assert names == ["Aceite de oliva suave", "Queso mozarella", "Sticker logo"]
    oil, cheese, sticker = plan.rows
    assert (oil.pack_qty, oil.pack_unit, oil.prices) == (Decimal(6), Unit.L, [Decimal(1300)])
    assert cheese.pack_qty == Decimal("1.36")  # no float noise
    assert cheese.pack_unit == Unit.KG
    assert cheese.prices == [Decimal("331.12"), Decimal(350), Decimal("368.88")]
    assert sticker.prices == []
    assert sticker.brand is None

    reasons = {s.name: s.reason for s in plan.skipped}
    assert set(reasons) == {"Masa de pizza", "Vinagre", "Sal"}
    assert "sub-receta" in reasons["Masa de pizza"]
    assert "taza" in reasons["Sal"]


def test_parse_rejects_wrong_sheet(tmp_path):
    path = make_workbook(tmp_path, SAMPLE_ROWS, sheet="Otra")
    with pytest.raises(ImportFormatError, match="no existe"):
        parse_workbook(path)


def test_apply_import_creates_supplies_and_skips_existing(tmp_path, session):
    plan = parse_workbook(make_workbook(tmp_path, SAMPLE_ROWS))

    first = apply_import(session, plan, date(2026, 10, 1))
    assert len(first.created) == 3

    cheese = session.exec(select(Supply).where(Supply.name == "Queso mozarella")).one()
    assert [p.amount for p in sorted(cheese.prices, key=lambda p: p.id)] == [
        Decimal("331.12"),
        Decimal(350),
        Decimal("368.88"),
    ]
    assert {p.purchased_on for p in cheese.prices} == {date(2026, 10, 1)}

    second = apply_import(session, plan, date(2026, 10, 2))
    assert second.created == []
    assert len(second.existing) == 3
    assert len(session.exec(select(Supply)).all()) == 3


def test_imported_supply_cost_via_api(tmp_path, session, client):
    apply_import(session, parse_workbook(make_workbook(tmp_path, SAMPLE_ROWS)), date(2026, 10, 1))
    cheese = next(s for s in client.get("/api/supplies").json() if s["name"] == "Queso mozarella")
    assert Decimal(cheese["current_price"]) == Decimal(350)
