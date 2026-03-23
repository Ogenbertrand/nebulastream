"""
Search endpoints
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from schemas.movie import MovieList
from services.tmdb import tmdb_service
from services.catalog_aggregator import catalog_aggregator_client
from core.logging import get_logger
from services.cache import cache_service
from core.config import settings

router = APIRouter()
logger = get_logger("search")


@router.get("/movies", response_model=List[MovieList])
async def search_movies(
    q: str = Query(..., min_length=2, description="Search query"),
    page: int = Query(1, ge=1),
    year: Optional[int] = Query(None, description="Filter by release year"),
    include_adult: bool = Query(False, description="Include adult content"),
    db: AsyncSession = Depends(get_db)
):
    """Search movies by query"""
    cache_key = f"search:{q}:{page}:{year}:{include_adult}"
    
    # Try cache
    cached = await cache_service.get(cache_key)
    if cached:
        return cached
    
    movies = []
    if catalog_aggregator_client.enabled and not year and not include_adult:
        try:
            movies = await catalog_aggregator_client.search(q, "movie", page)
        except Exception as exc:
            logger.warning("catalog_aggregator_failed", endpoint="search_movies", error=str(exc))

    if not movies:
        movies = await tmdb_service.search_movies(
            query=q,
            page=page,
            year=year,
            include_adult=include_adult
        )
    
    # Cache result
    await cache_service.set_with_stale(cache_key, movies, ttl=settings.CACHE_TTL_SEARCH)
    
    return movies


@router.get("/tv", response_model=List[MovieList])
async def search_tv(
    q: str = Query(..., min_length=2, description="Search query"),
    page: int = Query(1, ge=1),
    include_adult: bool = Query(False, description="Include adult content"),
    db: AsyncSession = Depends(get_db)
):
    """Search TV shows by query"""
    cache_key = f"search_tv:{q}:{page}:{include_adult}"

    cached = await cache_service.get(cache_key)
    if cached:
        return cached

    shows = []
    if catalog_aggregator_client.enabled and not include_adult:
        try:
            shows = await catalog_aggregator_client.search(q, "tv", page)
        except Exception as exc:
            logger.warning("catalog_aggregator_failed", endpoint="search_tv", error=str(exc))

    if not shows:
        shows = await tmdb_service.search_tv(
            query=q,
            page=page,
            include_adult=include_adult
        )

    await cache_service.set_with_stale(cache_key, shows, ttl=settings.CACHE_TTL_SEARCH)
    return shows


@router.get("/suggestions")
async def get_search_suggestions(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(5, ge=1, le=10)
):
    """Get search suggestions"""
    cache_key = f"suggestions:{q}:{limit}"
    
    cached = await cache_service.get(cache_key)
    if cached is not None:
        return {"query": q, "suggestions": cached}
    
    suggestions = await tmdb_service.get_search_suggestions(q, limit)
    await cache_service.set_with_stale(cache_key, suggestions, ttl=settings.CACHE_TTL_SEARCH)
    
    return {"query": q, "suggestions": suggestions}


@router.get("/genres")
async def get_genres(
    type: str = Query("movie", pattern="^(movie|tv)$")
):
    """Get all genres for movies or TV shows"""
    cache_key = f"genres:{type}"
    
    cached = await cache_service.get(cache_key)
    if cached is not None:
        return {"genres": cached}
    
    genres = []
    if catalog_aggregator_client.enabled:
        try:
            genres = await catalog_aggregator_client.genres(type)
        except Exception as exc:
            logger.warning("catalog_aggregator_failed", endpoint="genres", error=str(exc))

    if not genres:
        genres = await tmdb_service.get_genres(type)
    if not genres:
        stale = await cache_service.get_stale(cache_key)
        if stale is not None:
            return {"genres": stale}
    await cache_service.set_with_stale(cache_key, genres, ttl=settings.CACHE_TTL_METADATA)
    
    return {"genres": genres}
