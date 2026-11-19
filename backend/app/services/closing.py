"""Session closing report: income − (product cost + labor + other expenses) = net profit.

Draft closings are costed live with the regular engine; closed ones use the snapshot stored on
their product lines when they were closed (D66). Nothing here touches the database except
`live_snapshots`, which reads products and the costing context.
"""

from dataclasses import dataclass, field
from decimal import Decimal

from sqlmodel import Session

from app.models.closing import Closing, ClosingStatus
from app.models.product import Product
from app.services.costing import CostingContext
from app.services.product_cost import product_cost, spec_from_product
from app.services.product_pricing import load_products
from app.services.settings import get_settings

ZERO = Decimal(0)


class ClosingError(ValueError):
    """Invalid closing input; the message is Spanish and shown to the user."""


# --- Inputs ----------------------------------------------------------------------------------


@dataclass
class ProductLineIn:
    product_id: int
    units: int


@dataclass
class LaborLineIn:
    name: str
    hours: Decimal
    hourly_rate: Decimal
    collaborator_id: int | None = None


@dataclass
class ExpenseLineIn:
    name: str
    amount: Decimal
    expense_type_id: int | None = None


@dataclass
class ClosingInput:
    billed_amount: Decimal = ZERO
    vat_amount: Decimal = ZERO
    bank_fee_amount: Decimal = ZERO
    products: list[ProductLineIn] = field(default_factory=list)
    labor: list[LaborLineIn] = field(default_factory=list)
    expenses: list[ExpenseLineIn] = field(default_factory=list)


@dataclass
class ProductSnapshot:
    """Per-unit cost and price of a product, live or frozen."""

    name: str
    unit_cost: Decimal
    food_cost: Decimal  # recipe portions + direct components
    packaging_cost: Decimal
    unit_price: Decimal | None  # direct PVP (VAT included)
    complete: bool
    issues: list[str] = field(default_factory=list)


# --- Output ----------------------------------------------------------------------------------


@dataclass
class ProductLineReport:
    product_id: int
    name: str
    units: int
    unit_cost: Decimal
    food_cost: Decimal
    packaging_cost: Decimal
    total_cost: Decimal
    unit_price: Decimal | None
    expected_revenue: Decimal | None
    complete: bool
    issues: list[str]


@dataclass
class LaborLineReport:
    collaborator_id: int | None
    name: str
    hours: Decimal
    hourly_rate: Decimal
    total: Decimal


@dataclass
class ExpenseLineReport:
    expense_type_id: int | None
    name: str
    amount: Decimal


@dataclass
class ClosingReport:
    frozen: bool
    billed_amount: Decimal
    vat_amount: Decimal
    bank_fee_amount: Decimal
    net_income: Decimal
    products: list[ProductLineReport]
    labor: list[LaborLineReport]
    expenses: list[ExpenseLineReport]
    total_units: int
    product_cost: Decimal
    food_cost: Decimal
    packaging_cost: Decimal
    labor_cost: Decimal
    labor_hours: Decimal
    other_expenses: Decimal
    total_expenses: Decimal
    net_profit: Decimal
    # Rates over net income; None when net income is not positive.
    net_margin_rate: Decimal | None
    food_cost_rate: Decimal | None
    labor_rate: Decimal | None
    prime_cost_rate: Decimal | None
    other_expenses_rate: Decimal | None
    # Units × direct PVP of the products that have one, and billed − that.
    expected_billing: Decimal | None
    billing_difference: Decimal | None
    products_without_price: list[str]
    complete: bool
    warnings: list[str]
    # What the Ajustes rates would give for the billed amount (a hint; never applied).
    suggested_vat_amount: Decimal
    suggested_bank_fee_amount: Decimal


def _rate(part: Decimal, whole: Decimal) -> Decimal | None:
    return part / whole if whole > 0 else None


def validate_input(data: ClosingInput) -> None:
    seen: set[int] = set()
    for line in data.products:
        if line.product_id in seen:
            raise ClosingError("Hay un producto repetido en la lista de vendidos.")
        seen.add(line.product_id)


