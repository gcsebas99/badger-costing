from fastapi import APIRouter

from app.routers import (
    catalog,
    health,
    insights,
    products,
    recipes,
    sales,
    settings,
    supplies,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(catalog.router)
api_router.include_router(insights.router)
api_router.include_router(products.router)
api_router.include_router(recipes.router)
api_router.include_router(sales.router)
api_router.include_router(settings.router)
api_router.include_router(supplies.router)
