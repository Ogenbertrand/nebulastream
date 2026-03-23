"""
Stream Finder Engine
Attempts to discover direct HLS/MP4 streams from provider pages.
"""

from __future__ import annotations

import asyncio
from typing import Iterable, List, Set

import httpx

from core.logging import get_logger
from core.config import settings
from schemas.stream import StreamSource
from services.cache import cache_service
from services.scraper_engine import scrape_streams, scrape_tv_streams
from services.providers import (
    vidsrc_resolver_streams,
    vidsrc_resolver_tv_streams,
)

logger = get_logger("stream_finder")

CACHE_TTL_SECONDS = 6 * 60 * 60
VALIDATION_CONCURRENCY = 6


def _coerce_streams(raw: Iterable[StreamSource | dict]) -> List[StreamSource]:
    normalized: List[StreamSource] = []
    for item in raw:
        if isinstance(item, StreamSource):
            normalized.append(item)
            continue
        if isinstance(item, dict):
            try:
                normalized.append(StreamSource(**item))
            except Exception as exc:
                logger.warning("stream.coerce_failed", error=str(exc), payload=item)
    return normalized


async def validate_stream(
    url: str,
    client: httpx.AsyncClient,
    headers: dict | None = None,
) -> bool:
    try:
        response = await client.head(url, follow_redirects=True, headers=headers)
    except Exception as exc:
        logger.warning("stream.validate_head_error", url=url, error=str(exc))
        response = None

    if response is not None and response.status_code in (200, 206):
        content_type = (response.headers.get("content-type") or "").lower()
        if "video" in content_type or "mpegurl" in content_type:
            return True
        if url.lower().endswith(".m3u8"):
            return True
        if url.lower().endswith(".mp4"):
            return True

    if response is not None and response.status_code not in (200, 206, 405, 403):
        return False

    try:
        request_headers = {"Range": "bytes=0-0"}
        if headers:
            request_headers.update(headers)
        response = await client.get(
            url,
            headers=request_headers,
            follow_redirects=True,
        )
    except Exception as exc:
        logger.warning("stream.validate_get_error", url=url, error=str(exc))
        return False

    if response.status_code not in (200, 206):
        return False

    content_type = (response.headers.get("content-type") or "").lower()
    if "video" in content_type or "mpegurl" in content_type:
        return True

    return url.lower().endswith(".m3u8") or url.lower().endswith(".mp4")


async def _validate_streams(streams: List[StreamSource], client: httpx.AsyncClient) -> List[StreamSource]:
    semaphore = asyncio.Semaphore(VALIDATION_CONCURRENCY)

    async def _validate(stream: StreamSource) -> StreamSource | None:
        async with semaphore:
            ok = await validate_stream(stream.url, client, stream.headers)
        logger.info(
            "stream.validate_result",
            url=stream.url,
            provider=stream.provider_name,
            ok=ok,
        )
        return stream if ok else None

    tasks = [_validate(stream) for stream in streams]
    results = await asyncio.gather(*tasks, return_exceptions=False)
    return [stream for stream in results if stream is not None]


def _dedupe_streams(streams: Iterable[StreamSource]) -> List[StreamSource]:
    seen: Set[str] = set()
    unique: List[StreamSource] = []
    for stream in streams:
        if stream.url in seen:
            continue
        seen.add(stream.url)
        unique.append(stream)
    return unique


async def find_streams(tmdb_id: int) -> List[StreamSource]:
    cache_key = f"stream:{tmdb_id}"
    cached = await cache_service.get(cache_key)
    if cached:
        logger.info("stream.finder_cache_hit", tmdb_id=tmdb_id)
        return _coerce_streams(cached)

    logger.info("stream.finder_start", tmdb_id=tmdb_id)

    async with httpx.AsyncClient(
        timeout=15.0,
        verify=not settings.STREAM_PROVIDER_SKIP_SSL_VERIFY,
    ) as client:
        provider_tasks = [
            vidsrc_resolver_streams(tmdb_id, client=client),
        ]

        provider_results = await asyncio.gather(*provider_tasks, return_exceptions=True)

        discovered: List[StreamSource] = []
        for result in provider_results:
            if isinstance(result, Exception):
                logger.warning("stream.provider_error", error=str(result))
                continue
            discovered.extend(result)

        direct_only = [stream for stream in discovered if stream.stream_type != "embed"]
        if not direct_only:
            logger.info("stream.finder_no_candidates", tmdb_id=tmdb_id)
            logger.info("stream.finder_fallback_scraper", tmdb_id=tmdb_id)
            discovered = await scrape_streams(tmdb_id)
            direct_only = [stream for stream in discovered if stream.stream_type != "embed"]
            if not direct_only:
                return []

        deduped = _dedupe_streams(direct_only)
        logger.info(
            "stream.finder_candidates",
            tmdb_id=tmdb_id,
            count=len(deduped),
        )

        validated = await _validate_streams(deduped, client)

    if validated:
        await cache_service.set(cache_key, validated, ttl=CACHE_TTL_SECONDS)
        logger.info(
            "stream.finder_success",
            tmdb_id=tmdb_id,
            count=len(validated),
        )
    else:
        logger.info("stream.finder_empty", tmdb_id=tmdb_id)

    return validated


async def find_tv_streams(tmdb_id: int, season: int, episode: int) -> List[StreamSource]:
    cache_key = f"stream:tv:{tmdb_id}:{season}:{episode}"
    cached = await cache_service.get(cache_key)
    if cached:
        logger.info("stream.finder_cache_hit", tmdb_id=tmdb_id, season=season, episode=episode)
        return _coerce_streams(cached)

    logger.info("stream.finder_start", tmdb_id=tmdb_id, season=season, episode=episode)

    async with httpx.AsyncClient(
        timeout=15.0,
        verify=not settings.STREAM_PROVIDER_SKIP_SSL_VERIFY,
    ) as client:
        provider_tasks = [
            vidsrc_resolver_tv_streams(tmdb_id, season, episode, client=client),
        ]

        provider_results = await asyncio.gather(*provider_tasks, return_exceptions=True)

        discovered: List[StreamSource] = []
        for result in provider_results:
            if isinstance(result, Exception):
                logger.warning("stream.provider_error", error=str(result))
                continue
            discovered.extend(result)

        direct_only = [stream for stream in discovered if stream.stream_type != "embed"]
        if not direct_only:
            logger.info("stream.finder_no_candidates", tmdb_id=tmdb_id, season=season, episode=episode)
            logger.info(
                "stream.finder_fallback_scraper",
                tmdb_id=tmdb_id,
                season=season,
                episode=episode,
            )
            discovered = await scrape_tv_streams(tmdb_id, season, episode)
            direct_only = [stream for stream in discovered if stream.stream_type != "embed"]
            if not direct_only:
                return []

        deduped = _dedupe_streams(direct_only)
        logger.info(
            "stream.finder_candidates",
            tmdb_id=tmdb_id,
            season=season,
            episode=episode,
            count=len(deduped),
        )

        validated = await _validate_streams(deduped, client)

    if validated:
        await cache_service.set(cache_key, validated, ttl=CACHE_TTL_SECONDS)
        logger.info(
            "stream.finder_success",
            tmdb_id=tmdb_id,
            season=season,
            episode=episode,
            count=len(validated),
        )
    else:
        logger.info("stream.finder_empty", tmdb_id=tmdb_id, season=season, episode=episode)

    return validated
