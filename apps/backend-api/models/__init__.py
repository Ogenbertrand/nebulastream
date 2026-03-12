"""
Database models
"""

from models.favorite import Favorite
from models.genre import Genre
from models.movie import Movie
from models.movie_genre import movie_genre
from models.provider import Provider
from models.stream import Stream
from models.user import User
from models.watch_history import WatchHistory

__all__ = [
    "User",
    "Movie",
    "Genre",
    "movie_genre",
    "WatchHistory",
    "Favorite",
    "Provider",
    "Stream",
]
