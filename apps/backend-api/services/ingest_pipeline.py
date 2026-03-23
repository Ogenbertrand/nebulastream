"""
Ingest + rewrite pipeline resolver.
Selects a stream source that can be rewritten by the Rust streaming service.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from core.logging import get_logger
from schemas.stream import StreamSource
from services.stream_finder import find_streams

logger = get_logger("ingest_pipeline")

QUALITY_RANK = {"4k": 4, "1080p": 3, "720p": 2, "480p": 1}


@dataclass
class IngestCandidate:
    source_url: str
    stream_type: str
    quality: str
    provider_name: str
    reliability_score: float


def _quality_score(quality: str) -> int:
    return QUALITY_RANK.get(quality or "", 0)


def _candidate_score(stream: StreamSource) -> tuple:
    return (
        1 if stream.stream_type == "hls" else 0,
        _quality_score(stream.quality),
        stream.reliability_score or 0,
    )


async def resolve_ingest_source(
    movie_id: int,
    preferred_quality: str = "720p",
    preferred_language: str = "en",
) -> Optional[IngestCandidate]:
    streams = await find_streams(movie_id)
    if not streams:
        logger.info("ingest.no_streams", movie_id=movie_id)
        return None

    hls_streams = [
        stream
        for stream in streams
        if stream.stream_type == "hls" and stream.url.lower().endswith(".m3u8")
    ]

    if not hls_streams:
        logger.info("ingest.no_hls", movie_id=movie_id)
        return None

    hls_streams.sort(key=_candidate_score, reverse=True)
    selected = hls_streams[0]

    logger.info(
        "ingest.selected",
        movie_id=movie_id,
        provider=selected.provider_name,
        quality=selected.quality,
    )

    return IngestCandidate(
        source_url=selected.url,
        stream_type=selected.stream_type,
        quality=selected.quality,
        provider_name=selected.provider_name,
        reliability_score=selected.reliability_score,
    )
