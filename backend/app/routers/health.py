from fastapi import APIRouter
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.db import SessionDep
from app.schemas.health import HealthRead

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthRead)
def health(session: SessionDep) -> HealthRead:
    try:
        session.exec(text("SELECT 1"))
        database = "ok"
    except SQLAlchemyError:
        database = "error"
    return HealthRead(status="ok", version=settings.version, database=database)
