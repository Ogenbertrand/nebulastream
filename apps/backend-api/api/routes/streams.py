"""
Stream endpoints
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from schemas.stream import StreamResponse, StreamSource
from services.stream_aggregator import stream_aggregator
from services.cache import cache_service

router = APIRouter()


@router.get("/{movie_id}", response_model=StreamResponse)
async def get_movie_streams(
    movie_id: int,
    preferred_quality: str = Query("720p", regex="^(480p|720p|1080p|4k)$"),
    preferred_language: str = Query("en"),
    db: AsyncSession = Depends(get_db)
):
    """Get streaming sources for a movie"""
    cache_key = f"streams:{movie_id}:{preferred_quality}:{preferred_language}"
    
    # Try cache
    cached = await cache_service.get(cache_key)
    if cached:
        return StreamResponse(movie_id=movie_id, sources=cached)
    
    # Aggregate streams from providers
    sources = await stream_aggregator.get_streams(
        movie_id=movie_id,
        preferred_quality=preferred_quality,
        preferred_language=preferred_language
    )
    
    if not sources:
        # Return empty response - frontend can handle no sources
        return StreamResponse(movie_id=movie_id, sources=[])
    
    # Cache result
    await cache_service.set(cache_key, sources, ttl=settings.CACHE_TTL_STREAMS)
    
    return StreamResponse(movie_id=movie_id, sources=sources)


@router.get("/{movie_id}/proxy")
async def get_proxied_stream(
    movie_id: int,
    source_url: str = Query(..., description="Original stream URL to proxy"),
    db: AsyncSession = Depends(get_db)
):
    """Get proxied stream URL (for CORS bypass)"""
    # Generate proxy URL through stream proxy service
    proxy_url = f"{settings.STREAM_PROXY_URL}/proxy?url={source_url}"
    
    return {
        "movie_id": movie_id,
        "proxy_url": proxy_url,
        "original_url": source_url
    }


@router.post("/{movie_id}/report")
async def report_stream_issue(
    movie_id: int,
    source_url: str = Query(...),
    issue_type: str = Query(..., regex="^(not_working|buffering|wrong_content|quality_issue)$"),
    db: AsyncSession = Depends(get_db)
):
    """Report a stream issue"""
    # TODO: Implement stream issue reporting
    # This would track problematic streams and reduce their reliability score
    
    return {
        "success": True,
        "message": "Issue reported successfully",
        "movie_id": movie_id,
        "issue_type": issue_type
    }
