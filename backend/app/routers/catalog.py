"""Sales platforms and menu groups (configured from the Ajustes page)."""

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, select

from app.db import SessionDep
from app.models.product import MenuGroup, Product, SalesPlatform
from app.schemas.product import (
    MenuGroupIn,
    MenuGroupRead,
    MenuGroupUpdate,
    PlatformIn,
    PlatformRead,
    PlatformUpdate,
)
from app.services.text import fold
from app.services.usages import sales_count

router = APIRouter(tags=["catalog"])


def _commit_unique(session: Session, message: str) -> None:
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, message) from exc


# --- Platforms ---------------------------------------------------------------------------------


def _get_platform(session: Session, platform_id: int) -> SalesPlatform:
    platform = session.get(SalesPlatform, platform_id)
    if platform is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plataforma no encontrada.")
    return platform


@router.get("/platforms", response_model=list[PlatformRead])
def list_platforms(session: SessionDep):
    return sorted(session.exec(select(SalesPlatform)).all(), key=lambda p: fold(p.name))


@router.post("/platforms", response_model=PlatformRead, status_code=status.HTTP_201_CREATED)
def create_platform(payload: PlatformIn, session: SessionDep):
    platform = SalesPlatform.model_validate(payload)
    session.add(platform)
    _commit_unique(session, "Ya existe una plataforma con ese nombre.")
    session.refresh(platform)
    return platform


@router.patch("/platforms/{platform_id}", response_model=PlatformRead)
def update_platform(platform_id: int, payload: PlatformUpdate, session: SessionDep):
    platform = _get_platform(session, platform_id)
    for name, value in payload.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(platform, name, value)
    session.add(platform)
    _commit_unique(session, "Ya existe una plataforma con ese nombre.")
    session.refresh(platform)
    return platform


@router.delete("/platforms/{platform_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_platform(platform_id: int, session: SessionDep):
    """Deleting a platform also deletes the product prices set for it."""
    platform = _get_platform(session, platform_id)
    if sales_count(session, platform_id=platform_id):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "La plataforma tiene ventas registradas. Desactívala en lugar de eliminarla.",
        )
    session.delete(platform)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Menu groups -------------------------------------------------------------------------------


def _get_group(session: Session, group_id: int) -> MenuGroup:
    group = session.get(MenuGroup, group_id)
    if group is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Grupo del menú no encontrado.")
    return group


def _group_read(session: Session, group: MenuGroup) -> MenuGroupRead:
    count = session.exec(
        select(func.count()).select_from(Product).where(col(Product.menu_group_id) == group.id)
    ).one()
    return MenuGroupRead.model_validate({**group.model_dump(), "product_count": count})


@router.get("/menu-groups", response_model=list[MenuGroupRead])
def list_menu_groups(session: SessionDep):
    groups = session.exec(select(MenuGroup)).all()
    return [
        _group_read(session, g) for g in sorted(groups, key=lambda g: (g.position, fold(g.name)))
    ]


@router.post("/menu-groups", response_model=MenuGroupRead, status_code=status.HTTP_201_CREATED)
def create_menu_group(payload: MenuGroupIn, session: SessionDep):
    group = MenuGroup.model_validate(payload)
    session.add(group)
    _commit_unique(session, "Ya existe un grupo con ese nombre.")
    session.refresh(group)
    return _group_read(session, group)


@router.patch("/menu-groups/{group_id}", response_model=MenuGroupRead)
def update_menu_group(group_id: int, payload: MenuGroupUpdate, session: SessionDep):
    group = _get_group(session, group_id)
    changes = payload.model_dump(exclude_unset=True)
    for name, value in changes.items():
        if value is None and name != "target_food_cost_rate":  # null target = use default
            continue
        setattr(group, name, value)
    session.add(group)
    _commit_unique(session, "Ya existe un grupo con ese nombre.")
    session.refresh(group)
    return _group_read(session, group)


@router.delete("/menu-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_menu_group(group_id: int, session: SessionDep):
    group = _get_group(session, group_id)
    if _group_read(session, group).product_count:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "El grupo tiene productos; muévelos antes de eliminarlo."
        )
    session.delete(group)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
