"""SuperEmbed (Multiembed) provider scraper."""

from typing import List, Optional

import httpx

from core.logging import get_logger
from schemas.stream import StreamSource
from services.providers.common import scrape_provider_streams

logger = get_logger("provider.superembed")

BASE_URL = "https://multiembed.mov"
PROVIDER_NAME = "SuperEmbed"
RELIABILITY_SCORE = 70.0


async def _get_streams(tmdb_id: int, client: httpx.AsyncClient) -> List[StreamSource]:
    embed_url = f"{BASE_URL}/?video_id={tmdb_id}&tmdb=1"
    return await scrape_provider_streams(embed_url, PROVIDER_NAME, RELIABILITY_SCORE, client)


async def _get_tv_streams(
    tmdb_id: int,
    season: int,
    episode: int,
    client: httpx.AsyncClient,
) -> List[StreamSource]:
    embed_url = f"{BASE_URL}/?video_id={tmdb_id}&tmdb=1&s={season}&e={episode}"
    return await scrape_provider_streams(embed_url, PROVIDER_NAME, RELIABILITY_SCORE, client)


async def get_streams(
    tmdb_id: int,
    client: Optional[httpx.AsyncClient] = None,
) -> List[StreamSource]:
    if client is None:
        async with httpx.AsyncClient(timeout=15.0) as owned_client:
            return await _get_streams(tmdb_id, owned_client)
    return await _get_streams(tmdb_id, client)


async def get_tv_streams(
    tmdb_id: int,
    season: int,
    episode: int,
    client: Optional[httpx.AsyncClient] = None,
) -> List[StreamSource]:
    if client is None:
        async with httpx.AsyncClient(timeout=15.0) as owned_client:
            return await _get_tv_streams(tmdb_id, season, episode, owned_client)
    return await _get_tv_streams(tmdb_id, season, episode, client)
