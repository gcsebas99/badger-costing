"""Week prep planner: from products to prepare, to recipe batches and supply quantities.

Nothing is stored. CostingContext provides the per-batch lines, so unit conversion and the gross
quantity rule stay in one place; only quantities are used, so a missing price doesn't matter.

The waste buffer multiplies:
- recipes in BUFFERED_RECIPE_CATEGORIES, with everything inside them (once per branch, a sauce
  inside a sauce doesn't compound);
- BUFFERED_SUPPLY_GROUP supplies on a line of a product or of a non-sub-recipe (arugula directly
  on a burger). Other sub-recipes keep their own ingredients: a batch of buns is still one batch.
Packaging never gets it.
"""

from dataclasses import dataclass
from decimal import Decimal

from sqlmodel import Session, select

from app.models.recipe import Recipe, RecipeItemType
from app.models.supply import Supply
from app.services.costing import CostingContext, ItemCost
from app.services.product_cost import spec_from_product
from app.services.product_pricing import load_products
from app.services.settings import get_settings
from app.services.text import fold
from app.services.units import Unit, to_base

# Compared through fold(): categories and groups are free text.
BUFFERED_RECIPE_CATEGORIES = frozenset({"acompanamientos", "salsas", "vegetales"})
BUFFERED_SUPPLY_GROUP = "frutas y verduras"


class PrepPlanError(ValueError):
    """The plan can't be calculated; the message is shown to the user."""


@dataclass(frozen=True)
class PlanLine:
    product_id: int
    target_qty: int
    extra_qty: int = 0

    @property
    def units(self) -> int:
        return self.target_qty + self.extra_qty


@dataclass
class PlannedRecipe:
    recipe_id: int
    name: str
    category: str
    is_subrecipe: bool
    batches: Decimal
    yield_qty: Decimal  # total produced by all the batches
    yield_unit: Unit
    portions: Decimal
    buffered: bool


@dataclass
class PlannedSupply:
    supply_id: int
    name: str
    group: str
    quantity: Decimal
    unit: Unit  # kg, L or pz
    buffered: bool


@dataclass
class PrepPlan:
    recipes: list[PlannedRecipe]
    supplies: list[PlannedSupply]
    warnings: list[str]


@dataclass
class _Tally:
    quantity: Decimal = Decimal(0)
    buffered: bool = False
    unit: Unit | None = None

    def add(self, quantity: Decimal, buffered: bool) -> None:
        self.quantity += quantity
        self.buffered = self.buffered or buffered


class _PlanWalker:
    def __init__(
        self,
        ctx: CostingContext,
        recipes: dict[int, Recipe],
        supplies: dict[int, Supply],
        buffer_multiplier: Decimal,
    ):
        self._ctx = ctx
        self._recipes = recipes
        self._supplies = supplies
        self._multiplier = buffer_multiplier
        self.recipe_tally: dict[int, _Tally] = {}
        self.supply_tally: dict[int, _Tally] = {}
        self.warnings: list[str] = []

    def warn(self, message: str) -> None:
        if message not in self.warnings:
            self.warnings.append(message)

    def add_recipe(self, recipe_id: int, batches: Decimal, buffered: bool = False) -> None:
        recipe = self._recipes[recipe_id]
        if not buffered and fold(recipe.category) in BUFFERED_RECIPE_CATEGORIES:
            batches *= self._multiplier
            buffered = True
        self.recipe_tally.setdefault(recipe_id, _Tally()).add(batches, buffered)
        self.add_lines(
            recipe.name,
            self._ctx.recipe_cost(recipe_id).items,
            batches,
            buffered,
            assembly=not recipe.is_subrecipe,
        )

    def add_lines(
        self, owner: str, lines: list[ItemCost], scale: Decimal, buffered: bool, assembly: bool
    ) -> None:
        """`assembly`: the lines are put together directly (a product or a non-sub-recipe)."""
        for line in lines:
            if line.base_quantity is None:
                self.warn(f"{owner}: {line.name} no se incluyó. {line.message}")
                continue
            needed = line.base_quantity * scale
            if line.item_type == RecipeItemType.SUPPLY:
                self._add_supply(line, needed, buffered, assembly)
            else:
                batch = to_base(line.subrecipe.yield_qty, line.subrecipe.yield_unit)
                self.add_recipe(line.ref_id, needed / batch, buffered)

    def _add_supply(self, line: ItemCost, needed: Decimal, buffered: bool, assembly: bool) -> None:
        group = self._supplies[line.ref_id].group
        if assembly and not buffered and fold(group) == BUFFERED_SUPPLY_GROUP:
            needed *= self._multiplier
            buffered = True
        tally = self.supply_tally.setdefault(line.ref_id, _Tally(unit=line.reference_unit))
        tally.add(needed / to_base(Decimal(1), tally.unit), buffered)


