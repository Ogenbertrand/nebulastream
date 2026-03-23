"""
Torrent ingest schemas.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class TorrentIngestRequest(BaseModel):
    movie_id: int
    magnet_link: Optional[str] = None
    torrent_url: Optional[str] = None
    quality: Optional[str] = "720p"


class TorrentIngestResponse(BaseModel):
    job_id: str
    movie_id: int
    stream_id: Optional[str] = None
    stream_url: Optional[str] = None
    status_url: Optional[str] = None
    session_id: Optional[str] = None
    manifest_url: Optional[str] = None
    ready: Optional[bool] = None
    status: str
    created_at: datetime
    updated_at: datetime


class TorrentIngestStatus(BaseModel):
    job_id: str
    status: str
    progress: Optional[float] = None
    download_speed: Optional[int] = None
    peers: Optional[int] = None
    seeds: Optional[int] = None
    ready: Optional[bool] = None
    stream_url: Optional[str] = None
    session_id: Optional[str] = None
    manifest_url: Optional[str] = None
    updated_at: datetime
