"""
Watch history schemas
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from schemas.movie import MovieList


class WatchHistoryBase(BaseModel):
    """Base watch history schema"""
    movie_id: int
    progress_seconds: int = 0
    duration_seconds: Optional[int] = None
    progress_percent: float = 0.0
    is_completed: bool = False


class WatchHistoryCreate(WatchHistoryBase):
    """Watch history creation schema"""
    pass


class WatchHistoryUpdate(BaseModel):
    """Watch history update schema"""
    progress_seconds: int
    duration_seconds: Optional[int] = None
    progress_percent: float
    is_completed: bool = False


class WatchHistory(WatchHistoryBase):
    """Watch history response schema"""
    id: int
    user_id: int
    watched_at: datetime
    updated_at: datetime
    movie: Optional[MovieList] = None
    
    class Config:
        from_attributes = True


class ContinueWatching(BaseModel):
    """Continue watching item"""
    movie: MovieList
    progress_seconds: int
    duration_seconds: Optional[int]
    progress_percent: float
    last_watched_at: datetime
