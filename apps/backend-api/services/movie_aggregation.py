"""
Movie aggregation service combining TMDB, OMDb, Trakt, and Watchmode
"""

from typing import Any, Dict, List, Optional
import asyncio
import httpx

from core.config import settings
from core.logging import get_logger
from services.cache import cache_service
from services.tmdb import tmdb_service

logger = get_logger()


class MovieAggregationService:
    """Aggregate movie data from multiple providers"""

    def __init__(self) -> None:
        self.trakt_base_url = settings.TRAKT_BASE_URL
        self.omdb_base_url = settings.OMDB_BASE_URL
        self.watchmode_base_url = settings.WATCHMODE_BASE_URL

    async def _get_json(
        self,
        url: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Optional[Any]:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(url, params=params, headers=headers)
                response.raise_for_status()
                return response.json()
        except Exception as exc:
            logger.warning("Aggregator request failed", url=url, error=str(exc))
            return None

    def _split_csv(self, value: Optional[str]) -> List[str]:
        if not value:
            return []
        return [item.strip() for item in value.split(",") if item.strip()]

    def _parse_rating(self, value: Optional[str]) -> Optional[float]:
        if not value:
            return None
        try:
            return float(value)
        except ValueError:
            return None

    def build_movie_object(
        self,
        base: Dict[str, Any],
        omdb: Optional[Dict[str, Any]] = None,
        providers: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        return {
            "title": omdb.get("title") if omdb else base.get("title"),
            "year": omdb.get("year") if omdb else base.get("year"),
            "poster": omdb.get("poster") if omdb else base.get("poster"),
            "rating": omdb.get("rating") if omdb else base.get("rating"),
            "plot": omdb.get("plot") if omdb else base.get("plot"),
            "genres": omdb.get("genres") if omdb else base.get("genres", []),
            "cast": omdb.get("cast") if omdb else base.get("cast", []),
            "streaming_providers": providers or [],
            "source_ids": base.get("ids", {}),
        }

    async def get_trending(self, limit: int = 10) -> List[Dict[str, Any]]:
        if not settings.TRAKT_CLIENT_ID:
            logger.warning("TRAKT_CLIENT_ID not configured")
            return []

        cache_key = f"agg:trakt:trending:{limit}"
        cached = await cache_service.get(cache_key)
        if cached:
            return cached

        headers = {
            "trakt-api-key": settings.TRAKT_CLIENT_ID,
            "trakt-api-version": "2",
            "Content-Type": "application/json",
        }
        params = {"extended": "full", "limit": limit}
        data = await self._get_json(f"{self.trakt_base_url}/movies/trending", params=params, headers=headers)
        if not data:
            return []

        base_movies: List[Dict[str, Any]] = []
        for item in data:
            movie = item.get("movie", {})
            ids = movie.get("ids", {})
            base_movies.append(
                {
                    "title": movie.get("title"),
                    "year": movie.get("year"),
                    "poster": None,
                    "rating": movie.get("rating"),
                    "plot": movie.get("overview"),
                    "genres": movie.get("genres", []),
                    "cast": [],
                    "ids": {
                        "trakt": ids.get("trakt"),
                        "tmdb": ids.get("tmdb"),
                        "imdb": ids.get("imdb"),
                    },
                }
            )

        async def enrich_movie(base: Dict[str, Any]) -> Dict[str, Any]:
            imdb_id = base.get("ids", {}).get("imdb")
            omdb = await self.get_omdb_details(base.get("title"), imdb_id=imdb_id)
            return self.build_movie_object(base, omdb=omdb)

        enriched = await asyncio.gather(*[enrich_movie(m) for m in base_movies], return_exceptions=False)
        await cache_service.set(cache_key, enriched, ttl=settings.CACHE_TTL_TRENDING)
        return enriched

    async def get_omdb_details(self, title: Optional[str], imdb_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        if not settings.OMDB_API_KEY:
            logger.warning("OMDB_API_KEY not configured")
            return None

        if not title and not imdb_id:
            return None

        cache_key = f"agg:omdb:{imdb_id or title}"
        cached = await cache_service.get(cache_key)
        if cached:
            return cached

        params = {"apikey": settings.OMDB_API_KEY, "plot": "full"}
        if imdb_id:
            params["i"] = imdb_id
        else:
            params["t"] = title

        data = await self._get_json(self.omdb_base_url, params=params)
        if not data or data.get("Response") == "False":
            return None

        omdb_details = {
            "title": data.get("Title"),
            "year": data.get("Year"),
            "poster": None if data.get("Poster") == "N/A" else data.get("Poster"),
            "rating": self._parse_rating(data.get("imdbRating")),
            "plot": data.get("Plot"),
            "genres": self._split_csv(data.get("Genre")),
            "cast": self._split_csv(data.get("Actors")),
            "ids": {
                "imdb": data.get("imdbID"),
            },
        }

        await cache_service.set(cache_key, omdb_details, ttl=settings.CACHE_TTL_METADATA)
        return omdb_details

    async def search_watchmode_id(self, title: str) -> Optional[int]:
        if not settings.WATCHMODE_API_KEY:
            logger.warning("WATCHMODE_API_KEY not configured")
            return None

        cache_key = f"agg:watchmode:search:{title}"
        cached = await cache_service.get(cache_key)
        if cached:
            return cached

        params = {
            "apiKey": settings.WATCHMODE_API_KEY,
            "search_field": "name",
            "search_value": title,
            "types": "movie",
        }
        data = await self._get_json(f"{self.watchmode_base_url}/search/", params=params)
        if not data or not data.get("title_results"):
            return None

        watchmode_id = data["title_results"][0].get("id")
        if watchmode_id:
            await cache_service.set(cache_key, watchmode_id, ttl=settings.CACHE_TTL_METADATA)
        return watchmode_id

    async def get_watchmode_sources(self, watchmode_id: int) -> List[Dict[str, Any]]:
        if not settings.WATCHMODE_API_KEY:
            logger.warning("WATCHMODE_API_KEY not configured")
            return []

        cache_key = f"agg:watchmode:sources:{watchmode_id}"
        cached = await cache_service.get(cache_key)
        if cached:
            return cached

        params = {"apiKey": settings.WATCHMODE_API_KEY}
        data = await self._get_json(f"{self.watchmode_base_url}/title/{watchmode_id}/sources/", params=params)
        if not data:
            return []

        providers = [
            {
                "name": item.get("name"),
                "type": item.get("type"),
                "region": item.get("region"),
                "web_url": item.get("web_url"),
            }
            for item in data
        ]
        await cache_service.set(cache_key, providers, ttl=settings.CACHE_TTL_STREAMS)
        return providers

    async def get_discover_categories(self, page: int = 1) -> Dict[str, List[Dict[str, Any]]]:
        cache_key = f"agg:tmdb:discover:{page}"
        cached = await cache_service.get(cache_key)
        if cached:
            return cached

        hollywood, bollywood, nollywood, korean, japanese, chinese, anime = await asyncio.gather(
            tmdb_service.get_movies_by_origin_country("US", page=page),
            tmdb_service.get_movies_by_origin_country("IN", page=page),
            tmdb_service.get_movies_by_origin_country("NG", page=page),
            tmdb_service.get_movies_by_origin_country("KR", page=page),
            tmdb_service.get_movies_by_origin_country("JP", page=page),
            tmdb_service.get_movies_by_origin_country("CN", page=page),
            tmdb_service.get_movies_by_origin_country("JP", page=page, genre_id=16),
        )

        def tmdb_to_base(movie: Any) -> Dict[str, Any]:
            return {
                "title": movie.title,
                "year": movie.release_date.year if movie.release_date else None,
                "poster": movie.poster_path,
                "rating": movie.vote_average,
                "plot": None,
                "genres": movie.genre_ids,
                "cast": [],
                "ids": {"tmdb": movie.id},
            }

        result = {
            "hollywood": [tmdb_to_base(m) for m in hollywood],
            "bollywood": [tmdb_to_base(m) for m in bollywood],
            "nollywood": [tmdb_to_base(m) for m in nollywood],
            "korean": [tmdb_to_base(m) for m in korean],
            "japanese": [tmdb_to_base(m) for m in japanese],
            "chinese": [tmdb_to_base(m) for m in chinese],
            "anime": [tmdb_to_base(m) for m in anime],
        }

        await cache_service.set(cache_key, result, ttl=settings.CACHE_TTL_TRENDING)
        return result


movie_aggregation_service = MovieAggregationService()
