"""
Stream endpoints
"""

import asyncio
from typing import List
from urllib.parse import quote_plus, parse_qs, unquote_plus, urlparse
from fastapi import APIRouter, Depends, HTTPException, Query, status, Body
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from schemas.ingest import TorrentIngestResponse, TorrentIngestStatus
from schemas.stream import PlaybackSessionResponse, StreamResponse, StreamSource
from services.stream_aggregator import stream_aggregator
from services.stream_finder import find_streams, find_tv_streams
from services.ingest_pipeline import resolve_ingest_source
from services.streaming_client import create_playback_session
from services.torrent_ingest import torrent_ingest_worker
from core.logging import get_logger
from services.cache import cache_service
from api.routes.auth import get_current_active_user

router = APIRouter()
logger = get_logger("streams")


class StreamSessionRequest(BaseModel):
    source_url: str | None = None
    magnet_link: str | None = None
    headers: dict[str, str] | None = None


def _normalize_sources(raw_sources: List) -> List[StreamSource]:
    normalized: List[StreamSource] = []
    for source in raw_sources:
        if isinstance(source, StreamSource):
            normalized.append(source)
        else:
            normalized.append(StreamSource(**source))
    return normalized


def _unwrap_proxy_url(source_url: str | None) -> str | None:
    if not source_url:
        return None
    try:
        parsed = urlparse(source_url)
        if not parsed.path or "/proxy" not in parsed.path:
            return source_url
        query = parse_qs(parsed.query)
        raw_url = query.get("url", [None])[0]
        if raw_url:
            return unquote_plus(raw_url)
    except Exception:
        return source_url
    return source_url


def _pick_internal_hls_candidate(sources: List[StreamSource]) -> StreamSource | None:
    hls_sources = [source for source in sources if source.stream_type == "hls"]
    if not hls_sources:
        return None

    quality_order = {"4k": 4, "1080p": 3, "720p": 2, "480p": 1}

    def sort_key(source: StreamSource):
        has_headers = 1 if source.headers else 0
        reliability = source.reliability_score or 0
        quality_score = quality_order.get(source.quality or "720p", 0)
        return (has_headers, reliability, quality_score)

    return sorted(hls_sources, key=sort_key, reverse=True)[0]


