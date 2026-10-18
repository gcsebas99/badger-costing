from fastapi import FastAPI

from app.config import settings
from app.routers import api_router

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)
app.include_router(api_router)
