from decimal import Decimal

import pytest

from app.services.pricing import (
    AlertLevel,
    ChannelKind,
    PricingSettings,
    channel_pricing,
    cost_deviation,
    deviation_status,
    suggested_price,
    worst,
)

D = Decimal
SETTINGS = PricingSettings(
    vat_rate=D("0.13"),
    bank_fee_rate=D("0.021"),
    margin_alert_rate=D("0.4"),
    deviation_upper_rate=D("0.05"),
    deviation_lower_rate=D("-0.1"),
)


def price(pvp: str, cost: str, fee_rate: str, kind=ChannelKind.DIRECT, target="0.3"):
    return channel_pricing(
        kind=kind,
        platform_id=None,
        name="x",
        price=D(pvp),
        cost=D(cost),
        fee_rate=D(fee_rate),
        settings=SETTINGS,
        target_food_cost_rate=D(target),
    )


def test_direct_sale_with_bank_fee():
    row = price("4520", "1130", "0.021")
    assert row.price_ex_vat == D("4000")
    assert row.fee == D("94.92")  # 2.1 % of PVP
    assert row.margin == D("4000") - D("1130") - D("94.92")
    assert row.margin_rate == row.margin / D("4000")
    assert row.food_cost_rate == D("0.2825")
    assert row.margin_status == AlertLevel.OK
    assert row.food_cost_status == AlertLevel.OK


def test_platform_fee_can_push_margin_below_threshold():
    row = price("5650", "1385", "0.3", kind=ChannelKind.PLATFORM)
    assert row.price_ex_vat == D("5000")
    assert row.fee == D("1695")
    assert row.margin == D("1920")
    assert row.margin_rate == D("0.384")
    assert row.margin_status == AlertLevel.BAD


def test_food_cost_above_target_warns():
    row = price("2260", "700", "0", target="0.3")  # 700 / 2000 = 35 %
    assert row.food_cost_rate == D("0.35")
    assert row.food_cost_status == AlertLevel.WARN


def test_zero_price_is_flagged_without_dividing_by_zero():
    row = price("0", "100", "0")
    assert row.margin_rate is None
    assert row.margin_status == AlertLevel.BAD


def test_suggested_price():
    # cost 1130 at 30 % food cost → 3766.67 ex VAT → × 1.13
    assert suggested_price(D("1130"), D("0.3"), D("0.13")) == D("1130") / D("0.3") * D("1.13")
    assert suggested_price(D("1130"), D("0"), D("0.13")) is None


@pytest.mark.parametrize(
    ("cost", "target", "expected", "status"),
    [
        ("105", "100", D("0.05"), AlertLevel.OK),
        ("106", "100", D("0.06"), AlertLevel.BAD),
        ("89", "100", D("-0.11"), AlertLevel.WARN),
        ("100", None, None, AlertLevel.OK),
    ],
)
def test_cost_deviation(cost, target, expected, status):
    deviation = cost_deviation(D(cost), D(target) if target else None)
    assert deviation == expected
    assert deviation_status(deviation, SETTINGS) == status


def test_worst():
    assert worst([AlertLevel.OK, AlertLevel.BAD, AlertLevel.WARN]) == AlertLevel.BAD
    assert worst([]) == AlertLevel.OK
