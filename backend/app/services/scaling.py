"""Batch scaling for the kitchen: multiply a recipe, or fit it to the amount of one ingredient.

Scaling multiplies every line's net quantity, the yield and the portions by the same factor
(waste % is unchanged). Nothing is stored; the scaled spec is costed like a draft.
"""

from dataclasses import replace
from decimal import Decimal

from app.models.recipe import RecipeItemType
from app.services.costing import CostingContext, RecipeSpec
from app.services.units import Unit, convert

MAX_FACTOR = Decimal(100)


class ScalingError(ValueError):
    """Raised when a scale factor can't be derived or is out of range."""


def check_factor(factor: Decimal) -> Decimal:
    if not 0 < factor <= MAX_FACTOR:
        raise ScalingError(f"El factor debe ser mayor que 0 y como máximo {MAX_FACTOR}.")
    return factor


def anchor_factor(
    ctx: CostingContext, spec: RecipeSpec, item_id: int, quantity: Decimal, unit: Unit
) -> Decimal:
    """Factor that turns line `item_id`'s net quantity into `quantity` `unit`."""
    line = next((i for i in spec.items if i.id == item_id), None)
    if line is None:
        raise ScalingError("El ingrediente no pertenece a esta receta.")
    if quantity <= 0:
        raise ScalingError("La cantidad disponible debe ser mayor que cero.")
    equivalence = (
        ctx.piece_equivalence(line.ref_id)
        if line.item_type == RecipeItemType.SUPPLY and ctx.has_supply(line.ref_id)
        else None
    )
    # UnitConversionError (a ValueError) propagates with its own Spanish message.
    available = convert(quantity, unit, line.unit, equivalence)
    return check_factor(available / line.quantity)


def scale_spec(spec: RecipeSpec, factor: Decimal) -> RecipeSpec:
    return replace(
        spec,
        yield_qty=spec.yield_qty * factor,
        portions=spec.portions * factor,
        items=[replace(line, quantity=line.quantity * factor) for line in spec.items],
    )
