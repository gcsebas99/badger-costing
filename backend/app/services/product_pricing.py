"""Assemble cost + per-channel pricing + alerts for a product."""

from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.models.product import MenuGroup, Product, SalesPlatform
from app.models.settings import AppSettings
from app.services.costing import CostingContext
from app.services.pricing import (
    AlertLevel,
    ChannelKind,
    ChannelPricing,
    PricingSettings,
    channel_pricing,
    cost_deviation,
    deviation_status,
    suggested_price,
    worst,
)
from app.services.product_cost import ProductCost, ProductSpec, product_cost, spec_from_product
from app.services.settings import get_settings


@dataclass
class ProductPricing:
    cost: ProductCost
    target_food_cost_rate: Decimal
    suggested_price: Decimal | None
    target_cost: Decimal | None
    deviation: Decimal | None
    deviation_status: AlertLevel
    channels: list[ChannelPricing]
    status: AlertLevel


@dataclass
class PricingInput:
    spec: ProductSpec
    menu_group_id: int | None
    direct_price: Decimal | None
    platform_prices: dict[int, Decimal]
    target_cost: Decimal | None


def load_products(session: Session, active: bool | None = None) -> list[Product]:
    query = select(Product).options(
        selectinload(Product.components), selectinload(Product.platform_prices)
    )
    if active is not None:
        query = query.where(Product.active == active)
    return list(session.exec(query).all())


def pricing_input(product: Product) -> PricingInput:
    return PricingInput(
        spec=spec_from_product(product),
        menu_group_id=product.menu_group_id,
        direct_price=product.direct_price,
        platform_prices={p.platform_id: p.price for p in product.platform_prices},
        target_cost=product.target_cost,
    )


class PricingContext:
    """Settings, menu groups, platforms and the costing context, loaded once per request."""

    def __init__(self, session: Session, supply_factors: dict[int, Decimal] | None = None):
        settings: AppSettings = get_settings(session)
        self.settings = PricingSettings(
            vat_rate=settings.vat_rate,
            bank_fee_rate=settings.bank_fee_rate,
            margin_alert_rate=settings.margin_alert_rate,
            deviation_upper_rate=settings.deviation_upper_rate,
            deviation_lower_rate=settings.deviation_lower_rate,
        )
        self.default_target = settings.target_food_cost_rate
        self.groups = {g.id: g for g in session.exec(select(MenuGroup)).all()}
        self.platforms = {
            p.id: p for p in session.exec(select(SalesPlatform).order_by(SalesPlatform.name)).all()
        }
        self.costing = CostingContext.load(session, settings.cost_mode, supply_factors)

    def target_for(self, menu_group_id: int | None) -> Decimal:
        group = self.groups.get(menu_group_id) if menu_group_id is not None else None
        if group is not None and group.target_food_cost_rate is not None:
            return group.target_food_cost_rate
        return self.default_target

    def price(self, data: PricingInput) -> ProductPricing:
        cost = product_cost(self.costing, data.spec)
        target = self.target_for(data.menu_group_id)
        channels: list[ChannelPricing] = []
        if data.direct_price is not None:
            channels.append(
                channel_pricing(
                    kind=ChannelKind.DIRECT,
                    platform_id=None,
                    name="Venta directa",
                    price=data.direct_price,
                    cost=cost.total_cost,
                    fee_rate=self.settings.bank_fee_rate,
                    settings=self.settings,
                    target_food_cost_rate=target,
                )
            )
        for platform in self.platforms.values():
            if platform.id in data.platform_prices and platform.active:
                channels.append(
                    channel_pricing(
                        kind=ChannelKind.PLATFORM,
                        platform_id=platform.id,
                        name=platform.name,
                        price=data.platform_prices[platform.id],
                        cost=cost.total_cost,
                        fee_rate=platform.fee_rate,
                        settings=self.settings,
                        target_food_cost_rate=target,
                    )
                )
        deviation = cost_deviation(cost.total_cost, data.target_cost)
        dev_status = deviation_status(deviation, self.settings)
        levels = [dev_status]
        for channel in channels:
            levels += [channel.margin_status, channel.food_cost_status]
        if not cost.complete:
            levels.append(AlertLevel.WARN)
        return ProductPricing(
            cost=cost,
            target_food_cost_rate=target,
            suggested_price=suggested_price(cost.total_cost, target, self.settings.vat_rate),
            target_cost=data.target_cost,
            deviation=deviation,
            deviation_status=dev_status,
            channels=channels,
            status=worst(levels),
        )
