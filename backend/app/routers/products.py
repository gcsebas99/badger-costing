from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.db import SessionDep
from app.models.common import utcnow
from app.models.product import Product, ProductItem, ProductItemRole, ProductPlatformPrice
from app.models.recipe import Recipe, RecipeItemType
from app.schemas.product import (
    PlatformPriceIn,
    PlatformPriceRead,
    ProductCreate,
    ProductDetail,
    ProductPreview,
    ProductPricingRead,
    ProductSummary,
    ProductUpdate,
)
from app.schemas.recipe import RecipeItemIn, RecipeItemRead
from app.services.costing import ItemSpec
from app.services.product_cost import ProductSpec, spec_from_product
from app.services.product_pricing import PricingContext, PricingInput, pricing_input
from app.services.text import fold
from app.services.usages import sales_count

router = APIRouter(prefix="/products", tags=["products"])


def _load(session: Session, product_id: int | None = None):
    query = select(Product).options(
        selectinload(Product.components), selectinload(Product.platform_prices)
    )
    if product_id is not None:
        query = query.where(Product.id == product_id)
    return query


def _get_product(session: Session, product_id: int) -> Product:
    product = session.exec(_load(session, product_id)).first()
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado.")
    return product


def _item_specs(lines: list[RecipeItemIn]) -> list[ItemSpec]:
    return [
        ItemSpec(
            item_type=line.item_type,
            ref_id=line.ref_id,
            quantity=line.quantity,
            unit=line.unit,
            waste_rate=line.waste_rate,
        )
        for line in lines
    ]


def _validate_refs(
    ctx: PricingContext,
    *,
    menu_group_id: int | None,
    recipe_id: int | None,
    lines: list[RecipeItemIn],
    prices: list[PlatformPriceIn],
) -> None:
    def fail(message: str):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, message)

    if menu_group_id is not None and menu_group_id not in ctx.groups:
        fail("El grupo del menú no existe.")
    if recipe_id is not None and not ctx.costing.has_recipe(recipe_id):
        fail("La receta no existe.")
    for line in lines:
        is_supply = line.item_type == RecipeItemType.SUPPLY
        exists = (
            ctx.costing.has_supply(line.ref_id)
            if is_supply
            else ctx.costing.has_recipe(line.ref_id)
        )
        if not exists:
            fail(f"El {'suministro' if is_supply else 'sub-receta'} #{line.ref_id} no existe.")
    seen: set[int] = set()
    for price in prices:
        if price.platform_id not in ctx.platforms:
            fail(f"La plataforma #{price.platform_id} no existe.")
        if price.platform_id in seen:
            fail("Hay dos precios para la misma plataforma.")
        seen.add(price.platform_id)


def _component_rows(items: list[RecipeItemIn], packaging: list[RecipeItemIn]) -> list[ProductItem]:
    rows = []
    for role, lines in ((ProductItemRole.ITEM, items), (ProductItemRole.PACKAGING, packaging)):
        for position, line in enumerate(lines):
            rows.append(
                ProductItem(
                    role=role,
                    position=position,
                    item_type=line.item_type,
                    supply_id=line.ref_id if line.item_type == RecipeItemType.SUPPLY else None,
                    subrecipe_id=line.ref_id if line.item_type == RecipeItemType.RECIPE else None,
                    quantity=line.quantity,
                    unit=line.unit,
                    waste_rate=line.waste_rate,
                )
            )
    return rows


def _item_read(line: ProductItem) -> RecipeItemRead:
    return RecipeItemRead(
        id=line.id,
        position=line.position,
        item_type=line.item_type,
        ref_id=line.supply_id or line.subrecipe_id,
        quantity=line.quantity,
        unit=line.unit,
        waste_rate=line.waste_rate,
    )


def _to_detail(session: Session, product_id: int) -> ProductDetail:
    product = _get_product(session, product_id)
    ctx = PricingContext(session)
    pricing = ctx.price(pricing_input(product))
    components = sorted(product.components, key=lambda c: c.position)
    return ProductDetail.model_validate(
        {
            **product.model_dump(),
            "menu_group_name": ctx.groups[product.menu_group_id].name,
            "items": [_item_read(c) for c in components if c.role == ProductItemRole.ITEM],
            "packaging": [_item_read(c) for c in components if c.role == ProductItemRole.PACKAGING],
            "platform_prices": [
                PlatformPriceRead(platform_id=p.platform_id, price=p.price)
                for p in product.platform_prices
            ],
            "pricing": ProductPricingRead.model_validate(pricing),
        }
    )