def build_report(
    data: ClosingInput,
    snapshots: list[ProductSnapshot],
    *,
    frozen: bool,
    vat_rate: Decimal,
    bank_fee_rate: Decimal,
) -> ClosingReport:
    """`snapshots` is aligned with `data.products`."""
    products: list[ProductLineReport] = []
    warnings: list[str] = []
    without_price: list[str] = []
    for line, snap in zip(data.products, snapshots, strict=True):
        units = Decimal(line.units)
        expected = snap.unit_price * units if snap.unit_price is not None else None
        if snap.unit_price is None and line.units > 0:
            without_price.append(snap.name)
        if not snap.complete:
            warnings.append(f"«{snap.name}» tiene costo incompleto.")
        products.append(
            ProductLineReport(
                product_id=line.product_id,
                name=snap.name,
                units=line.units,
                unit_cost=snap.unit_cost,
                food_cost=snap.food_cost,
                packaging_cost=snap.packaging_cost,
                total_cost=snap.unit_cost * units,
                unit_price=snap.unit_price,
                expected_revenue=expected,
                complete=snap.complete,
                issues=snap.issues,
            )
        )

    labor = [
        LaborLineReport(
            collaborator_id=line.collaborator_id,
            name=line.name,
            hours=line.hours,
            hourly_rate=line.hourly_rate,
            total=line.hours * line.hourly_rate,
        )
        for line in data.labor
    ]
    expenses = [
        ExpenseLineReport(expense_type_id=line.expense_type_id, name=line.name, amount=line.amount)
        for line in data.expenses
    ]

    net_income = data.billed_amount - data.vat_amount - data.bank_fee_amount
    product_total = sum((p.total_cost for p in products), ZERO)
    food_total = sum((p.food_cost * p.units for p in products), ZERO)
    packaging_total = sum((p.packaging_cost * p.units for p in products), ZERO)
    labor_total = sum((line.total for line in labor), ZERO)
    other_total = sum((line.amount for line in expenses), ZERO)
    total_expenses = product_total + labor_total + other_total
    net_profit = net_income - total_expenses

    priced = [p.expected_revenue for p in products if p.expected_revenue is not None]
    expected_billing = sum(priced, ZERO) if priced else None
    if net_income < 0:
        warnings.append("El IVA y la comisión superan el monto facturado.")

    return ClosingReport(
        frozen=frozen,
        billed_amount=data.billed_amount,
        vat_amount=data.vat_amount,
        bank_fee_amount=data.bank_fee_amount,
        net_income=net_income,
        products=products,
        labor=labor,
        expenses=expenses,
        total_units=sum(p.units for p in products),
        product_cost=product_total,
        food_cost=food_total,
        packaging_cost=packaging_total,
        labor_cost=labor_total,
        labor_hours=sum((line.hours for line in labor), ZERO),
        other_expenses=other_total,
        total_expenses=total_expenses,
        net_profit=net_profit,
        net_margin_rate=_rate(net_profit, net_income),
        food_cost_rate=_rate(product_total, net_income),
        labor_rate=_rate(labor_total, net_income),
        prime_cost_rate=_rate(product_total + labor_total, net_income),
        other_expenses_rate=_rate(other_total, net_income),
        expected_billing=expected_billing,
        billing_difference=(
            data.billed_amount - expected_billing if expected_billing is not None else None
        ),
        products_without_price=without_price,
        complete=all(p.complete for p in products),
        warnings=warnings,
        suggested_vat_amount=data.billed_amount - data.billed_amount / (1 + vat_rate),
        suggested_bank_fee_amount=data.billed_amount * bank_fee_rate,
    )


# --- Live costs and stored closings ----------------------------------------------------------


def snapshot_from_product(ctx: CostingContext, product: Product) -> ProductSnapshot:
    cost = product_cost(ctx, spec_from_product(product))
    return ProductSnapshot(
        name=product.name,
        unit_cost=cost.total_cost,
        food_cost=cost.recipe_cost + cost.items_cost,
        packaging_cost=cost.packaging_cost,
        unit_price=product.direct_price,
        complete=cost.complete,
        issues=cost.issues,
    )


class ClosingCalculator:
    """Products, costing context and settings, loaded once per request."""

    def __init__(self, session: Session):
        settings = get_settings(session)
        self.vat_rate = settings.vat_rate
        self.bank_fee_rate = settings.bank_fee_rate
        self.products = {p.id: p for p in load_products(session)}
        self.ctx = CostingContext.load(session, settings.cost_mode)
        self._live: dict[int, ProductSnapshot] = {}

    def live_snapshot(self, product_id: int) -> ProductSnapshot:
        if product_id not in self.products:
            raise ClosingError("Uno de los productos no existe.")
        if product_id not in self._live:
            self._live[product_id] = snapshot_from_product(self.ctx, self.products[product_id])
        return self._live[product_id]

    def report(self, data: ClosingInput) -> ClosingReport:
        """Report of an unsaved or draft closing, costed with today's prices."""
        validate_input(data)
        snapshots = [self.live_snapshot(line.product_id) for line in data.products]
        return self._build(data, snapshots, frozen=False)

    def stored_report(self, closing: Closing) -> ClosingReport:
        data = input_from_closing(closing)
        if closing.status != ClosingStatus.CLOSED:
            return self.report(data)
        snapshots = [
            ProductSnapshot(
                name=line.name or "",
                unit_cost=line.unit_cost or ZERO,
                food_cost=line.food_cost or ZERO,
                packaging_cost=line.packaging_cost or ZERO,
                unit_price=line.unit_price,
                complete=bool(line.cost_complete),
            )
            for line in closing.products
        ]
        return self._build(data, snapshots, frozen=True)

    def freeze(self, closing: Closing) -> None:
        """Write today's costs and prices on the product lines (when closing)."""
        for line in closing.products:
            snap = self.live_snapshot(line.product_id)
            line.name = snap.name
            line.unit_cost = snap.unit_cost
            line.food_cost = snap.food_cost
            line.packaging_cost = snap.packaging_cost
            line.unit_price = snap.unit_price
            line.cost_complete = snap.complete

    def _build(
        self, data: ClosingInput, snapshots: list[ProductSnapshot], *, frozen: bool
    ) -> ClosingReport:
        return build_report(
            data,
            snapshots,
            frozen=frozen,
            vat_rate=self.vat_rate,
            bank_fee_rate=self.bank_fee_rate,
        )


def unfreeze(closing: Closing) -> None:
    for line in closing.products:
        line.name = None
        line.unit_cost = line.food_cost = line.packaging_cost = line.unit_price = None
        line.cost_complete = None


def input_from_closing(closing: Closing) -> ClosingInput:
    return ClosingInput(
        billed_amount=closing.billed_amount,
        vat_amount=closing.vat_amount,
        bank_fee_amount=closing.bank_fee_amount,
        products=[ProductLineIn(p.product_id, p.units) for p in closing.products],
        labor=[
            LaborLineIn(line.name, line.hours, line.hourly_rate, line.collaborator_id)
            for line in closing.labor
        ],
        expenses=[
            ExpenseLineIn(line.name, line.amount, line.expense_type_id) for line in closing.expenses
        ],
    )
