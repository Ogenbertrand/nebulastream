"""
NebulaStream Backend API
FastAPI application for movie streaming platform
"""

import asyncio
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse

from api.routes import auth, health, movies, search, streams, users, watch_history, aggregated_movies, tv
from core.config import settings
from core.database import engine, init_db
from services.cache import cache_service
from services.torrent_ingest import torrent_ingest_worker

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting NebulaStream API", version="1.0.0")
    
    # Initialize database
    await init_db()
    
    # Initialize cache
    await cache_service.connect()

    # Start torrent ingest polling loop
    torrent_ingest_worker.start_background_polling(settings.TORRENT_INGEST_POLL_SECONDS)
    
    yield
    
    # Shutdown
    logger.info("Shutting down NebulaStream API")
    await cache_service.disconnect()
    await torrent_ingest_worker.stop_background_polling()


# Create FastAPI application
app = FastAPI(
    title="NebulaStream API",
    description="High-performance movie streaming platform API",
    version="1.0.0",
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(movies.router, prefix="/movies", tags=["Movies"])
app.include_router(tv.router, prefix="/tv", tags=["TV"])
app.include_router(search.router, prefix="/search", tags=["Search"])
app.include_router(streams.router, prefix="/streams", tags=["Streams"])
app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(watch_history.router, prefix="/watch-history", tags=["Watch History"])
app.include_router(aggregated_movies.router, tags=["Aggregated Movies"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "NebulaStream API",
        "version": "1.0.0",
        "documentation": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
