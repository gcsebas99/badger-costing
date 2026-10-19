"""What needs attention: products to re-price, supply price increases, incomplete costing."""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.models.recipe import Recipe
from app.models.supply import Supply
from app.services.pricing import AlertLevel
from app.services.product_pricing import PricingContext, load_products, pricing_input
from app.services.supply_cost import sort_newest_first


def _pct(rate: Decimal) -> str:
    """0.377 → "37,7 %" for messages."""
    return f"{rate * 100:.1f}".replace(".", ",") + " %"


@dataclass
class ProductAlert:
    id: int
    name: str
    menu_group_name: str
    status: AlertLevel
    total_cost: Decimal
    worst_margin_rate: Decimal | None
    worst_channel: str | None
    reasons: list[str]


@dataclass
class PriceIncrease:
    supply_id: int
    name: str
    previous_price: Decimal
    latest_price: Decimal
    change_rate: Decimal
    latest_date: date
    previous_date: date


@dataclass
class IncompleteItem:
    kind: str  # "recipe" | "product"
    id: int
    name: str
    issues: list[str]


@dataclass
class DashboardData:
    active_products: int
    products_below_margin: int
    incomplete_count: int
    supplies_without_price: int
    products_to_review: list[ProductAlert]
    price_increases: list[PriceIncrease]
    incomplete: list[IncompleteItem]
    unpriced_supplies: list[tuple[int, str]]


def build_dashboard(session: Session, increases_limit: int = 8) -> DashboardData:
    ctx = PricingContext(session)
    products = load_products(session, active=True)

    alerts: list[ProductAlert] = []
    incomplete: list[IncompleteItem] = []
    below_margin = 0
    for product in products:
        pricing = ctx.price(pricing_input(product))
        reasons: list[str] = []
        for channel in pricing.channels:
            if channel.margin_status == AlertLevel.BAD:
                rate = _pct(channel.margin_rate) if channel.margin_rate is not None else "—"
                reasons.append(
                    f"Margen {rate} en {channel.name} "
                    f"(mínimo {_pct(ctx.settings.margin_alert_rate)})."
                )
            if channel.food_cost_status != AlertLevel.OK and channel.food_cost_rate is not None:
                reasons.append(
                    f"Food cost {_pct(channel.food_cost_rate)} en {channel.name} "
                    f"(objetivo {_pct(pricing.target_food_cost_rate)})."
                )
        if any(c.margin_status == AlertLevel.BAD for c in pricing.channels):
            below_margin += 1
        if pricing.deviation is not None and pricing.deviation_status != AlertLevel.OK:
            sign = "+" if pricing.deviation > 0 else ""
            reasons.append(f"Costo {sign}{_pct(pricing.deviation)} vs. el teórico.")
        if not pricing.cost.complete:
            reasons.append("Costo incompleto.")
            incomplete.append(
                IncompleteItem("product", product.id, product.name, pricing.cost.issues)
            )
        if not pricing.channels:
            reasons.append("Sin precio de venta.")
        if pricing.status != AlertLevel.OK or not pricing.channels:
            rated = [c for c in pricing.channels if c.margin_rate is not None]
            worst = min(rated, key=lambda c: c.margin_rate, default=None)
            alerts.append(
                ProductAlert(
                    id=product.id,
                    name=product.name,
                    menu_group_name=ctx.groups[product.menu_group_id].name,
                    status=pricing.status if pricing.channels else AlertLevel.WARN,
                    total_cost=pricing.cost.total_cost,
                    worst_margin_rate=worst.margin_rate if worst else None,
                    worst_channel=worst.name if worst else None,
                    reasons=reasons,
                )
            )
    order = {AlertLevel.BAD: 0, AlertLevel.WARN: 1, AlertLevel.OK: 2}
    alerts.sort(
        key=lambda a: (
            order[a.status],
            a.worst_margin_rate if a.worst_margin_rate is not None else Decimal(99),
        )
    )

    for recipe in session.exec(select(Recipe).order_by(Recipe.name)).all():
        cost = ctx.costing.recipe_cost(recipe.id)
        if not cost.complete:
            issues = [f"{i.name}: {i.message}" for i in cost.items if i.message]
            incomplete.insert(0, IncompleteItem("recipe", recipe.id, recipe.name, issues))

    supplies = session.exec(
        select(Supply).where(Supply.active == True).options(selectinload(Supply.prices))  # noqa: E712
    ).all()
    increases: list[PriceIncrease] = []
    unpriced: list[tuple[int, str]] = []
    for supply in supplies:
        prices = sort_newest_first(supply.prices)
        if not prices:
            unpriced.append((supply.id, supply.name))
            continue
        if len(prices) >= 2 and prices[1].amount > 0 and prices[0].amount > prices[1].amount:
            latest, previous = prices[0], prices[1]
            increases.append(
                PriceIncrease(
                    supply_id=supply.id,
                    name=supply.name,
                    previous_price=previous.amount,
                    latest_price=latest.amount,
                    change_rate=latest.amount / previous.amount - 1,
                    latest_date=latest.purchased_on,
                    previous_date=previous.purchased_on,
                )
            )
    increases.sort(key=lambda i: i.change_rate, reverse=True)

    return DashboardData(
        active_products=len(products),
        products_below_margin=below_margin,
        incomplete_count=len(incomplete),
        supplies_without_price=len(unpriced),
        products_to_review=alerts,
        price_increases=increases[:increases_limit],
        incomplete=incomplete,
        unpriced_supplies=sorted(unpriced, key=lambda s: s[1].casefold()),
    )