@router.get("/{movie_id}", response_model=StreamResponse)
async def get_movie_streams(
    movie_id: int,
    preferred_quality: str = Query("720p", pattern="^(480p|720p|1080p|4k)$"),
    preferred_language: str = Query("en"),
    prefer_internal: bool = Query(settings.STREAMING_PREFER_INTERNAL),
    db: AsyncSession = Depends(get_db)
):
    """Get streaming sources for a movie"""
    cache_key = f"streams:{movie_id}:{preferred_quality}:{preferred_language}"
    
    # Try cache
    cached = await cache_service.get(cache_key)
    if cached and not prefer_internal:
        return StreamResponse(movie_id=movie_id, sources=cached)

    sources: List[StreamSource] = _normalize_sources(cached) if cached else []
    
    async def _with_timeout(coro, label: str):
        try:
            timeout_seconds = settings.STREAM_LOOKUP_TIMEOUT_SECONDS
            if label == "direct" and prefer_internal:
                timeout_seconds = max(timeout_seconds, 45)
            if label == "direct" and settings.STREAM_SCRAPER_ENABLED:
                scraper_budget = (
                    settings.STREAM_SCRAPER_TIMEOUT_SECONDS
                    + (settings.STREAM_SCRAPER_WAIT_MS / 1000)
                    + 5
                )
                timeout_seconds = max(timeout_seconds, scraper_budget)
            return await asyncio.wait_for(coro, timeout=timeout_seconds)
        except asyncio.TimeoutError:
            logger.warning("streams.lookup_timeout", movie_id=movie_id, source=label)
            return []
        except Exception as exc:
            logger.warning("streams.lookup_error", movie_id=movie_id, source=label, error=str(exc))
            return []

    if sources:
        direct_sources = await _with_timeout(find_streams(movie_id), "direct") if prefer_internal else []
        embed_sources: List[StreamSource] = []
    else:
        direct_task = _with_timeout(find_streams(movie_id), "direct")
        embed_task = _with_timeout(
            stream_aggregator.get_streams(
                movie_id=movie_id,
                preferred_quality=preferred_quality,
                preferred_language=preferred_language,
            ),
            "embed",
        )
        direct_sources, embed_sources = await asyncio.gather(direct_task, embed_task)

    if direct_sources:
        logger.info(
            "streams.direct_found",
            movie_id=movie_id,
            count=len(direct_sources),
        )
        sources.extend(direct_sources)
    if embed_sources:
        logger.info(
            "streams.embed_found",
            movie_id=movie_id,
            count=len(embed_sources),
        )
        sources.extend(embed_sources)

    sources = _normalize_sources(sources)

    if prefer_internal and settings.ENABLE_TORRENT_STREAMING:
        candidate = await resolve_ingest_source(
            movie_id=movie_id,
            preferred_quality=preferred_quality,
            preferred_language=preferred_language,
        )
        if candidate:
            session = await create_playback_session(
                movie_id=movie_id,
                tmdb_id=movie_id,
                quality=candidate.quality,
                source_url=candidate.source_url,
            )
            if session and session.get("ready"):
                sources.insert(
                    0,
                    StreamSource(
                        url=session["manifest_url"],
                        quality=candidate.quality,
                        stream_type="hls",
                        language=preferred_language,
                        subtitles=[],
                        provider_name="NebulaStream",
                        reliability_score=95.0,
                    ),
                )
            else:
                logger.info("streams.internal_not_ready", movie_id=movie_id)

    if prefer_internal and not any(source.provider_name == "NebulaStream" for source in sources):
        hls_candidate = _pick_internal_hls_candidate(sources)
        if hls_candidate:
            session = await create_playback_session(
                movie_id=movie_id,
                tmdb_id=movie_id,
                quality=hls_candidate.quality,
                source_url=_unwrap_proxy_url(hls_candidate.url),
                headers=hls_candidate.headers,
            )
            if session and session.get("ready"):
                sources.insert(
                    0,
                    StreamSource(
                        url=session["manifest_url"],
                        quality=hls_candidate.quality,
                        stream_type="hls",
                        language=preferred_language,
                        subtitles=hls_candidate.subtitles,
                        provider_name="NebulaStream",
                        reliability_score=95.0,
                    ),
                )
    
    if not sources:
        # Return empty response - frontend can handle no sources
        return StreamResponse(movie_id=movie_id, sources=[])

    # Proxy direct/HLS sources to avoid CORS issues in browsers
    for source in sources:
        if source.stream_type != "embed" and source.provider_name != "NebulaStream":
            if source.url.startswith(settings.STREAM_PROXY_URL) or "/proxy?url=" in source.url:
                continue
            source.url = f"{settings.STREAM_PROXY_URL}/proxy?url={quote_plus(source.url)}"

    # Cache result (skip internal sources with signed URLs)
    if not any(source.provider_name == "NebulaStream" for source in sources):
        await cache_service.set(cache_key, sources, ttl=settings.CACHE_TTL_STREAMS)
    
    return StreamResponse(movie_id=movie_id, sources=sources)


