"""
Stream model
"""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, Float, Boolean
from sqlalchemy.orm import relationship
from core.database import Base


class Stream(Base):
    """Movie stream/link model"""
    __tablename__ = "streams"
    
    id = Column(Integer, primary_key=True)
    movie_id = Column(Integer, ForeignKey("movies.id"), nullable=False, index=True)
    provider_id = Column(Integer, ForeignKey("providers.id"), nullable=False, index=True)
    
    # Stream details
    url = Column(String(2000), nullable=False)
    quality = Column(String(20), default="720p")  # 480p, 720p, 1080p, 4k
    
    # Stream type: hls, dash, mp4, webm, etc.
    stream_type = Column(String(20), default="mp4")
    
    # Language
    language = Column(String(10), default="en")
    
    # Subtitles available (JSON array)
    subtitles = Column(String(1000), nullable=True)
    
    # Reliability
    reliability_score = Column(Float, default=50.0)
    
    # Status
    is_working = Column(Boolean, default=True)
    last_checked_at = Column(DateTime, nullable=True)
    
    # Usage stats
    access_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    movie = relationship("Movie", back_populates="streams")
    provider = relationship("Provider", back_populates="streams")
