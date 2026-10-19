from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.db import SessionDep
from app.models.common import utcnow
from app.models.recipe import DEFAULT_RECIPE_CATEGORIES, Recipe, RecipeItem, RecipeItemType
from app.models.supply import Supply
from app.schemas.recipe import (
    IngredientOption,
    RecipeCostRead,
    RecipeCreate,
    RecipeDetail,
    RecipeFacets,
    RecipeItemIn,
    RecipeItemRead,
    RecipePreview,
    RecipeSummary,
    RecipeUpdate,
    RecipeUsage,
)
from app.services.costing import CostingContext, CycleError, ItemSpec, RecipeSpec
from app.services.settings import get_settings
from app.services.text import fold
from app.services.units import UnitFamily, family, units_in_family
from app.services.usages import recipes_using_recipe

router = APIRouter(prefix="/recipes", tags=["recipes"])


def _context(session: Session) -> CostingContext:
    return CostingContext.load(session, get_settings(session).cost_mode)


def _get_recipe(session: Session, recipe_id: int) -> Recipe:
    recipe = session.exec(
        select(Recipe).where(Recipe.id == recipe_id).options(selectinload(Recipe.ingredients))
    ).first()
    if recipe is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Receta no encontrada.")
    return recipe


def _item_specs(items: list[RecipeItemIn]) -> list[ItemSpec]:
    return [
        ItemSpec(
            item_type=line.item_type,
            ref_id=line.ref_id,
            quantity=line.quantity,
            unit=line.unit,
            waste_rate=line.waste_rate,
        )
        for line in items
    ]


def _validate_items(ctx: CostingContext, spec: RecipeSpec) -> None:
    """Every referenced supply/sub-recipe must exist, and the recipe must not contain itself."""
    for line in spec.items:
        exists = (
            ctx.has_supply(line.ref_id)
            if line.item_type == RecipeItemType.SUPPLY
            else ctx.has_recipe(line.ref_id)
        )
        if not exists:
            kind = "suministro" if line.item_type == RecipeItemType.SUPPLY else "sub-receta"
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, f"El {kind} #{line.ref_id} no existe."
            )
    try:
        ctx.check_no_cycle(spec)
    except CycleError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc


def _to_item_rows(items: list[RecipeItemIn]) -> list[RecipeItem]:
    return [
        RecipeItem(
            position=position,
            item_type=line.item_type,
            supply_id=line.ref_id if line.item_type == RecipeItemType.SUPPLY else None,
            subrecipe_id=line.ref_id if line.item_type == RecipeItemType.RECIPE else None,
            quantity=line.quantity,
            unit=line.unit,
            waste_rate=line.waste_rate,
        )
        for position, line in enumerate(items)
    ]


def _usage(recipe: Recipe) -> RecipeUsage:
    return RecipeUsage.model_validate(recipe)


def _to_detail(session: Session, recipe_id: int) -> RecipeDetail:
    recipe = _get_recipe(session, recipe_id)
    cost = _context(session).recipe_cost(recipe_id)
    return RecipeDetail.model_validate(
        {
            **recipe.model_dump(),
            "items": [
                RecipeItemRead(
                    id=line.id,
                    position=line.position,
                    item_type=line.item_type,
                    ref_id=line.supply_id or line.subrecipe_id,
                    quantity=line.quantity,
                    unit=line.unit,
                    waste_rate=line.waste_rate,
                )
                for line in recipe.ingredients
            ],
            "cost": RecipeCostRead.model_validate(cost),
            "used_in": [_usage(r) for r in recipes_using_recipe(session, recipe_id)],
        }
    )


@router.get("", response_model=list[RecipeSummary])
def list_recipes(
    session: SessionDep,
    q: str | None = Query(default=None, description="Search in name."),
    category: str | None = None,
    is_subrecipe: bool | None = None,
):
    query = select(Recipe).options(selectinload(Recipe.ingredients))
    if category:
        query = query.where(Recipe.category == category)
    if is_subrecipe is not None:
        query = query.where(Recipe.is_subrecipe == is_subrecipe)
    recipes = list(session.exec(query).all())
    if q and q.strip():
        needle = fold(q.strip())
        recipes = [r for r in recipes if needle in fold(r.name)]
    recipes.sort(key=lambda r: (fold(r.category), fold(r.name)))

    ctx = _context(session)
    summaries = []
    for recipe in recipes:
        cost = ctx.recipe_cost(recipe.id)
        summaries.append(
            RecipeSummary.model_validate(
                {
                    **recipe.model_dump(),
                    "item_count": len(recipe.ingredients),
                    "total_cost": cost.total_cost,
                    "cost_per_portion": cost.cost_per_portion,
                    "reference_unit": cost.reference_unit,
                    "cost_per_reference_unit": cost.cost_per_reference_unit,
                    "complete": cost.complete,
                }
            )
        )
    return summaries


@router.get("/facets", response_model=RecipeFacets)
def recipe_facets(session: SessionDep):
    used = session.exec(select(Recipe.category).distinct()).all()
    return RecipeFacets(categories=sorted({*DEFAULT_RECIPE_CATEGORIES, *used}, key=fold))


