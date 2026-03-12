"""
Application configuration
"""

from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""
    
    # API Configuration
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    DEBUG: bool = False
    LOG_LEVEL: str = "info"
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
    ]
    
    # Database
    DATABASE_URL: str = "postgresql://nebula:nebula123@localhost:5432/nebulastream"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    
    # TMDB API
    TMDB_API_KEY: str = ""
    TMDB_BASE_URL: str = "https://api.themoviedb.org/3"
    TMDB_IMAGE_BASE_URL: str = "https://image.tmdb.org/t/p"
    
    # JWT Authentication
    JWT_SECRET: str = "your-super-secret-jwt-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    
    # Streaming Services
    STREAM_PROXY_URL: str = "http://localhost:8080"
    TORRENT_ENGINE_URL: str = "http://localhost:8081"
    
    # Feature Flags
    ENABLE_TORRENT_STREAMING: bool = True
    ENABLE_USER_AUTHENTICATION: bool = True
    ENABLE_RECOMMENDATIONS: bool = True
    
    # Cache TTL (seconds)
    CACHE_TTL_METADATA: int = 3600  # 1 hour
    CACHE_TTL_TRENDING: int = 1800  # 30 minutes
    CACHE_TTL_SEARCH: int = 300     # 5 minutes
    CACHE_TTL_STREAMS: int = 600    # 10 minutes
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
