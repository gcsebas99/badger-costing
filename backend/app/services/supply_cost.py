"""Current cost of a supply.

Prices are stored per pack (e.g. ₡ 1300 for 6 L). The current pack price is either the latest price
or the average of the latest up-to-3 prices (1 price → that price, 2 → average of 2), depending on
the CostMode setting. Unit cost is the current pack price divided by the pack size in base units.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Protocol

from app.models.settings import CostMode
from app.services.units import Unit, base_unit, convert, reference_unit, to_base

PRICES_IN_AVERAGE = 3


class PriceLike(Protocol):
    id: int | None
    amount: Decimal
    purchased_on: date


def sort_newest_first[P: PriceLike](prices: Sequence[P]) -> list[P]:
    return sorted(prices, key=lambda p: (p.purchased_on, p.id or 0), reverse=True)


def prices_in_effect[P: PriceLike](prices: Sequence[P], mode: CostMode) -> list[P]:
    """The prices that make up the current cost, newest first."""
    count = 1 if mode == CostMode.LATEST else PRICES_IN_AVERAGE
    return sort_newest_first(prices)[:count]


def current_pack_price(prices: Sequence[PriceLike], mode: CostMode) -> Decimal | None:
    selected = prices_in_effect(prices, mode)
    if not selected:
        return None
    return sum((p.amount for p in selected), Decimal(0)) / len(selected)


@dataclass(frozen=True)
class SupplyCost:
    pack_price: Decimal | None
    base_unit: Unit
    unit_cost: Decimal | None  # ₡ per base unit (g, ml, pz)
    reference_unit: Unit
    reference_unit_cost: Decimal | None  # ₡ per kg, L or pz (readable)
    last_price_date: date | None


def supply_cost(
    pack_qty: Decimal, pack_unit: Unit, prices: Sequence[PriceLike], mode: CostMode
) -> SupplyCost:
    pack_price = current_pack_price(prices, mode)
    base, reference = base_unit(pack_unit), reference_unit(pack_unit)
    unit_cost = reference_cost = None
    if pack_price is not None:
        unit_cost = pack_price / to_base(pack_qty, pack_unit)
        reference_cost = unit_cost * convert(Decimal(1), reference, base)
    newest = sort_newest_first(prices)
    return SupplyCost(
        pack_price=pack_price,
        base_unit=base,
        unit_cost=unit_cost,
        reference_unit=reference,
        reference_unit_cost=reference_cost,
        last_price_date=newest[0].purchased_on if newest else None,
    )
