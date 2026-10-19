from fastapi import APIRouter

from app.routers import health, settings, supplies

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(settings.router)
api_router.include_router(supplies.router)
