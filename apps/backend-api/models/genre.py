"""
Genre model
"""

from sqlalchemy import Column, String, Integer
from sqlalchemy.orm import relationship
from core.database import Base


class Genre(Base):
    """Movie genre model"""
    __tablename__ = "genres"
    
    id = Column(Integer, primary_key=True)
    tmdb_id = Column(Integer, unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    
    # Relationships
    movies = relationship("Movie", secondary="movie_genre", back_populates="genres")
