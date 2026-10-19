"""CSV exports that open cleanly in Excel set to Spanish: UTF-8 BOM, ";" separator, "," decimals."""

import csv
import io
from collections.abc import Iterable, Sequence
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.models.recipe import Recipe
from app.models.supply import Supply
from app.services.product_pricing import PricingContext, load_products, pricing_input
from app.services.settings import get_settings
from app.services.supply_cost import supply_cost
from app.services.text import fold


def number(value: Decimal | None, decimals: int = 2) -> str:
    if value is None:
        return ""
    quantum = Decimal(1).scaleb(-decimals)
    return format(value.quantize(quantum, rounding=ROUND_HALF_UP), "f").replace(".", ",")


def to_csv(header: Sequence[str], rows: Iterable[Sequence[object]]) -> str:
    buffer = io.StringIO()
    buffer.write("﻿")  # BOM so Excel detects UTF-8 (accents, ₡)
    writer = csv.writer(buffer, delimiter=";", lineterminator="\r\n")
    writer.writerow(header)
    writer.writerows(rows)
    return buffer.getvalue()


def supplies_csv(session: Session) -> str:
    mode = get_settings(session).cost_mode
    supplies = session.exec(select(Supply).options(selectinload(Supply.prices))).all()
    rows = []
    for s in sorted(supplies, key=lambda s: fold(s.name)):
        cost = supply_cost(s.pack_qty, s.pack_unit, s.prices, mode)
        rows.append(
            [
                s.name,
                s.brand or "",
                s.group,
                s.supplier or "",
                number(s.pack_qty, 3),
                s.pack_unit,
                number(cost.pack_price),
                number(cost.reference_unit_cost, 4),
                cost.reference_unit,
                cost.last_price_date.isoformat() if cost.last_price_date else "",
                "Sí" if s.active else "No",
            ]
        )
    return to_csv(
        [
            "Suministro",
            "Marca",
            "Grupo",
            "Proveedor",
            "Cantidad empaque",
            "Unidad",
            "Costo empaque",
            "Costo unitario",
            "Por",
            "Último precio",
            "Activo",
        ],
        rows,
    )


def recipes_csv(session: Session) -> str:
    ctx = PricingContext(session)
    recipes = session.exec(select(Recipe)).all()
    rows = []
    for r in sorted(recipes, key=lambda r: (fold(r.category), fold(r.name))):
        cost = ctx.costing.recipe_cost(r.id)
        rows.append(
            [
                r.category,
                r.name,
                "Sí" if r.is_subrecipe else "No",
                number(r.yield_qty, 3),
                r.yield_unit,
                number(r.portions, 2),
                number(cost.ingredients_cost),
                number(cost.safety_margin_cost),
                number(cost.total_cost),
                number(cost.cost_per_reference_unit, 4),
                cost.reference_unit,
                number(cost.cost_per_portion),
                "Sí" if cost.complete else "No",
            ]
        )
    return to_csv(
        [
            "Categoría",
            "Receta",
            "Sub-receta",
            "Rendimiento",
            "Unidad",
            "Porciones",
            "Costo ingredientes",
            "Margen de seguridad",
            "Costo total",
            "Costo unitario",
            "Por",
            "Costo por porción",
            "Completa",
        ],
        rows,
    )


def products_csv(session: Session) -> str:
    """One row per product and channel, like the "Análisis Coste Platos" sheet."""
    ctx = PricingContext(session)
    products = load_products(session)

    def sort_key(p):
        group = ctx.groups[p.menu_group_id]
        return (group.position, fold(group.name), fold(p.name))

    rows = []
    for p in sorted(products, key=sort_key):
        pricing = ctx.price(pricing_input(p))
        base = [ctx.groups[p.menu_group_id].name, p.name, "Sí" if p.active else "No"]
        tail = [
            number(pricing.suggested_price),
            number(pricing.target_cost),
            number(pricing.deviation * 100 if pricing.deviation is not None else None, 1),
        ]
        if not pricing.channels:
            rows.append([*base, "", "", "", number(pricing.cost.total_cost), "", "", "", "", *tail])
        for c in pricing.channels:
            rows.append(
                [
                    *base,
                    c.name,
                    number(c.price),
                    number(c.price_ex_vat),
                    number(c.cost),
                    number(c.food_cost_rate * 100 if c.food_cost_rate is not None else None, 1),
                    number(c.fee),
                    number(c.margin),
                    number(c.margin_rate * 100 if c.margin_rate is not None else None, 1),
                    *tail,
                ]
            )
    return to_csv(
        [
            "Grupo",
            "Producto",
            "Activo",
            "Canal",
            "PVP",
            "Precio sin IVA",
            "Costo",
            "% Costo",
            "Comisión",
            "Margen",
            "% Margen",
            "Precio sugerido",
            "Costo teórico",
            "% Desviación",
        ],
        rows,
    )
