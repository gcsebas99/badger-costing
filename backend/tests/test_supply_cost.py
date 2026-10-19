from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.models.settings import CostMode
from app.services.supply_cost import current_pack_price, prices_in_effect, supply_cost
from app.services.units import Unit

D = Decimal


@dataclass
class Price:
    id: int
    amount: Decimal
    purchased_on: date


def p(id_: int, amount: str, day: int) -> Price:
    return Price(id_, D(amount), date(2026, 10, day))


def test_no_prices_means_no_cost():
    assert current_pack_price([], CostMode.AVERAGE_LAST_3) is None
    cost = supply_cost(D("1"), Unit.KG, [], CostMode.AVERAGE_LAST_3)
    assert cost.unit_cost is None
    assert cost.reference_unit_cost is None
    assert cost.last_price_date is None


def test_single_price_is_used_as_is():
    assert current_pack_price([p(1, "1300", 1)], CostMode.AVERAGE_LAST_3) == D("1300")


def test_two_prices_are_averaged():
    assert current_pack_price([p(1, "100", 1), p(2, "200", 2)], CostMode.AVERAGE_LAST_3) == D(150)


def test_average_uses_only_latest_three():
    prices = [p(1, "1000", 1), p(2, "100", 2), p(3, "200", 3), p(4, "300", 4)]
    assert current_pack_price(prices, CostMode.AVERAGE_LAST_3) == D(200)
    assert [x.id for x in prices_in_effect(prices, CostMode.AVERAGE_LAST_3)] == [4, 3, 2]


def test_latest_mode_uses_newest_by_date_then_id():
    prices = [p(1, "100", 5), p(3, "300", 2), p(2, "200", 5)]
    assert current_pack_price(prices, CostMode.LATEST) == D(200)


def test_unit_cost_per_base_and_reference_unit():
    # 6 L of olive oil for ₡ 1300 → ₡ 0.2166… per ml, ₡ 216.66… per L
    cost = supply_cost(D("6"), Unit.L, [p(1, "1300", 1)], CostMode.AVERAGE_LAST_3)
    assert cost.base_unit == Unit.ML
    assert cost.reference_unit == Unit.L
    assert cost.unit_cost == D("1300") / D("6000")
    assert round(cost.reference_unit_cost, 2) == D("216.67")
    assert cost.last_price_date == date(2026, 10, 1)


def test_unit_cost_for_pieces():
    # 24 cans for ₡ 249 → ₡ 10.375 per can
    cost = supply_cost(D("24"), Unit.PZ, [p(1, "249", 1)], CostMode.AVERAGE_LAST_3)
    assert cost.unit_cost == D("10.375")
    assert cost.reference_unit_cost == D("10.375")


def test_price_change_updates_unit_cost():
    prices = [p(1, "331.12", 1)]
    before = supply_cost(D("1.36"), Unit.KG, prices, CostMode.LATEST)
    prices.append(p(2, "400", 2))
    after = supply_cost(D("1.36"), Unit.KG, prices, CostMode.LATEST)
    assert after.unit_cost > before.unit_cost
    assert round(after.reference_unit_cost, 2) == D("294.12")
