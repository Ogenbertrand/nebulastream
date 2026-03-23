from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    tmdb_api_key: str = ""
    trakt_client_id: str = ""
    watchmode_api_key: str = ""
    watchmode_regions: str = "US"
    watchmode_enrich_limit: int = 20
    redis_url: str = ""
    log_level: str = "info"
    timeout_seconds: int = 8
    cache_ttl_trending: int = 900
    cache_ttl_popular: int = 1800
    cache_ttl_top_rated: int = 1800
    cache_ttl_search: int = 300
    cache_ttl_genres: int = 86400

    class Config:
        env_prefix = "CATALOG_AGGREGATOR_"


settings = Settings()