@router.get("", response_model=list[ProductSummary])
def list_products(
    session: SessionDep,
    q: str | None = Query(default=None, description="Search in name."),
    menu_group_id: int | None = None,
    active: bool | None = None,
):
    """Products with cost, per-channel pricing and alerts (the "Análisis de precios" table)."""
    query = _load(session)
    if menu_group_id is not None:
        query = query.where(Product.menu_group_id == menu_group_id)
    if active is not None:
        query = query.where(Product.active == active)
    products = list(session.exec(query).all())
    if q and q.strip():
        needle = fold(q.strip())
        products = [p for p in products if needle in fold(p.name)]

    ctx = PricingContext(session)
    recipe_names = dict(session.exec(select(Recipe.id, Recipe.name)).all())

    def sort_key(p: Product):
        group = ctx.groups[p.menu_group_id]
        return (group.position, fold(group.name), fold(p.name))

    rows = []
    for product in sorted(products, key=sort_key):
        pricing = ctx.price(pricing_input(product))
        rows.append(
            ProductSummary(
                id=product.id,
                name=product.name,
                menu_group_id=product.menu_group_id,
                menu_group_name=ctx.groups[product.menu_group_id].name,
                recipe_id=product.recipe_id,
                recipe_name=recipe_names.get(product.recipe_id),
                active=product.active,
                total_cost=pricing.cost.total_cost,
                complete=pricing.cost.complete,
                target_food_cost_rate=pricing.target_food_cost_rate,
                suggested_price=pricing.suggested_price,
                target_cost=pricing.target_cost,
                deviation=pricing.deviation,
                deviation_status=pricing.deviation_status,
                channels=pricing.channels,
                status=pricing.status,
            )
        )
    return rows


@router.post("/preview", response_model=ProductPricingRead)
def preview_product(payload: ProductPreview, session: SessionDep):
    """Cost and price an unsaved product; used by the editor to recalculate live."""
    ctx = PricingContext(session)
    _validate_refs(
        ctx,
        menu_group_id=payload.menu_group_id,
        recipe_id=payload.recipe_id,
        lines=[*payload.items, *payload.packaging],
        prices=payload.platform_prices,
    )
    pricing = ctx.price(
        PricingInput(
            spec=ProductSpec(
                id=None,
                name="Borrador",
                recipe_id=payload.recipe_id,
                recipe_portions=payload.recipe_portions,
                items=_item_specs(payload.items),
                packaging=_item_specs(payload.packaging),
            ),
            menu_group_id=payload.menu_group_id,
            direct_price=payload.direct_price,
            platform_prices={p.platform_id: p.price for p in payload.platform_prices},
            target_cost=payload.target_cost,
        )
    )
    return ProductPricingRead.model_validate(pricing)


@router.post("", response_model=ProductDetail, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, session: SessionDep):
    _validate_refs(
        PricingContext(session),
        menu_group_id=payload.menu_group_id,
        recipe_id=payload.recipe_id,
        lines=[*payload.items, *payload.packaging],
        prices=payload.platform_prices,
    )
    product = Product.model_validate(
        payload.model_dump(exclude={"items", "packaging", "platform_prices"})
    )
    product.components = _component_rows(payload.items, payload.packaging)
    product.platform_prices = [
        ProductPlatformPrice(platform_id=p.platform_id, price=p.price)
        for p in payload.platform_prices
    ]
    session.add(product)
    session.commit()
    return _to_detail(session, product.id)


@router.get("/{product_id}", response_model=ProductDetail)
def read_product(product_id: int, session: SessionDep):
    return _to_detail(session, product_id)


@router.patch("/{product_id}", response_model=ProductDetail)
def update_product(product_id: int, payload: ProductUpdate, session: SessionDep):
    product = _get_product(session, product_id)
    fields = payload.model_fields_set
    _validate_refs(
        PricingContext(session),
        menu_group_id=payload.menu_group_id,
        recipe_id=payload.recipe_id,
        lines=[*(payload.items or []), *(payload.packaging or [])],
        prices=payload.platform_prices or [],
    )

    scalar = payload.model_dump(
        exclude_unset=True, exclude={"items", "packaging", "platform_prices"}
    )
    for name, value in scalar.items():
        setattr(product, name, value)

    if "items" in fields or "packaging" in fields:
        current = spec_from_product(product)
        items = payload.items if "items" in fields else _as_inputs(current.items)
        packaging = payload.packaging if "packaging" in fields else _as_inputs(current.packaging)
        product.components.clear()
        session.flush()
        product.components.extend(_component_rows(items, packaging))
    if "platform_prices" in fields:
        product.platform_prices.clear()
        session.flush()
        product.platform_prices.extend(
            ProductPlatformPrice(platform_id=p.platform_id, price=p.price)
            for p in payload.platform_prices
        )
    product.updated_at = utcnow()
    session.add(product)
    session.commit()
    session.expire_all()
    return _to_detail(session, product_id)


def _as_inputs(specs: list[ItemSpec]) -> list[RecipeItemIn]:
    return [
        RecipeItemIn(
            item_type=s.item_type,
            ref_id=s.ref_id,
            quantity=s.quantity,
            unit=s.unit,
            waste_rate=s.waste_rate,
        )
        for s in specs
    ]


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, session: SessionDep):
    product = _get_product(session, product_id)
    if sales_count(session, product_id=product_id):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "El producto tiene ventas registradas. Desactívalo en lugar de eliminarlo.",
        )
    session.delete(product)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
