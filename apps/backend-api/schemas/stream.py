"""
Stream schemas
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class StreamSource(BaseModel):
    """Stream source from provider"""
    url: str
    quality: str = "720p"
    stream_type: str = "mp4"  # hls, dash, mp4, webm
    language: str = "en"
    subtitles: List[dict] = []
    headers: Optional[dict] = None
    provider_name: str
    reliability_score: float = 50.0


class Stream(BaseModel):
    """Stream database model schema"""
    id: int
    movie_id: int
    provider_id: int
    url: str
    quality: str
    stream_type: str
    language: str
    reliability_score: float
    is_working: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class StreamRequest(BaseModel):
    """Stream request"""
    movie_id: int
    preferred_quality: Optional[str] = "720p"
    preferred_language: Optional[str] = "en"


class StreamResponse(BaseModel):
    """Stream response"""
    movie_id: int
    sources: List[StreamSource]
    subtitles: List[dict] = []


class PlaybackSessionResponse(BaseModel):
    """Playback session response from streaming service"""
    session_id: str
    manifest_url: str
    status: str
    ready: bool
    expires_at: datetime
    

class ProviderInfo(BaseModel):
    """Provider information"""
    id: int
    name: str
    display_name: str
    provider_type: str
    reliability_score: float
    is_enabled: bool