def build_prep_plan(session: Session, lines: list[PlanLine], buffer_rate: Decimal) -> PrepPlan:
    wanted = [line for line in lines if line.units > 0]
    if not wanted:
        raise PrepPlanError("Agrega al menos un producto con cantidad.")
    product_ids = [line.product_id for line in lines]
    if len(set(product_ids)) != len(product_ids):
        raise PrepPlanError("Hay productos repetidos en el plan.")

    products = {p.id: p for p in load_products(session)}
    for product_id in product_ids:
        product = products.get(product_id)
        if product is None:
            raise PrepPlanError(f"El producto #{product_id} no existe.")
        if not product.active:
            raise PrepPlanError(f"El producto «{product.name}» está inactivo.")

    ctx = CostingContext.load(session, get_settings(session).cost_mode)
    recipes = {r.id: r for r in session.exec(select(Recipe)).all()}
    supplies = {s.id: s for s in session.exec(select(Supply)).all()}
    walker = _PlanWalker(ctx, recipes, supplies, 1 + buffer_rate)

    for line in wanted:
        product = products[line.product_id]
        units = Decimal(line.units)
        spec = spec_from_product(product)
        if spec.recipe_id is None and not spec.items and not spec.packaging:
            walker.warn(f"{product.name} no tiene receta ni componentes.")
        if spec.recipe_id is not None:
            batches = units * spec.recipe_portions / recipes[spec.recipe_id].portions
            walker.add_recipe(spec.recipe_id, batches)
        items = [ctx.item_cost(i, item) for i, item in enumerate(spec.items)]
        walker.add_lines(product.name, items, units, buffered=False, assembly=True)
        packaging = [ctx.item_cost(i, item) for i, item in enumerate(spec.packaging)]
        walker.add_lines(product.name, packaging, units, buffered=False, assembly=False)

    applied = buffer_rate > 0
    planned_recipes = [
        PlannedRecipe(
            recipe_id=recipe.id,
            name=recipe.name,
            category=recipe.category,
            is_subrecipe=recipe.is_subrecipe,
            batches=tally.quantity,
            yield_qty=recipe.yield_qty * tally.quantity,
            yield_unit=recipe.yield_unit,
            portions=recipe.portions * tally.quantity,
            buffered=applied and tally.buffered,
        )
        for recipe, tally in ((recipes[i], t) for i, t in walker.recipe_tally.items())
    ]
    planned_supplies = [
        PlannedSupply(
            supply_id=supply.id,
            name=supply.name,
            group=supply.group,
            quantity=tally.quantity,
            unit=tally.unit,
            buffered=applied and tally.buffered,
        )
        for supply, tally in ((supplies[i], t) for i, t in walker.supply_tally.items())
    ]
    return PrepPlan(
        recipes=sorted(planned_recipes, key=lambda r: (fold(r.category), fold(r.name))),
        supplies=sorted(planned_supplies, key=lambda s: (fold(s.group), fold(s.name))),
        warnings=walker.warnings,
    )
