"""
Favorite model
"""

from datetime import datetime
from sqlalchemy import Column, ForeignKey, Integer, DateTime
from sqlalchemy.orm import relationship
from core.database import Base


class Favorite(Base):
    """User favorites model"""
    __tablename__ = "favorites"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    movie_id = Column(Integer, ForeignKey("movies.id"), nullable=False, index=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="favorites")
    movie = relationship("Movie", back_populates="favorites")
