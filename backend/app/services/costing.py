"""Recursive recipe costing engine.

Costs are never stored: they are computed on read by walking the recipe tree.

Rules:
1. Every quantity converts to the referenced item's base unit (g, ml, pz). Supplies may cross
   between pz and g/ml through their piece equivalence; sub-recipes only within their yield's
   unit family.
2. Gross quantity = net × (1 + waste rate). Cost uses the GROSS quantity.
3. Item cost = gross base quantity × supply unit cost, or × sub-recipe cost per base unit.
4. Recipe total = ingredients + safety margin; per unit = total ÷ yield;
   per portion = total ÷ portions.
5. Sub-recipe cycles are rejected (`check_no_cycle`) before saving.
6. Every result carries a per-item breakdown. Missing prices or bad conversions don't abort the
   calculation: the item is flagged, its cost is None and the recipe is marked incomplete.

One CostingContext loads all supplies and recipes once and memoizes results (per-request cache).
"""

import copy
from dataclasses import dataclass, field, replace
from decimal import Decimal
from enum import StrEnum

from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.models.recipe import Recipe, RecipeItemType
from app.models.settings import CostMode
from app.models.supply import Supply
from app.services.supply_cost import SupplyCost, supply_cost
from app.services.units import (
    PieceEquivalence,
    Unit,
    UnitConversionError,
    base_unit,
    convert,
    reference_unit,
    to_base,
)


class CycleError(ValueError):
    """A recipe would contain itself through its sub-recipes."""

    def __init__(self, path: list[str]):
        self.path = path
        super().__init__(f"Ciclo de sub-recetas: {' → '.join(path)}.")


class ItemStatus(StrEnum):
    OK = "ok"
    MISSING_PRICE = "missing_price"
    CONVERSION_ERROR = "conversion_error"
    INCOMPLETE_SUBRECIPE = "incomplete_subrecipe"
    NOT_FOUND = "not_found"


# --- Inputs: plain specs, built from the DB or from an unsaved draft --------------------------


@dataclass
class ItemSpec:
    item_type: RecipeItemType
    ref_id: int
    quantity: Decimal
    unit: Unit
    waste_rate: Decimal = Decimal(0)
    id: int | None = None


@dataclass
class RecipeSpec:
    id: int | None
    name: str
    yield_qty: Decimal
    yield_unit: Unit
    portions: Decimal
    safety_margin_rate: Decimal = Decimal(0)
    items: list[ItemSpec] = field(default_factory=list)


def spec_from_recipe(recipe: Recipe) -> RecipeSpec:
    return RecipeSpec(
        id=recipe.id,
        name=recipe.name,
        yield_qty=recipe.yield_qty,
        yield_unit=recipe.yield_unit,
        portions=recipe.portions,
        safety_margin_rate=recipe.safety_margin_rate,
        items=[
            ItemSpec(
                id=line.id,
                item_type=line.item_type,
                ref_id=line.supply_id
                if line.item_type == RecipeItemType.SUPPLY
                else line.subrecipe_id,
                quantity=line.quantity,
                unit=line.unit,
                waste_rate=line.waste_rate,
            )
            for line in sorted(recipe.ingredients, key=lambda line: line.position)
        ],
    )


# --- Outputs -----------------------------------------------------------------------------------


@dataclass
class ItemCost:
    position: int
    id: int | None
    item_type: RecipeItemType
    ref_id: int
    name: str
    quantity: Decimal
    unit: Unit
    waste_rate: Decimal
    gross_quantity: Decimal
    status: ItemStatus = ItemStatus.OK
    message: str | None = None
    base_unit: Unit | None = None
    base_quantity: Decimal | None = None
    unit_cost: Decimal | None = None  # ₡ per base unit of the referenced item
    reference_unit: Unit | None = None
    reference_unit_cost: Decimal | None = None  # ₡ per kg / L / pz of the referenced item
    cost: Decimal | None = None
    share: Decimal | None = None  # fraction of the recipe's ingredient cost
    subrecipe: "RecipeCost | None" = None


@dataclass
class RecipeCost:
    recipe_id: int | None
    name: str
    yield_qty: Decimal
    yield_unit: Unit
    portions: Decimal
    safety_margin_rate: Decimal
    ingredients_cost: Decimal
    safety_margin_cost: Decimal
    total_cost: Decimal
    base_unit: Unit
    cost_per_base_unit: Decimal
    reference_unit: Unit
    cost_per_reference_unit: Decimal
    cost_per_portion: Decimal
    complete: bool
    items: list[ItemCost]


