"""
Pydantic schemas for API request/response validation
"""

from schemas.auth import Token, TokenPayload, UserLogin, UserRegister
from schemas.movie import Movie, MovieCreate, MovieDetail, MovieList
from schemas.user import User, UserCreate, UserUpdate, UserProfile
from schemas.watch_history import WatchHistory, WatchHistoryCreate, WatchHistoryUpdate, ContinueWatching
from schemas.stream import Stream, StreamSource, StreamRequest, StreamResponse
from schemas.common import PaginatedResponse, ErrorResponse, SuccessResponse

__all__ = [
    "Token",
    "TokenPayload",
    "UserLogin",
    "UserRegister",
    "Movie",
    "MovieCreate",
    "MovieDetail",
    "MovieList",
    "User",
    "UserCreate",
    "UserUpdate",
    "UserProfile",
    "WatchHistory",
    "WatchHistoryCreate",
    "WatchHistoryUpdate",
    "ContinueWatching",
    "Stream",
    "StreamSource",
    "StreamRequest",
    "StreamResponse",
    "PaginatedResponse",
    "ErrorResponse",
    "SuccessResponse",
]
