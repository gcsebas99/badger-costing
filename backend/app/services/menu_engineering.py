"""Menu engineering (Kasavana & Smith, as in the costing template's "Menú Engineering" sheet).

Per menu group:
  popularity     = units of the item / units of the group;   HIGH if ≥ 1 / number of items
  unit margin    = weighted average over the channels it sold on of (price ex VAT − cost − fee)
  margin class   HIGH if unit margin ≥ the group's weighted average margin (total margin / units)

  HIGH popularity + HIGH margin → star       (Estrella)
  HIGH popularity + LOW margin  → plowhorse  (Caballo; "Vaca" in the template)
  LOW popularity  + HIGH margin → puzzle
  LOW popularity  + LOW margin  → dog        (Perro)

Costs and prices are today's (they're computed live, not stored per period). Unlike the template,
the margin subtracts the channel fee, consistent with the rest of the app.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from decimal import Decimal
from enum import StrEnum

from sqlmodel import Session, select

from app.models.sales import SalesEntry
from app.services.product_pricing import PricingContext, load_products, pricing_input


class MenuClass(StrEnum):
    STAR = "star"
    PLOWHORSE = "plowhorse"
    PUZZLE = "puzzle"
    DOG = "dog"


@dataclass
class MenuItem:
    product_id: int
    name: str
    units: int
    popularity: Decimal
    high_popularity: bool
    unit_margin: Decimal | None  # None: sold only on channels without a price
    total_margin: Decimal | None
    high_margin: bool | None
    classification: MenuClass | None
    unpriced_units: int = 0  # units sold on a channel that has no price for this product


@dataclass
class MenuGroupAnalysis:
    menu_group_id: int
    menu_group_name: str
    item_count: int
    total_units: int
    popularity_threshold: Decimal
    total_margin: Decimal
    average_margin: Decimal | None
    items: list[MenuItem] = field(default_factory=list)


def classify(high_popularity: bool, high_margin: bool) -> MenuClass:
    if high_popularity:
        return MenuClass.STAR if high_margin else MenuClass.PLOWHORSE
    return MenuClass.PUZZLE if high_margin else MenuClass.DOG


def analyze_period(session: Session, period_id: int) -> list[MenuGroupAnalysis]:
    ctx = PricingContext(session)
    entries = session.exec(select(SalesEntry).where(SalesEntry.period_id == period_id)).all()
    units_by_product: dict[int, dict[int | None, int]] = defaultdict(dict)
    for entry in entries:
        units_by_product[entry.product_id][entry.platform_id] = entry.units

    # Active products, plus inactive ones that still have sales in this period.
    products = [p for p in load_products(session) if p.active or units_by_product.get(p.id)]

    by_group: dict[int, list] = defaultdict(list)
    for product in products:
        pricing = ctx.price(pricing_input(product))
        margins = {c.platform_id: c.margin for c in pricing.channels}
        sold = units_by_product.get(product.id, {})
        units = sum(sold.values())
        priced_units = sum(u for channel, u in sold.items() if channel in margins)
        total_margin = sum(
            (margins[channel] * u for channel, u in sold.items() if channel in margins),
            Decimal(0),
        )
        if priced_units:
            unit_margin = total_margin / priced_units
        else:  # no priced sales: rate it by its direct-sale margin (or its first channel's)
            unit_margin = margins.get(None, next(iter(margins.values()), None))
        by_group[product.menu_group_id].append(
            (
                product,
                units,
                unit_margin,
                total_margin if priced_units else None,
                units - priced_units,
            )
        )

    analyses = []
    for group_id, rows in by_group.items():
        group = ctx.groups[group_id]
        total_units = sum(r[1] for r in rows)
        threshold = Decimal(1) / len(rows)
        group_margin = sum((r[3] for r in rows if r[3] is not None), Decimal(0))
        margin_units = sum(r[1] - r[4] for r in rows if r[3] is not None)
        average = group_margin / margin_units if margin_units else None
        items = []
        for product, units, unit_margin, total_margin, unpriced in rows:
            popularity = Decimal(units) / total_units if total_units else Decimal(0)
            high_pop = total_units > 0 and popularity >= threshold
            high_margin = None if unit_margin is None or average is None else unit_margin >= average
            items.append(
                MenuItem(
                    product_id=product.id,
                    name=product.name,
                    units=units,
                    popularity=popularity,
                    high_popularity=high_pop,
                    unit_margin=unit_margin,
                    total_margin=total_margin,
                    high_margin=high_margin,
                    classification=(
                        classify(high_pop, high_margin) if high_margin is not None else None
                    ),
                    unpriced_units=unpriced,
                )
            )
        items.sort(key=lambda i: (-i.units, i.name.casefold()))
        analyses.append(
            MenuGroupAnalysis(
                menu_group_id=group_id,
                menu_group_name=group.name,
                item_count=len(rows),
                total_units=total_units,
                popularity_threshold=threshold,
                total_margin=group_margin,
                average_margin=average,
                items=items,
            )
        )
    analyses.sort(key=lambda a: (ctx.groups[a.menu_group_id].position, a.menu_group_name))
    return analyses
