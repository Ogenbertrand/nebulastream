"""
Torrent ingest worker scaffold using the torrent-engine service.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Optional
from urllib.parse import urljoin, urlparse, urlunparse
from uuid import uuid4

import httpx

from core.config import settings
from core.logging import get_logger
from services.streaming_client import create_playback_session

logger = get_logger("torrent_ingest")


@dataclass
class IngestJob:
    job_id: str
    movie_id: int
    magnet_link: Optional[str]
    torrent_url: Optional[str]
    quality: str
    stream_id: Optional[str]
    stream_url: Optional[str]
    status_url: Optional[str]
    session_id: Optional[str]
    manifest_url: Optional[str]
    ready: bool
    last_session_attempt: Optional[datetime]
    status: str
    created_at: datetime
    updated_at: datetime


def _absolute_url(base: str, maybe_relative: Optional[str]) -> Optional[str]:
    if not maybe_relative:
        return None
    if maybe_relative.startswith("http://") or maybe_relative.startswith("https://"):
        parsed = urlparse(maybe_relative)
        if parsed.hostname in {"localhost", "127.0.0.1"}:
            base_parsed = urlparse(base)
            if base_parsed.scheme and base_parsed.netloc:
                return urlunparse(
                    (
                        base_parsed.scheme,
                        base_parsed.netloc,
                        parsed.path,
                        parsed.params,
                        parsed.query,
                        parsed.fragment,
                    )
                )
        return maybe_relative
    return urljoin(base.rstrip("/") + "/", maybe_relative.lstrip("/"))


class TorrentIngestWorker:
    def __init__(self) -> None:
        self._jobs: Dict[str, IngestJob] = {}
        self._poll_task: Optional[asyncio.Task] = None

    async def start_ingest(
        self,
        movie_id: int,
        magnet_link: Optional[str] = None,
        torrent_url: Optional[str] = None,
        quality: str = "720p",
    ) -> IngestJob:
        if not magnet_link and not torrent_url:
            raise ValueError("magnet_link or torrent_url is required")

        payload = {
            "magnet_link": magnet_link,
            "torrent_url": torrent_url,
            "quality": quality,
            "name": f"movie-{movie_id}",
        }

        job = IngestJob(
            job_id=str(uuid4()),
            movie_id=movie_id,
            magnet_link=magnet_link,
            torrent_url=torrent_url,
            quality=quality,
            stream_id=None,
            stream_url=None,
            status_url=None,
            session_id=None,
            manifest_url=None,
            ready=False,
            last_session_attempt=None,
            status="starting",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        url = f"{settings.TORRENT_ENGINE_URL}/stream"
        timeout = getattr(settings, "TORRENT_ENGINE_TIMEOUT_SECONDS", 15)

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(url, json=payload)
        except Exception as exc:
            logger.warning("torrent.ingest.start_error", error=str(exc))
            job.status = "error"
            job.updated_at = datetime.utcnow()
            return job

        if response.status_code not in (200, 201):
            logger.warning(
                "torrent.ingest.start_failed",
                status=response.status_code,
                body=response.text,
            )
            job.status = "error"
            job.updated_at = datetime.utcnow()
            return job

        data = response.json()
        stream = data.get("stream") or {}
        stream_id = stream.get("stream_id")

        job.job_id = stream_id or job.job_id
        job.stream_id = stream_id
        job.stream_url = _absolute_url(settings.TORRENT_ENGINE_URL, stream.get("stream_url"))
        job.status_url = _absolute_url(settings.TORRENT_ENGINE_URL, stream.get("status_url"))
        job.status = "preparing"
        job.updated_at = datetime.utcnow()

        self._jobs[job.job_id] = job
        return job

    async def refresh_status(self, job_id: str) -> Optional[dict]:
        job = self._jobs.get(job_id)
        if not job or not job.status_url:
            return None

        timeout = getattr(settings, "TORRENT_ENGINE_TIMEOUT_SECONDS", 15)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(job.status_url)
        except Exception as exc:
            logger.warning("torrent.ingest.status_error", error=str(exc))
            return None

        if response.status_code != 200:
            return None

        payload = response.json()
        job.status = payload.get("status", job.status)
        job.updated_at = datetime.utcnow()
        if payload.get("stream_url"):
            job.stream_url = _absolute_url(settings.TORRENT_ENGINE_URL, payload.get("stream_url"))

        return payload

    async def poll_once(self) -> None:
        if not self._jobs:
            return
        now = datetime.utcnow()
        for job_id in list(self._jobs.keys()):
            job = self._jobs.get(job_id)
            if not job:
                continue
            payload = await self.refresh_status(job_id)
            if not payload:
                continue
            ready = bool(payload.get("ready")) or payload.get("status") == "streaming"
            job.ready = ready

            if ready and job.stream_url and not job.session_id:
                if not job.stream_url.lower().endswith(".m3u8"):
                    continue
                if job.last_session_attempt and (now - job.last_session_attempt).total_seconds() < 10:
                    continue
                job.last_session_attempt = now
                session = await create_playback_session(
                    movie_id=job.movie_id,
                    tmdb_id=job.movie_id,
                    quality=job.quality,
                    source_url=job.stream_url,
                )
                if session:
                    job.session_id = session.get("session_id")
                    job.manifest_url = session.get("manifest_url")
                    job.ready = bool(session.get("ready", job.ready))
                    job.status = "ready" if job.ready else "session_pending"
                    job.updated_at = datetime.utcnow()

    async def poll_loop(self, interval_seconds: int) -> None:
        while True:
            try:
                await self.poll_once()
            except Exception as exc:
                logger.warning("torrent.ingest.poll_error", error=str(exc))
            await asyncio.sleep(interval_seconds)

    def start_background_polling(self, interval_seconds: int) -> None:
        if self._poll_task and not self._poll_task.done():
            return
        self._poll_task = asyncio.create_task(self.poll_loop(interval_seconds))

    async def stop_background_polling(self) -> None:
        if not self._poll_task:
            return
        self._poll_task.cancel()
        try:
            await self._poll_task
        except asyncio.CancelledError:
            pass

    def get_job(self, job_id: str) -> Optional[IngestJob]:
        return self._jobs.get(job_id)


# Global worker instance
torrent_ingest_worker = TorrentIngestWorker()