@router.get("/tv/{tv_id}", response_model=StreamResponse)
async def get_tv_streams(
    tv_id: int,
    season: int = Query(..., ge=1),
    episode: int = Query(..., ge=1),
    preferred_quality: str = Query("720p", pattern="^(480p|720p|1080p|4k)$"),
    preferred_language: str = Query("en"),
    prefer_internal: bool = Query(settings.STREAMING_PREFER_INTERNAL),
    db: AsyncSession = Depends(get_db),
):
    """Get streaming sources for a TV episode"""
    cache_key = f"streams:tv:{tv_id}:{season}:{episode}:{preferred_quality}:{preferred_language}"

    cached = await cache_service.get(cache_key)
    if cached and not prefer_internal:
        return StreamResponse(movie_id=tv_id, sources=cached)

    sources: List[StreamSource] = _normalize_sources(cached) if cached else []

    async def _with_timeout(coro, label: str):
        try:
            timeout_seconds = settings.STREAM_LOOKUP_TIMEOUT_SECONDS
            if label == "direct" and prefer_internal:
                timeout_seconds = max(timeout_seconds, 45)
            if label == "direct" and settings.STREAM_SCRAPER_ENABLED:
                scraper_budget = (
                    settings.STREAM_SCRAPER_TIMEOUT_SECONDS
                    + (settings.STREAM_SCRAPER_WAIT_MS / 1000)
                    + 5
                )
                timeout_seconds = max(timeout_seconds, scraper_budget)
            return await asyncio.wait_for(coro, timeout=timeout_seconds)
        except asyncio.TimeoutError:
            logger.warning(
                "streams.lookup_timeout",
                movie_id=tv_id,
                season=season,
                episode=episode,
                source=label,
            )
            return []
        except Exception as exc:
            logger.warning(
                "streams.lookup_error",
                movie_id=tv_id,
                season=season,
                episode=episode,
                source=label,
                error=str(exc),
            )
            return []

    if sources:
        direct_sources = await _with_timeout(find_tv_streams(tv_id, season, episode), "direct") if prefer_internal else []
        embed_sources: List[StreamSource] = []
    else:
        direct_task = _with_timeout(find_tv_streams(tv_id, season, episode), "direct")
        embed_task = _with_timeout(
            stream_aggregator.get_tv_streams(
                tv_id=tv_id,
                season=season,
                episode=episode,
                preferred_quality=preferred_quality,
                preferred_language=preferred_language,
            ),
            "embed",
        )
        direct_sources, embed_sources = await asyncio.gather(direct_task, embed_task)

    if direct_sources:
        logger.info(
            "streams.direct_found",
            movie_id=tv_id,
            season=season,
            episode=episode,
            count=len(direct_sources),
        )
        sources.extend(direct_sources)
    if embed_sources:
        logger.info(
            "streams.embed_found",
            movie_id=tv_id,
            season=season,
            episode=episode,
            count=len(embed_sources),
        )
        sources.extend(embed_sources)

    sources = _normalize_sources(sources)

    if prefer_internal and not any(source.provider_name == "NebulaStream" for source in sources):
        hls_candidate = _pick_internal_hls_candidate(sources)
        if hls_candidate:
            session = await create_playback_session(
                movie_id=tv_id,
                tmdb_id=tv_id,
                quality=hls_candidate.quality,
                source_url=_unwrap_proxy_url(hls_candidate.url),
                headers=hls_candidate.headers,
            )
            if session and session.get("ready"):
                sources.insert(
                    0,
                    StreamSource(
                        url=session["manifest_url"],
                        quality=hls_candidate.quality,
                        stream_type="hls",
                        language=preferred_language,
                        subtitles=hls_candidate.subtitles,
                        provider_name="NebulaStream",
                        reliability_score=95.0,
                    ),
                )

    if not sources:
        return StreamResponse(movie_id=tv_id, sources=[])

    for source in sources:
        if source.stream_type != "embed" and source.provider_name != "NebulaStream":
            if source.url.startswith(settings.STREAM_PROXY_URL) or "/proxy?url=" in source.url:
                continue
            source.url = f"{settings.STREAM_PROXY_URL}/proxy?url={quote_plus(source.url)}"

    if not any(source.provider_name == "NebulaStream" for source in sources):
        await cache_service.set(cache_key, sources, ttl=settings.CACHE_TTL_STREAMS)

    return StreamResponse(movie_id=tv_id, sources=sources)


@router.post("/{movie_id}/session", response_model=PlaybackSessionResponse)
async def create_internal_session(
    movie_id: int,
    preferred_quality: str = Query("720p", pattern="^(480p|720p|1080p|4k)$"),
    preferred_language: str = Query("en"),
    source_url: str | None = Query(None),
    magnet_link: str | None = Query(None),
    payload: StreamSessionRequest | None = Body(None),
    current_user=Depends(get_current_active_user),
):
    """Create a playback session via the streaming service."""
    candidate = None
    resolved_url = _unwrap_proxy_url(payload.source_url if payload and payload.source_url else source_url)
    resolved_magnet = payload.magnet_link if payload and payload.magnet_link else magnet_link
    headers = payload.headers if payload and payload.headers else None

    if not resolved_url and not resolved_magnet:
        candidate = await resolve_ingest_source(
            movie_id=movie_id,
            preferred_quality=preferred_quality,
            preferred_language=preferred_language,
        )
        if candidate:
            resolved_url = candidate.source_url
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="source_url or magnet_link is required",
            )

    session = await create_playback_session(
        movie_id=movie_id,
        tmdb_id=movie_id,
        quality=candidate.quality if candidate else preferred_quality,
        source_url=resolved_url,
        magnet_link=resolved_magnet,
        headers=headers,
    )

    if not session:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Streaming service unavailable")

    return session


