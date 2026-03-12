"""
Stream provider model
"""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, Boolean, Float
from sqlalchemy.orm import relationship
from core.database import Base


class Provider(Base):
    """Stream provider/source model"""
    __tablename__ = "providers"
    
    id = Column(Integer, primary_key=True)
    
    # Provider info
    name = Column(String(100), nullable=False, unique=True)
    display_name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    
    # Provider type: direct, embed, torrent, etc.
    provider_type = Column(String(50), nullable=False, default="direct")
    
    # Configuration (JSON string for flexibility)
    config = Column(String(2000), nullable=True)
    
    # Status
    is_enabled = Column(Boolean, default=True)
    is_working = Column(Boolean, default=True)
    
    # Reliability score (0-100)
    reliability_score = Column(Float, default=50.0)
    
    # Priority (higher = tried first)
    priority = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_checked_at = Column(DateTime, nullable=True)
    
    # Relationships
    streams = relationship("Stream", back_populates="provider")
