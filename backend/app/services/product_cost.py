"""Cost of a sale product: portions of its main recipe + direct components + packaging."""

from dataclasses import dataclass, field
from decimal import Decimal

from app.models.product import Product, ProductItemRole
from app.models.recipe import RecipeItemType
from app.services.costing import CostingContext, ItemCost, ItemSpec, ItemStatus, RecipeCost


@dataclass
class ProductSpec:
    id: int | None
    name: str
    recipe_id: int | None = None
    recipe_portions: Decimal = Decimal(1)
    items: list[ItemSpec] = field(default_factory=list)
    packaging: list[ItemSpec] = field(default_factory=list)


@dataclass
class ProductCost:
    recipe: RecipeCost | None
    recipe_portions: Decimal
    recipe_cost: Decimal  # recipe cost per portion × portions
    items: list[ItemCost]
    items_cost: Decimal
    packaging: list[ItemCost]
    packaging_cost: Decimal
    total_cost: Decimal
    complete: bool
    issues: list[str]


def spec_from_product(product: Product) -> ProductSpec:
    def line_spec(line) -> ItemSpec:
        return ItemSpec(
            id=line.id,
            item_type=line.item_type,
            ref_id=line.supply_id if line.item_type == RecipeItemType.SUPPLY else line.subrecipe_id,
            quantity=line.quantity,
            unit=line.unit,
            waste_rate=line.waste_rate,
        )

    ordered = sorted(product.components, key=lambda line: line.position)
    return ProductSpec(
        id=product.id,
        name=product.name,
        recipe_id=product.recipe_id,
        recipe_portions=product.recipe_portions,
        items=[line_spec(c) for c in ordered if c.role == ProductItemRole.ITEM],
        packaging=[line_spec(c) for c in ordered if c.role == ProductItemRole.PACKAGING],
    )


def product_cost(ctx: CostingContext, spec: ProductSpec) -> ProductCost:
    issues: list[str] = []
    recipe = None
    recipe_part = Decimal(0)
    if spec.recipe_id is not None:
        if ctx.has_recipe(spec.recipe_id):
            recipe = ctx.recipe_cost(spec.recipe_id)
            recipe_part = recipe.cost_per_portion * spec.recipe_portions
            if not recipe.complete:
                issues.append(f"La receta «{recipe.name}» tiene ingredientes sin costo.")
        else:
            issues.append("La receta no existe.")

    items = [ctx.item_cost(i, line) for i, line in enumerate(spec.items)]
    packaging = [ctx.item_cost(i, line) for i, line in enumerate(spec.packaging)]
    for line in [*items, *packaging]:
        if line.status != ItemStatus.OK:
            issues.append(f"{line.name}: {line.message}")

    def total(lines: list[ItemCost]) -> Decimal:
        return sum((line.cost for line in lines if line.cost is not None), Decimal(0))

    items_cost, packaging_cost = total(items), total(packaging)
    return ProductCost(
        recipe=recipe,
        recipe_portions=spec.recipe_portions,
        recipe_cost=recipe_part,
        items=items,
        items_cost=items_cost,
        packaging=packaging,
        packaging_cost=packaging_cost,
        total_cost=recipe_part + items_cost + packaging_cost,
        complete=not issues,
        issues=issues,
    )
