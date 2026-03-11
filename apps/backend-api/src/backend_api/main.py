from fastapi import FastAPI

from backend_api.api.routes.health import router as health_router

app = FastAPI(
    title="NebulaStream Backend API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.include_router(health_router)