@router.post("/tv/{tv_id}/session", response_model=PlaybackSessionResponse)
async def create_tv_session(
    tv_id: int,
    season: int = Query(..., ge=1),
    episode: int = Query(..., ge=1),
    preferred_quality: str = Query("720p", pattern="^(480p|720p|1080p|4k)$"),
    preferred_language: str = Query("en"),
    source_url: str | None = Query(None),
    magnet_link: str | None = Query(None),
    payload: StreamSessionRequest | None = Body(None),
    current_user=Depends(get_current_active_user),
):
    """Create a playback session for a TV episode via the streaming service."""
    resolved_url = _unwrap_proxy_url(payload.source_url if payload and payload.source_url else source_url)
    resolved_magnet = payload.magnet_link if payload and payload.magnet_link else magnet_link
    headers = payload.headers if payload and payload.headers else None

    if not resolved_url and not resolved_magnet:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="source_url or magnet_link is required",
        )

    session = await create_playback_session(
        movie_id=tv_id,
        tmdb_id=tv_id,
        title=f"tv:{tv_id}:S{season:02d}E{episode:02d}",
        quality=preferred_quality,
        source_url=resolved_url,
        magnet_link=resolved_magnet,
        headers=headers,
    )

    if not session:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Streaming service unavailable")

    return session


@router.post("/{movie_id}/ingest", response_model=TorrentIngestResponse)
async def start_torrent_ingest(
    movie_id: int,
    magnet_link: str | None = Query(None),
    torrent_url: str | None = Query(None),
    quality: str = Query("720p", pattern="^(480p|720p|1080p|4k)$"),
    current_user=Depends(get_current_active_user),
):
    """Start a torrent ingest job via the torrent-engine."""
    try:
        job = await torrent_ingest_worker.start_ingest(
            movie_id=movie_id,
            magnet_link=magnet_link,
            torrent_url=torrent_url,
            quality=quality,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return TorrentIngestResponse(
        job_id=job.job_id,
        movie_id=job.movie_id,
        stream_id=job.stream_id,
        stream_url=job.stream_url,
        status_url=job.status_url,
        session_id=job.session_id,
        manifest_url=job.manifest_url,
        ready=job.ready,
        status=job.status,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


@router.get("/ingest/{job_id}", response_model=TorrentIngestStatus)
async def get_torrent_ingest_status(
    job_id: str,
    current_user=Depends(get_current_active_user),
):
    """Get ingest job status and refresh from torrent-engine."""
    job = torrent_ingest_worker.get_job(job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ingest job not found")

    payload = await torrent_ingest_worker.refresh_status(job_id)
    if not payload:
        return TorrentIngestStatus(
            job_id=job.job_id,
            status=job.status,
            progress=None,
            download_speed=None,
            peers=None,
            seeds=None,
            ready=job.ready,
            stream_url=job.stream_url,
            session_id=job.session_id,
            manifest_url=job.manifest_url,
            updated_at=job.updated_at,
        )

    return TorrentIngestStatus(
        job_id=job.job_id,
        status=payload.get("status", job.status),
        progress=payload.get("progress"),
        download_speed=payload.get("download_speed"),
        peers=payload.get("peers"),
        seeds=payload.get("seeds"),
        ready=payload.get("ready", job.ready),
        stream_url=payload.get("stream_url"),
        session_id=job.session_id,
        manifest_url=job.manifest_url,
        updated_at=job.updated_at,
    )


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
    issue_type: str = Query(..., pattern="^(not_working|buffering|wrong_content|quality_issue)$"),
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