# --- Engine ------------------------------------------------------------------------------------


class CostingContext:
    def __init__(
        self,
        supplies: dict[int, Supply],
        recipes: dict[int, RecipeSpec],
        mode: CostMode,
        supply_factors: dict[int, Decimal] | None = None,
    ):
        self._supplies = supplies
        self._recipes = recipes
        self._mode = mode
        # What-if simulation: multiply a supply's current cost (1.10 = +10 %).
        self._supply_factors = supply_factors or {}
        self._supply_costs: dict[int, SupplyCost] = {}
        self._recipe_costs: dict[int, RecipeCost] = {}

    @classmethod
    def load(
        cls,
        session: Session,
        mode: CostMode,
        supply_factors: dict[int, Decimal] | None = None,
    ) -> "CostingContext":
        supplies = session.exec(
            select(Supply).options(selectinload(Supply.prices), selectinload(Supply.equivalence))
        ).all()
        recipes = session.exec(select(Recipe).options(selectinload(Recipe.ingredients))).all()
        return cls(
            {s.id: s for s in supplies},
            {r.id: spec_from_recipe(r) for r in recipes},
            mode,
            supply_factors,
        )

    # Spec helpers (used by routers to build drafts and by tests)

    def spec_for(self, recipe_id: int) -> RecipeSpec:
        return copy.deepcopy(self._recipes[recipe_id])

    def item_spec_for_recipe(self, recipe_id: int, quantity: str, unit: str) -> ItemSpec:
        return ItemSpec(RecipeItemType.RECIPE, recipe_id, Decimal(quantity), Unit(unit))

    def has_supply(self, supply_id: int) -> bool:
        return supply_id in self._supplies

    def has_recipe(self, recipe_id: int) -> bool:
        return recipe_id in self._recipes

    def recipe_ids(self) -> list[int]:
        return list(self._recipes)

    # Costs

    def supply_cost(self, supply_id: int) -> SupplyCost:
        if supply_id not in self._supply_costs:
            supply = self._supplies[supply_id]
            cost = supply_cost(supply.pack_qty, supply.pack_unit, supply.prices, self._mode)
            factor = self._supply_factors.get(supply_id)
            if factor is not None and cost.pack_price is not None:
                cost = replace(
                    cost,
                    pack_price=cost.pack_price * factor,
                    unit_cost=cost.unit_cost * factor,
                    reference_unit_cost=cost.reference_unit_cost * factor,
                )
            self._supply_costs[supply_id] = cost
        return self._supply_costs[supply_id]

    def recipe_cost(self, recipe_id: int) -> RecipeCost:
        return self._memoized(recipe_id, ())

    def draft_cost(self, spec: RecipeSpec) -> RecipeCost:
        """Cost an unsaved recipe (new, or edited version of an existing one)."""
        self.check_no_cycle(spec)
        return self._compute(spec, (spec.id,) if spec.id is not None else ())

    # Cycles

    def contains_recipe(self, recipe_id: int, target_id: int) -> bool:
        """Whether `recipe_id` uses `target_id` anywhere in its tree (or is it)."""
        seen: set[int] = set()

        def visit(current: int) -> bool:
            if current == target_id:
                return True
            if current in seen or current not in self._recipes:
                return False
            seen.add(current)
            return any(
                visit(line.ref_id)
                for line in self._recipes[current].items
                if line.item_type == RecipeItemType.RECIPE
            )

        return visit(recipe_id)

    def check_no_cycle(self, spec: RecipeSpec) -> None:
        """Raise CycleError if `spec` (replacing its saved version) would contain itself."""
        graph = dict(self._recipes)
        if spec.id is not None:
            graph[spec.id] = spec
        root = spec.id if spec.id is not None else -1
        graph[root] = spec

        def visit(recipe_id: int, path: list[int]) -> None:
            for line in graph[recipe_id].items:
                if line.item_type != RecipeItemType.RECIPE or line.ref_id not in graph:
                    continue
                if line.ref_id == root or line.ref_id in path:
                    names = [graph[i].name for i in [*path, line.ref_id]]
                    raise CycleError(names)
                visit(line.ref_id, [*path, line.ref_id])

        visit(root, [root])

    # Internals

    def _compute(self, spec: RecipeSpec, stack: tuple[int, ...]) -> RecipeCost:
        items = [self.item_cost(position, line, stack) for position, line in enumerate(spec.items)]
        ingredients = sum((i.cost for i in items if i.cost is not None), Decimal(0))
        for line in items:
            if line.cost is not None and ingredients > 0:
                line.share = line.cost / ingredients
        margin = ingredients * spec.safety_margin_rate
        total = ingredients + margin
        yield_base = to_base(spec.yield_qty, spec.yield_unit)
        per_base = total / yield_base
        ref_unit = reference_unit(spec.yield_unit)
        return RecipeCost(
            recipe_id=spec.id,
            name=spec.name,
            yield_qty=spec.yield_qty,
            yield_unit=spec.yield_unit,
            portions=spec.portions,
            safety_margin_rate=spec.safety_margin_rate,
            ingredients_cost=ingredients,
            safety_margin_cost=margin,
            total_cost=total,
            base_unit=base_unit(spec.yield_unit),
            cost_per_base_unit=per_base,
            reference_unit=ref_unit,
            cost_per_reference_unit=per_base * to_base(Decimal(1), ref_unit),
            cost_per_portion=total / spec.portions,
            complete=all(i.status == ItemStatus.OK for i in items),
            items=items,
        )

    def item_cost(self, position: int, line: ItemSpec, stack: tuple[int, ...] = ()) -> ItemCost:
        """Cost one line (recipe ingredient or product component)."""
        gross = line.quantity * (1 + line.waste_rate)
        result = ItemCost(
            position=position,
            id=line.id,
            item_type=line.item_type,
            ref_id=line.ref_id,
            name="",
            quantity=line.quantity,
            unit=line.unit,
            waste_rate=line.waste_rate,
            gross_quantity=gross,
        )
        if line.item_type == RecipeItemType.SUPPLY:
            self._fill_supply_item(result, line, gross)
        else:
            self._fill_subrecipe_item(result, line, gross, stack)
        return result

    def _fill_supply_item(self, result: ItemCost, line: ItemSpec, gross: Decimal) -> None:
        supply = self._supplies.get(line.ref_id)
        if supply is None:
            result.name = f"Suministro #{line.ref_id}"
            result.status, result.message = ItemStatus.NOT_FOUND, "El suministro no existe."
            return
        result.name = supply.name
        cost = self.supply_cost(supply.id)
        result.base_unit, result.reference_unit = cost.base_unit, cost.reference_unit
        result.unit_cost, result.reference_unit_cost = cost.unit_cost, cost.reference_unit_cost
        equivalence = (
            PieceEquivalence(supply.equivalence.quantity, supply.equivalence.unit)
            if supply.equivalence
            else None
        )
        try:
            result.base_quantity = convert(gross, line.unit, cost.base_unit, equivalence)
        except UnitConversionError as exc:
            result.status, result.message = ItemStatus.CONVERSION_ERROR, str(exc)
            return
        if cost.unit_cost is None:
            result.status, result.message = (
                ItemStatus.MISSING_PRICE,
                "El suministro no tiene precio.",
            )
            return
        result.cost = result.base_quantity * cost.unit_cost

    def _fill_subrecipe_item(
        self, result: ItemCost, line: ItemSpec, gross: Decimal, stack: tuple[int, ...]
    ) -> None:
        if line.ref_id not in self._recipes:
            result.name = f"Receta #{line.ref_id}"
            result.status, result.message = ItemStatus.NOT_FOUND, "La sub-receta no existe."
            return
        sub_spec = self._recipes[line.ref_id]
        result.name = sub_spec.name
        if line.ref_id in stack:
            # Only reachable with inconsistent data; check_no_cycle prevents saving cycles.
            names = [self._recipes[i].name for i in stack if i in self._recipes]
            raise CycleError([*names, sub_spec.name])
        sub = self._memoized(line.ref_id, stack)
        result.subrecipe = sub
        result.base_unit, result.reference_unit = sub.base_unit, sub.reference_unit
        result.unit_cost, result.reference_unit_cost = (
            sub.cost_per_base_unit,
            sub.cost_per_reference_unit,
        )
        try:
            result.base_quantity = convert(gross, line.unit, sub.base_unit)
        except UnitConversionError as exc:
            result.status, result.message = ItemStatus.CONVERSION_ERROR, str(exc)
            return
        result.cost = result.base_quantity * sub.cost_per_base_unit
        if not sub.complete:
            result.status = ItemStatus.INCOMPLETE_SUBRECIPE
            result.message = "La sub-receta tiene ingredientes sin costo."

    def _memoized(self, recipe_id: int, stack: tuple[int, ...]) -> RecipeCost:
        if recipe_id not in self._recipe_costs:
            self._recipe_costs[recipe_id] = self._compute(
                self._recipes[recipe_id], (*stack, recipe_id)
            )
        return self._recipe_costs[recipe_id]
