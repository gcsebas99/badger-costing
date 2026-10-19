"""What-if: change some supplies' cost by a % and see which recipes and products move."""

from dataclasses import dataclass
from decimal import Decimal

from sqlmodel import Session, select

from app.models.recipe import Recipe
from app.models.supply import Supply
from app.services.pricing import AlertLevel
from app.services.product_pricing import PricingContext, load_products, pricing_input


@dataclass
class SupplyChange:
    supply_id: int
    name: str
    change_rate: Decimal
    reference_unit: str
    cost_before: Decimal | None
    cost_after: Decimal | None


@dataclass
class RecipeImpact:
    id: int
    name: str
    category: str
    cost_before: Decimal
    cost_after: Decimal
    delta: Decimal
    delta_rate: Decimal | None


@dataclass
class ChannelImpact:
    name: str
    margin_before: Decimal
    margin_after: Decimal
    margin_rate_before: Decimal | None
    margin_rate_after: Decimal | None
    status_before: AlertLevel
    status_after: AlertLevel


@dataclass
class ProductImpact:
    id: int
    name: str
    menu_group_name: str
    cost_before: Decimal
    cost_after: Decimal
    delta: Decimal
    delta_rate: Decimal | None
    suggested_price_after: Decimal | None
    status_before: AlertLevel
    status_after: AlertLevel
    channels: list[ChannelImpact]


@dataclass
class SimulationResult:
    changes: list[SupplyChange]
    recipes: list[RecipeImpact]
    products: list[ProductImpact]


def _rate(before: Decimal, after: Decimal) -> Decimal | None:
    return (after - before) / before if before else None


def simulate(session: Session, changes: dict[int, Decimal]) -> SimulationResult:
    """`changes`: supply id → change rate (0.10 = +10 %, -0.05 = −5 %)."""
    base = PricingContext(session)
    sim = PricingContext(session, {sid: 1 + rate for sid, rate in changes.items()})

    supplies = {s.id: s for s in session.exec(select(Supply)).all()}
    supply_changes = []
    for supply_id, rate in changes.items():
        before, after = base.costing.supply_cost(supply_id), sim.costing.supply_cost(supply_id)
        supply_changes.append(
            SupplyChange(
                supply_id=supply_id,
                name=supplies[supply_id].name,
                change_rate=rate,
                reference_unit=before.reference_unit,
                cost_before=before.reference_unit_cost,
                cost_after=after.reference_unit_cost,
            )
        )

    recipes = []
    for recipe in session.exec(select(Recipe)).all():
        before = base.costing.recipe_cost(recipe.id).total_cost
        after = sim.costing.recipe_cost(recipe.id).total_cost
        if before != after:
            recipes.append(
                RecipeImpact(
                    recipe.id,
                    recipe.name,
                    recipe.category,
                    before,
                    after,
                    after - before,
                    _rate(before, after),
                )
            )

    products = []
    for product in load_products(session, active=True):
        data = pricing_input(product)
        before, after = base.price(data), sim.price(data)
        if before.cost.total_cost == after.cost.total_cost:
            continue
        channels = [
            ChannelImpact(
                name=b.name,
                margin_before=b.margin,
                margin_after=a.margin,
                margin_rate_before=b.margin_rate,
                margin_rate_after=a.margin_rate,
                status_before=b.margin_status,
                status_after=a.margin_status,
            )
            for b, a in zip(before.channels, after.channels, strict=True)
        ]
        products.append(
            ProductImpact(
                id=product.id,
                name=product.name,
                menu_group_name=base.groups[product.menu_group_id].name,
                cost_before=before.cost.total_cost,
                cost_after=after.cost.total_cost,
                delta=after.cost.total_cost - before.cost.total_cost,
                delta_rate=_rate(before.cost.total_cost, after.cost.total_cost),
                suggested_price_after=after.suggested_price,
                status_before=before.status,
                status_after=after.status,
                channels=channels,
            )
        )

    recipes.sort(key=lambda r: abs(r.delta), reverse=True)
    products.sort(key=lambda p: abs(p.delta), reverse=True)
    return SimulationResult(supply_changes, recipes, products)
