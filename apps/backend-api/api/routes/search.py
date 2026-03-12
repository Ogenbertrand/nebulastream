"""
Search endpoints
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from schemas.movie import MovieList
from services.tmdb import tmdb_service
from services.cache import cache_service
from core.config import settings

router = APIRouter()


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
    
    # Search TMDB
    movies = await tmdb_service.search_movies(
        query=q,
        page=page,
        year=year,
        include_adult=include_adult
    )
    
    # Cache result
    await cache_service.set(cache_key, movies, ttl=settings.CACHE_TTL_SEARCH)
    
    return movies


@router.get("/suggestions")
async def get_search_suggestions(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(5, ge=1, le=10)
):
    """Get search suggestions"""
    cache_key = f"suggestions:{q}:{limit}"
    
    cached = await cache_service.get(cache_key)
    if cached:
        return cached
    
    suggestions = await tmdb_service.get_search_suggestions(q, limit)
    await cache_service.set(cache_key, suggestions, ttl=settings.CACHE_TTL_SEARCH)
    
    return {"query": q, "suggestions": suggestions}


@router.get("/genres")
async def get_genres():
    """Get all movie genres"""
    cache_key = "genres:all"
    
    cached = await cache_service.get(cache_key)
    if cached:
        return cached
    
    genres = await tmdb_service.get_genres()
    await cache_service.set(cache_key, genres, ttl=settings.CACHE_TTL_METADATA)
    
    return {"genres": genres}
