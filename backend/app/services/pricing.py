"""Price and margin per sales channel.

    price_ex_vat    = PVP / (1 + VAT)
    fee             = PVP × fee rate   (bank fee on direct sales; platform fee on platforms)
    margin          = price_ex_vat − cost − fee
    margin_rate     = margin / price_ex_vat
    food_cost_rate  = cost / price_ex_vat
    suggested_price = cost / target food cost % × (1 + VAT)
    deviation       = (cost − theoretical cost) / theoretical cost

The template computed fees as PVP − PVP / (1 + rate); platforms and banks actually charge
rate × PVP, which is what we use.
"""

from dataclasses import dataclass
from decimal import Decimal
from enum import StrEnum


class AlertLevel(StrEnum):
    OK = "ok"
    WARN = "warn"
    BAD = "bad"


class ChannelKind(StrEnum):
    DIRECT = "direct"
    PLATFORM = "platform"


@dataclass(frozen=True)
class PricingSettings:
    vat_rate: Decimal
    bank_fee_rate: Decimal
    margin_alert_rate: Decimal
    deviation_upper_rate: Decimal
    deviation_lower_rate: Decimal


@dataclass
class ChannelPricing:
    kind: ChannelKind
    platform_id: int | None
    name: str
    price: Decimal
    price_ex_vat: Decimal
    fee_rate: Decimal
    fee: Decimal
    cost: Decimal
    food_cost_rate: Decimal | None
    margin: Decimal
    margin_rate: Decimal | None
    margin_status: AlertLevel
    food_cost_status: AlertLevel


def channel_pricing(
    *,
    kind: ChannelKind,
    platform_id: int | None,
    name: str,
    price: Decimal,
    cost: Decimal,
    fee_rate: Decimal,
    settings: PricingSettings,
    target_food_cost_rate: Decimal,
) -> ChannelPricing:
    price_ex_vat = price / (1 + settings.vat_rate)
    fee = price * fee_rate
    margin = price_ex_vat - cost - fee
    margin_rate = margin / price_ex_vat if price_ex_vat > 0 else None
    food_cost_rate = cost / price_ex_vat if price_ex_vat > 0 else None
    return ChannelPricing(
        kind=kind,
        platform_id=platform_id,
        name=name,
        price=price,
        price_ex_vat=price_ex_vat,
        fee_rate=fee_rate,
        fee=fee,
        cost=cost,
        food_cost_rate=food_cost_rate,
        margin=margin,
        margin_rate=margin_rate,
        margin_status=(
            AlertLevel.BAD
            if margin_rate is None or margin_rate < settings.margin_alert_rate
            else AlertLevel.OK
        ),
        food_cost_status=(
            AlertLevel.WARN
            if food_cost_rate is None or food_cost_rate > target_food_cost_rate
            else AlertLevel.OK
        ),
    )


def suggested_price(
    cost: Decimal, target_food_cost_rate: Decimal, vat_rate: Decimal
) -> Decimal | None:
    if target_food_cost_rate <= 0:
        return None
    return cost / target_food_cost_rate * (1 + vat_rate)


def cost_deviation(cost: Decimal, target_cost: Decimal | None) -> Decimal | None:
    if target_cost is None or target_cost <= 0:
        return None
    return (cost - target_cost) / target_cost


def deviation_status(deviation: Decimal | None, settings: PricingSettings) -> AlertLevel:
    if deviation is None:
        return AlertLevel.OK
    if deviation > settings.deviation_upper_rate:
        return AlertLevel.BAD
    if deviation < settings.deviation_lower_rate:
        return AlertLevel.WARN
    return AlertLevel.OK


def worst(levels: list[AlertLevel]) -> AlertLevel:
    order = [AlertLevel.OK, AlertLevel.WARN, AlertLevel.BAD]
    return max(levels, key=order.index, default=AlertLevel.OK)
