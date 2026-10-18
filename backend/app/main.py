from fastapi import FastAPI
from fastapi.routing import APIRoute

from app.config import settings
from app.routers import api_router


def operation_id(route: APIRoute) -> str:
    """Use the endpoint function name as operationId (clean names in generated TS types)."""
    return route.name


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    generate_unique_id_function=operation_id,
)
app.include_router(api_router)
