"""
Aggregated movie endpoints combining multiple providers
"""

from typing import Any, Dict, List
from fastapi import APIRouter, Query

from services.movie_aggregation import movie_aggregation_service

router = APIRouter(prefix="/api/movies")


@router.get("/trending", response_model=List[Dict[str, Any]])
async def get_trending_movies(limit: int = Query(10, ge=1, le=50)):
    """Get trending movies from Trakt, enriched with OMDb"""
    data = await movie_aggregation_service.get_trending(limit=limit)
    return data


@router.get("/details/{title}", response_model=Dict[str, Any])
async def get_movie_details(title: str):
    """Get detailed metadata from OMDb (and Watchmode if available)"""
    omdb_details = await movie_aggregation_service.get_omdb_details(title)

    providers = []
    watchmode_id = await movie_aggregation_service.search_watchmode_id(title)
    if watchmode_id:
        providers = await movie_aggregation_service.get_watchmode_sources(watchmode_id)

    result = movie_aggregation_service.build_movie_object(
        base={"title": title},
        omdb=omdb_details,
        providers=providers,
    )
    if not omdb_details:
        result["errors"] = ["omdb_unavailable_or_not_found"]
    return result


@router.get("/providers/{watchmode_id}", response_model=List[Dict[str, Any]])
async def get_movie_providers(watchmode_id: int):
    """Get streaming providers from Watchmode by title ID"""
    providers = await movie_aggregation_service.get_watchmode_sources(watchmode_id)
    return providers


@router.get("/discover", response_model=Dict[str, List[Dict[str, Any]]])
async def discover_categories(page: int = Query(1, ge=1)):
    """Discover categories via TMDB (Hollywood, Bollywood, Nollywood, Anime, etc.)"""
    return await movie_aggregation_service.get_discover_categories(page=page)
