"""
Movie endpoints
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from schemas.movie import Movie, MovieDetail, MovieList
from services.tmdb import tmdb_service
from services.cache import cache_service
from core.config import settings

router = APIRouter()


@router.get("/trending", response_model=List[MovieList])
async def get_trending(
    time_window: str = Query("week", regex="^(day|week)$"),
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db)
):
    """Get trending movies"""
    cache_key = f"trending:{time_window}:{page}"
    
    # Try cache first
    cached = await cache_service.get(cache_key)
    if cached:
        return cached
    
    # Fetch from TMDB
    movies = await tmdb_service.get_trending(time_window, page)
    
    # Cache result
    await cache_service.set(cache_key, movies, ttl=settings.CACHE_TTL_TRENDING)
    
    return movies


@router.get("/popular", response_model=List[MovieList])
async def get_popular(
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db)
):
    """Get popular movies"""
    cache_key = f"popular:{page}"
    
    cached = await cache_service.get(cache_key)
    if cached:
        return cached
    
    movies = await tmdb_service.get_popular(page)
    await cache_service.set(cache_key, movies, ttl=settings.CACHE_TTL_TRENDING)
    
    return movies


@router.get("/top-rated", response_model=List[MovieList])
async def get_top_rated(
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db)
):
    """Get top rated movies"""
    cache_key = f"top_rated:{page}"
    
    cached = await cache_service.get(cache_key)
    if cached:
        return cached
    
    movies = await tmdb_service.get_top_rated(page)
    await cache_service.set(cache_key, movies, ttl=settings.CACHE_TTL_TRENDING)
    
    return movies


@router.get("/upcoming", response_model=List[MovieList])
async def get_upcoming(
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db)
):
    """Get upcoming movies"""
    cache_key = f"upcoming:{page}"
    
    cached = await cache_service.get(cache_key)
    if cached:
        return cached
    
    movies = await tmdb_service.get_upcoming(page)
    await cache_service.set(cache_key, movies, ttl=settings.CACHE_TTL_TRENDING)
    
    return movies


@router.get("/now-playing", response_model=List[MovieList])
async def get_now_playing(
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db)
):
    """Get now playing movies"""
    cache_key = f"now_playing:{page}"
    
    cached = await cache_service.get(cache_key)
    if cached:
        return cached
    
    movies = await tmdb_service.get_now_playing(page)
    await cache_service.set(cache_key, movies, ttl=settings.CACHE_TTL_TRENDING)
    
    return movies


@router.get("/genres/{genre_id}", response_model=List[MovieList])
async def get_movies_by_genre(
    genre_id: int,
    page: int = Query(1, ge=1),
    sort_by: str = Query("popularity.desc", regex=r"^(popularity|release_date|vote_average|vote_count)\.(asc|desc)$"),
    db: AsyncSession = Depends(get_db)
):
    """Get movies by genre"""
    cache_key = f"genre:{genre_id}:{page}:{sort_by}"
    
    cached = await cache_service.get(cache_key)
    if cached:
        return cached
    
    movies = await tmdb_service.get_movies_by_genre(genre_id, page, sort_by)
    await cache_service.set(cache_key, movies, ttl=settings.CACHE_TTL_TRENDING)
    
    return movies


@router.get("/origin/{country_code}", response_model=List[MovieList])
async def get_movies_by_origin_country(
    country_code: str,
    page: int = Query(1, ge=1),
    genre_id: Optional[int] = Query(None),
    sort_by: str = Query("popularity.desc", regex=r"^(popularity|release_date|vote_average|vote_count)\.(asc|desc)$"),
    db: AsyncSession = Depends(get_db),
):
    """Get movies by origin country (optional genre filter)"""
    normalized_country = country_code.upper()
    cache_key = f"origin:{normalized_country}:{page}:{genre_id}:{sort_by}"

    cached = await cache_service.get(cache_key)
    if cached:
        return cached

    movies = await tmdb_service.get_movies_by_origin_country(
        country_code=normalized_country,
        page=page,
        genre_id=genre_id,
        sort_by=sort_by,
    )
    await cache_service.set(cache_key, movies, ttl=settings.CACHE_TTL_TRENDING)

    return movies


@router.get("/{movie_id}", response_model=MovieDetail)
async def get_movie_detail(
    movie_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get movie details by ID"""
    cache_key = f"movie:{movie_id}"
    
    # Try cache
    cached = await cache_service.get(cache_key)
    if cached:
        return cached
    
    # Fetch from TMDB
    movie = await tmdb_service.get_movie_detail(movie_id)
    if not movie:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movie not found"
        )
    
    # Cache result
    await cache_service.set(cache_key, movie, ttl=settings.CACHE_TTL_METADATA)
    
    return movie


@router.get("/{movie_id}/similar", response_model=List[MovieList])
async def get_similar_movies(
    movie_id: int,
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db)
):
    """Get similar movies"""
    cache_key = f"similar:{movie_id}:{page}"
    
    cached = await cache_service.get(cache_key)
    if cached:
        return cached
    
    movies = await tmdb_service.get_similar_movies(movie_id, page)
    await cache_service.set(cache_key, movies, ttl=settings.CACHE_TTL_METADATA)
    
    return movies


@router.get("/{movie_id}/recommendations", response_model=List[MovieList])
async def get_recommendations(
    movie_id: int,
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db)
):
    """Get movie recommendations"""
    cache_key = f"recommendations:{movie_id}:{page}"
    
    cached = await cache_service.get(cache_key)
    if cached:
        return cached
    
    movies = await tmdb_service.get_recommendations(movie_id, page)
    await cache_service.set(cache_key, movies, ttl=settings.CACHE_TTL_METADATA)
    
    return movies