@router.get("/ingredients", response_model=list[IngredientOption])
def ingredient_options(
    session: SessionDep,
    exclude_recipe_id: int | None = Query(
        default=None,
        description="Recipe being edited: it and every recipe containing it are left out.",
    ),
):
    """Supplies and sub-recipes that can go into a recipe, with the units each accepts."""
    ctx = _context(session)
    options: list[IngredientOption] = []

    supplies = session.exec(select(Supply).options(selectinload(Supply.equivalence))).all()
    for supply in supplies:
        cost = ctx.supply_cost(supply.id)
        units = units_in_family(family(cost.base_unit))
        if supply.equivalence is not None:
            # 1 pz = X g/ml lets the supply be used in pieces and in that weight/volume family.
            other = (
                family(supply.equivalence.unit)
                if family(cost.base_unit) == UnitFamily.COUNT
                else UnitFamily.COUNT
            )
            units += units_in_family(other)
        options.append(
            IngredientOption(
                item_type=RecipeItemType.SUPPLY,
                id=supply.id,
                name=supply.name,
                detail=supply.brand,
                base_unit=cost.base_unit,
                allowed_units=units,
                reference_unit=cost.reference_unit,
                reference_unit_cost=cost.reference_unit_cost,
                active=supply.active,
            )
        )

    subrecipes = session.exec(select(Recipe).where(Recipe.is_subrecipe == True)).all()  # noqa: E712
    for recipe in subrecipes:
        # Offering a recipe that contains the one being edited would only create a cycle.
        if exclude_recipe_id is not None and ctx.contains_recipe(recipe.id, exclude_recipe_id):
            continue
        cost = ctx.recipe_cost(recipe.id)
        options.append(
            IngredientOption(
                item_type=RecipeItemType.RECIPE,
                id=recipe.id,
                name=recipe.name,
                detail=recipe.category,
                base_unit=cost.base_unit,
                allowed_units=units_in_family(family(cost.base_unit)),
                reference_unit=cost.reference_unit,
                reference_unit_cost=cost.cost_per_reference_unit,
                active=True,
            )
        )
    options.sort(key=lambda o: fold(o.name))
    return options


@router.post("/preview", response_model=RecipeCostRead)
def preview_recipe_cost(payload: RecipePreview, session: SessionDep):
    """Cost an unsaved recipe; used by the editor to recalculate live."""
    ctx = _context(session)
    spec = RecipeSpec(
        id=payload.id,
        name=payload.name,
        yield_qty=payload.yield_qty,
        yield_unit=payload.yield_unit,
        portions=payload.portions,
        safety_margin_rate=payload.safety_margin_rate,
        items=_item_specs(payload.items),
    )
    _validate_items(ctx, spec)
    return RecipeCostRead.model_validate(ctx.draft_cost(spec))


@router.post("", response_model=RecipeDetail, status_code=status.HTTP_201_CREATED)
def create_recipe(payload: RecipeCreate, session: SessionDep):
    spec = RecipeSpec(
        id=None,
        name=payload.name,
        yield_qty=payload.yield_qty,
        yield_unit=payload.yield_unit,
        portions=payload.portions,
        items=_item_specs(payload.items),
    )
    _validate_items(_context(session), spec)
    recipe = Recipe.model_validate(payload.model_dump(exclude={"items"}))
    recipe.ingredients = _to_item_rows(payload.items)
    session.add(recipe)
    session.commit()
    return _to_detail(session, recipe.id)


@router.get("/{recipe_id}", response_model=RecipeDetail)
def read_recipe(recipe_id: int, session: SessionDep):
    return _to_detail(session, recipe_id)


@router.get("/{recipe_id}/cost", response_model=RecipeCostRead)
def recipe_cost(recipe_id: int, session: SessionDep):
    _get_recipe(session, recipe_id)
    return RecipeCostRead.model_validate(_context(session).recipe_cost(recipe_id))


@router.get("/{recipe_id}/usages", response_model=list[RecipeUsage])
def recipe_usages(recipe_id: int, session: SessionDep):
    _get_recipe(session, recipe_id)
    return [_usage(r) for r in recipes_using_recipe(session, recipe_id)]


@router.patch("/{recipe_id}", response_model=RecipeDetail)
def update_recipe(recipe_id: int, payload: RecipeUpdate, session: SessionDep):
    recipe = _get_recipe(session, recipe_id)
    if payload.items is not None:
        ctx = _context(session)
        spec = ctx.spec_for(recipe_id)
        spec.items = _item_specs(payload.items)
        _validate_items(ctx, spec)
    if payload.is_subrecipe is False and recipes_using_recipe(session, recipe_id):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "No se puede desmarcar como sub-receta: otras recetas la usan.",
        )

    for name, value in payload.model_dump(exclude_unset=True, exclude={"items"}).items():
        setattr(recipe, name, value)
    if payload.items is not None:
        recipe.ingredients.clear()
        session.flush()  # delete old lines before inserting the new ones
        recipe.ingredients.extend(_to_item_rows(payload.items))
    recipe.updated_at = utcnow()
    session.add(recipe)
    session.commit()
    session.expire_all()
    return _to_detail(session, recipe_id)


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(recipe_id: int, session: SessionDep):
    recipe = _get_recipe(session, recipe_id)
    users = recipes_using_recipe(session, recipe_id)
    if users:
        names = ", ".join(r.name for r in users)
        raise HTTPException(status.HTTP_409_CONFLICT, f"La receta se usa en: {names}.")
    session.delete(recipe)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
