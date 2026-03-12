"""
Movie model
"""

from datetime import datetime, date
from sqlalchemy import Column, String, DateTime, Integer, Float, Text, Date, Boolean
from sqlalchemy.orm import relationship
from core.database import Base


class Movie(Base):
    """Movie metadata model"""
    __tablename__ = "movies"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # External IDs
    tmdb_id = Column(Integer, unique=True, index=True, nullable=True)
    imdb_id = Column(String(20), unique=True, index=True, nullable=True)
    
    # Basic info
    title = Column(String(255), nullable=False, index=True)
    original_title = Column(String(255), nullable=True)
    overview = Column(Text, nullable=True)
    tagline = Column(String(500), nullable=True)
    
    # Media
    poster_path = Column(String(500), nullable=True)
    backdrop_path = Column(String(500), nullable=True)
    
    # Metadata
    release_date = Column(Date, nullable=True, index=True)
    runtime = Column(Integer, nullable=True)  # in minutes
    
    # Ratings
    vote_average = Column(Float, default=0.0)
    vote_count = Column(Integer, default=0)
    popularity = Column(Float, default=0.0)
    
    # Content details
    adult = Column(Boolean, default=False)
    original_language = Column(String(10), nullable=True)
    
    # Additional data (stored as JSON string)
    trailers = Column(Text, nullable=True)  # JSON array
    cast = Column(Text, nullable=True)  # JSON array
    crew = Column(Text, nullable=True)  # JSON array
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_synced_at = Column(DateTime, nullable=True)
    
    # Relationships
    genres = relationship("Genre", secondary="movie_genre", back_populates="movies")
    watch_history = relationship("WatchHistory", back_populates="movie")
    favorites = relationship("Favorite", back_populates="movie")
    streams = relationship("Stream", back_populates="movie")
    
    def __repr__(self):
        return f"<Movie(id={self.id}, title='{self.title}', tmdb_id={self.tmdb_id})>"
