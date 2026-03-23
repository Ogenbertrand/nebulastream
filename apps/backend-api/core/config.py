"""
Application configuration
"""

import json
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
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        raw = (self.CORS_ORIGINS or "").strip()
        if not raw:
            return []
        if raw == "*":
            return ["*"]
        if raw.startswith("["):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return parsed
            except json.JSONDecodeError:
                pass
        return [item.strip() for item in raw.split(",") if item.strip()]
    
    # Database
    DATABASE_URL: str = "postgresql://nebula:nebula123@localhost:5432/nebulastream"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    
    # TMDB API
    TMDB_API_KEY: str = "82cbe36eb1fe2cea90e6d52997a664b8"
    TMDB_BASE_URL: str = "https://api.themoviedb.org/3"
    TMDB_IMAGE_BASE_URL: str = "https://image.tmdb.org/t/p"
    TMDB_TIMEOUT_SECONDS: int = 12
    TMDB_POSTER_SIZE_LIST: str = "w185"
    TMDB_BACKDROP_SIZE_LIST: str = "w300"
    TMDB_POSTER_SIZE_DETAIL: str = "w500"
    TMDB_BACKDROP_SIZE_DETAIL: str = "w1280"

    # OMDb API
    OMDB_API_KEY: str = ""
    OMDB_BASE_URL: str = "https://www.omdbapi.com"

    # Trakt API
    TRAKT_CLIENT_ID: str = ""
    TRAKT_BASE_URL: str = "https://api.trakt.tv"

    # Watchmode API
    WATCHMODE_API_KEY: str = ""
    WATCHMODE_BASE_URL: str = "https://api.watchmode.com/v1"
    
    # JWT Authentication
    JWT_SECRET: str = "your-super-secret-jwt-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    
    # Streaming Services
    STREAM_PROXY_URL: str = "http://localhost:8080"
    TORRENT_ENGINE_URL: str = "http://localhost:8081"
    TORRENT_ENGINE_TIMEOUT_SECONDS: int = 15
    TORRENT_INGEST_POLL_SECONDS: int = 5
    STREAMING_SERVICE_URL: str = "http://localhost:8090"
    STREAMING_SERVICE_TIMEOUT_SECONDS: int = 15
    STREAMING_PREFER_INTERNAL: bool = False
    STREAM_PROVIDER_SKIP_SSL_VERIFY: bool = False
    STREAM_LOOKUP_TIMEOUT_SECONDS: int = 12

    # Catalog Aggregator
    CATALOG_AGGREGATOR_URL: str = ""
    CATALOG_AGGREGATOR_TIMEOUT_SECONDS: int = 5

    # Scraper Engine
    STREAM_SCRAPER_ENABLED: bool = True
    STREAM_SCRAPER_TIMEOUT_SECONDS: int = 20
    STREAM_SCRAPER_WAIT_MS: int = 2500
    STREAM_SCRAPER_MAX_CONCURRENCY: int = 2
    STREAM_SCRAPER_CACHE_TTL: int = 7200

    # Captcha Solving (2Captcha)
    CAPTCHA_2CAPTCHA_API_KEY: str = ""
    CAPTCHA_2CAPTCHA_TIMEOUT_SECONDS: int = 120
    CAPTCHA_2CAPTCHA_POLL_SECONDS: int = 5

    # VidSrc resolver overrides
    VIDSRC_RCP_COOKIE: str = ""
    VIDSRC_TURNSTILE_INTERCEPT: bool = False
    VIDSRC_TURNSTILE_INTERCEPT_TIMEOUT_SECONDS: int = 25
    
    # Feature Flags
    ENABLE_TORRENT_STREAMING: bool = True
    ENABLE_USER_AUTHENTICATION: bool = True
    ENABLE_RECOMMENDATIONS: bool = True
    
    # Cache TTL (seconds)
    CACHE_PREFIX: str = "v2"
    CACHE_TTL_METADATA: int = 3600  # 1 hour
    CACHE_TTL_TRENDING: int = 1800  # 30 minutes
    CACHE_TTL_SEARCH: int = 300     # 5 minutes
    CACHE_TTL_STREAMS: int = 600    # 10 minutes
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
