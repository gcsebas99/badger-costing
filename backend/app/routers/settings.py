from fastapi import APIRouter

from app.db import SessionDep
from app.schemas.settings import SettingsRead, SettingsUpdate
from app.services.settings import get_settings

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsRead)
def read_settings(session: SessionDep):
    return get_settings(session)


@router.patch("", response_model=SettingsRead)
def update_settings(payload: SettingsUpdate, session: SessionDep):
    settings = get_settings(session)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return settings
