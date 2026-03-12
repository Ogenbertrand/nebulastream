"""
Watch history model
"""

from datetime import datetime
from sqlalchemy import Column, ForeignKey, Integer, DateTime, Float
from sqlalchemy.orm import relationship
from core.database import Base


class WatchHistory(Base):
    """User watch history model"""
    __tablename__ = "watch_history"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    movie_id = Column(Integer, ForeignKey("movies.id"), nullable=False, index=True)
    
    # Progress
    progress_seconds = Column(Integer, default=0)
    duration_seconds = Column(Integer, nullable=True)
    progress_percent = Column(Float, default=0.0)
    
    # Status
    is_completed = Column(Integer, default=0)  # 0 = no, 1 = yes
    
    # Timestamps
    watched_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="watch_history")
    movie = relationship("Movie", back_populates="watch_history")
    
    def __repr__(self):
        return f"<WatchHistory(user_id={self.user_id}, movie_id={self.movie_id}, progress={self.progress_percent}%)>"
