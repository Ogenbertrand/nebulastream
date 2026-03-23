from __future__ import annotations

from datetime import date
from typing import List, Optional, Dict, Any

import httpx

from core.config import settings
from core.logging import get_logger
from schemas.movie import MovieList, Genre

logger = get_logger("catalog_aggregator")


class CatalogAggregatorClient:
    def __init__(self) -> None:
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def enabled(self) -> bool:
        return bool(settings.CATALOG_AGGREGATOR_URL)

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            base_url = settings.CATALOG_AGGREGATOR_URL.rstrip("/")
            self._client = httpx.AsyncClient(
                base_url=base_url,
                timeout=settings.CATALOG_AGGREGATOR_TIMEOUT_SECONDS,
                headers={"Accept": "application/json"},
            )
        return self._client

    async def _get(self, path: str, params: Dict[str, Any]) -> Dict[str, Any]:
        resp = await self.client.get(path, params=params)
        resp.raise_for_status()
        return resp.json()

    def _extract_id(self, item: Dict[str, Any]) -> Optional[int]:
        raw_id = item.get("id")
        if isinstance(raw_id, int):
            return raw_id
        if isinstance(raw_id, str) and raw_id.startswith("tmdb:"):
            try:
                return int(raw_id.split(":", 1)[1])
            except ValueError:
                return None

        for source in item.get("sources", []):
            if source.get("source") == "tmdb":
                try:
                    return int(source.get("external_id"))
                except (TypeError, ValueError):
                    return None
        return None

    def _parse_release_date(self, item: Dict[str, Any]) -> Optional[date]:
        year = item.get("year")
        if not year:
            return None
        try:
            return date(int(year), 1, 1)
        except (TypeError, ValueError):
            return None

    def _parse_genre_ids(self, item: Dict[str, Any]) -> List[int]:
        ids: List[int] = []
        for g in item.get("genres", []) or []:
            try:
                ids.append(int(g))
            except (TypeError, ValueError):
                continue
        return ids

    def _to_movie_list(self, item: Dict[str, Any]) -> Optional[MovieList]:
        movie_id = self._extract_id(item)
        if movie_id is None:
            return None

        return MovieList(
            id=movie_id,
            title=item.get("title", ""),
            poster_path=item.get("poster_url"),
            backdrop_path=item.get("backdrop_url"),
            vote_average=float(item.get("rating") or 0.0),
            release_date=self._parse_release_date(item),
            genre_ids=self._parse_genre_ids(item),
        )

    def _items_to_movies(self, payload: Dict[str, Any]) -> List[MovieList]:
        items = payload.get("items") if isinstance(payload, dict) else []
        movies: List[MovieList] = []
        for item in items or []:
            if not isinstance(item, dict):
                continue
            movie = self._to_movie_list(item)
            if movie:
                movies.append(movie)
        return movies

    async def trending(self, media_type: str, page: int) -> List[MovieList]:
        data = await self._get("/catalog/trending", {"type": media_type, "page": page})
        return self._items_to_movies(data)

    async def popular(self, media_type: str, page: int) -> List[MovieList]:
        data = await self._get("/catalog/popular", {"type": media_type, "page": page})
        return self._items_to_movies(data)

    async def top_rated(self, media_type: str, page: int) -> List[MovieList]:
        data = await self._get("/catalog/top-rated", {"type": media_type, "page": page})
        return self._items_to_movies(data)

    async def search(self, query: str, media_type: str, page: int) -> List[MovieList]:
        data = await self._get(
            "/catalog/search",
            {"q": query, "type": media_type, "page": page},
        )
        return self._items_to_movies(data)

    async def genres(self, media_type: str) -> List[Genre]:
        data = await self._get("/catalog/genres", {"type": media_type})
        genres = data.get("genres") if isinstance(data, dict) else []
        results: List[Genre] = []
        for item in genres or []:
            if not isinstance(item, dict):
                continue
            if item.get("id") is None or not item.get("name"):
                continue
            results.append(Genre(id=int(item["id"]), name=item["name"]))
        return results


catalog_aggregator_client = CatalogAggregatorClient()
