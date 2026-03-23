"""
Client for the Rust streaming service.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

import httpx

from core.config import settings
from core.logging import get_logger

logger = get_logger("streaming_client")


async def create_playback_session(
    movie_id: int,
    tmdb_id: Optional[int] = None,
    title: Optional[str] = None,
    year: Optional[int] = None,
    quality: str = "720p",
    source_url: Optional[str] = None,
    magnet_link: Optional[str] = None,
    headers: Optional[Dict[str, str]] = None,
) -> Optional[Dict[str, Any]]:
    payload = {
        "movie_id": movie_id,
        "tmdb_id": tmdb_id,
        "title": title,
        "year": year,
        "quality": quality,
        "source_url": source_url,
        "magnet_link": magnet_link,
        "headers": headers,
    }

    timeout = settings.STREAMING_SERVICE_TIMEOUT_SECONDS
    url = f"{settings.STREAMING_SERVICE_URL}/v1/sessions"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=payload)
    except Exception as exc:
        logger.warning("streaming.create_session_error", error=str(exc))
        return None

    if response.status_code not in (200, 201):
        logger.warning(
            "streaming.create_session_failed",
            status=response.status_code,
            body=response.text,
        )
        return None

    try:
        return response.json()
    except Exception as exc:
        logger.warning("streaming.create_session_decode_error", error=str(exc))
        return None


async def get_session_status(session_id: str) -> Optional[Dict[str, Any]]:
    timeout = settings.STREAMING_SERVICE_TIMEOUT_SECONDS
    url = f"{settings.STREAMING_SERVICE_URL}/v1/sessions/{session_id}"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url)
    except Exception as exc:
        logger.warning("streaming.status_error", error=str(exc))
        return None

    if response.status_code != 200:
        return None

    try:
        return response.json()
    except Exception:
        return None
