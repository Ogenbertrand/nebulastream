"""
TV show endpoints
"""

from typing import List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from schemas.movie import MovieList, MovieDetail, Episode
from services.tmdb import tmdb_service
from services.catalog_aggregator import catalog_aggregator_client
from core.logging import get_logger
from services.cache import cache_service
from core.config import settings

router = APIRouter()
logger = get_logger("tv")


@router.get("/trending", response_model=List[MovieList])
async def get_trending_tv(
    time_window: str = Query("week", pattern="^(day|week)$"),
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db),
):
    """Get trending TV shows"""
    cache_key = f"tv:trending:{time_window}:{page}"

    cached = await cache_service.get(cache_key)
    if cached:
        return cached

    shows = []
    if catalog_aggregator_client.enabled and time_window == "week":
        try:
            shows = await catalog_aggregator_client.trending("tv", page)
        except Exception as exc:
            logger.warning("catalog_aggregator_failed", endpoint="tv_trending", error=str(exc))

    if not shows:
        shows = await tmdb_service.get_tv_trending(time_window, page)
    if not shows:
        stale = await cache_service.get_stale(cache_key)
        if stale:
            return stale
    await cache_service.set_with_stale(cache_key, shows, ttl=settings.CACHE_TTL_TRENDING)

    return shows


@router.get("/popular", response_model=List[MovieList])
async def get_popular_tv(
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db),
):
    """Get popular TV shows"""
    cache_key = f"tv:popular:{page}"

    cached = await cache_service.get(cache_key)
    if cached:
        return cached

    shows = []
    if catalog_aggregator_client.enabled:
        try:
            shows = await catalog_aggregator_client.popular("tv", page)
        except Exception as exc:
            logger.warning("catalog_aggregator_failed", endpoint="tv_popular", error=str(exc))

    if not shows:
        shows = await tmdb_service.get_tv_popular(page)
    if not shows:
        stale = await cache_service.get_stale(cache_key)
        if stale:
            return stale
    await cache_service.set_with_stale(cache_key, shows, ttl=settings.CACHE_TTL_TRENDING)

    return shows


@router.get("/top-rated", response_model=List[MovieList])
async def get_top_rated_tv(
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db),
):
    """Get top rated TV shows"""
    cache_key = f"tv:top_rated:{page}"

    cached = await cache_service.get(cache_key)
    if cached:
        return cached

    shows = []
    if catalog_aggregator_client.enabled:
        try:
            shows = await catalog_aggregator_client.top_rated("tv", page)
        except Exception as exc:
            logger.warning("catalog_aggregator_failed", endpoint="tv_top_rated", error=str(exc))

    if not shows:
        shows = await tmdb_service.get_tv_top_rated(page)
    if not shows:
        stale = await cache_service.get_stale(cache_key)
        if stale:
            return stale
    await cache_service.set_with_stale(cache_key, shows, ttl=settings.CACHE_TTL_TRENDING)

    return shows


@router.get("/on-the-air", response_model=List[MovieList])
async def get_on_the_air_tv(
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db),
):
    """Get TV shows currently on the air"""
    cache_key = f"tv:on_the_air:{page}"

    cached = await cache_service.get(cache_key)
    if cached:
        return cached

    shows = await tmdb_service.get_tv_on_the_air(page)
    if not shows:
        stale = await cache_service.get_stale(cache_key)
        if stale:
            return stale
    await cache_service.set_with_stale(cache_key, shows, ttl=settings.CACHE_TTL_TRENDING)

    return shows


@router.get("/genres/{genre_id}", response_model=List[MovieList])
async def get_tv_by_genre(
    genre_id: int,
    page: int = Query(1, ge=1),
    sort_by: str = Query(
        "popularity.desc",
        pattern=r"^(popularity|release_date|vote_average|vote_count)\.(asc|desc)$",
    ),
    db: AsyncSession = Depends(get_db),
):
    """Get TV shows by genre"""
    cache_key = f"tv:genre:{genre_id}:{page}:{sort_by}"

    cached = await cache_service.get(cache_key)
    if cached:
        return cached

    shows = await tmdb_service.get_tv_by_genre(genre_id, page, sort_by)
    if not shows:
        stale = await cache_service.get_stale(cache_key)
        if stale:
            return stale
    await cache_service.set_with_stale(cache_key, shows, ttl=settings.CACHE_TTL_TRENDING)

    return shows


@router.get("/{tv_id}", response_model=MovieDetail)
async def get_tv_detail(
    tv_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get TV show detail by ID"""
    cache_key = f"tv:detail:{tv_id}"

    cached = await cache_service.get(cache_key)
    if cached:
        return cached

    show = await tmdb_service.get_tv_detail(tv_id)
    if not show:
        raise HTTPException(status_code=404, detail="TV show not found")

    await cache_service.set(cache_key, show, ttl=settings.CACHE_TTL_METADATA)
    return show


@router.get("/{tv_id}/recommendations", response_model=List[MovieList])
async def get_tv_recommendations(
    tv_id: int,
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db),
):
    """Get TV recommendations"""
    cache_key = f"tv:recommendations:{tv_id}:{page}"

    cached = await cache_service.get(cache_key)
    if cached:
        return cached

    shows = await tmdb_service.get_tv_recommendations(tv_id, page)
    await cache_service.set(cache_key, shows, ttl=settings.CACHE_TTL_METADATA)
    return shows


@router.get("/{tv_id}/season/{season_number}", response_model=List[Episode])
async def get_tv_season(
    tv_id: int,
    season_number: int,
    db: AsyncSession = Depends(get_db),
):
    """Get episodes for a season"""
    cache_key = f"tv:season:{tv_id}:{season_number}"

    cached = await cache_service.get(cache_key)
    if cached:
        return cached

    episodes = await tmdb_service.get_tv_season(tv_id, season_number)
    await cache_service.set(cache_key, episodes, ttl=settings.CACHE_TTL_METADATA)
    return episodes
