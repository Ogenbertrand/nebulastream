"""
Movie-Genre association table
"""

from sqlalchemy import Column, ForeignKey, Integer, Table
from core.database import Base


movie_genre = Table(
    "movie_genre",
    Base.metadata,
    Column("movie_id", Integer, ForeignKey("movies.id"), primary_key=True),
    Column("genre_id", Integer, ForeignKey("genres.id"), primary_key=True),
)
