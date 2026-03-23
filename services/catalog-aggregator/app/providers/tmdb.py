from typing import List, Dict, Any
import httpx

import os
from app.config import settings
from app.schemas import CatalogItem, ProviderItem
from app.providers.base import Provider


TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p"


class TMDBProvider(Provider):
    name = "tmdb"

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(base_url=TMDB_BASE_URL, timeout=settings.timeout_seconds)
        return self._client

    async def _get(self, endpoint: str, params: Dict[str, Any]) -> Dict[str, Any] | None:
        api_key = settings.tmdb_api_key or os.getenv("TMDB_API_KEY", "")
        if not api_key:
            return None
        params = {**params, "api_key": api_key}
        resp = await self.client.get(endpoint, params=params)
        resp.raise_for_status()
        return resp.json()

    def _to_item(self, data: Dict[str, Any], media_type: str) -> CatalogItem:
        title = data.get("title") or data.get("name") or ""
        date_str = data.get("release_date") or data.get("first_air_date") or ""
        year = None
        if date_str:
            try:
                year = int(date_str.split("-")[0])
            except ValueError:
                year = None

        poster_path = data.get("poster_path")
        backdrop_path = data.get("backdrop_path")

        sources = [
            ProviderItem(
                source=self.name,
                external_id=str(data.get("id")),
                score=data.get("popularity"),
                raw=None,
            )
        ]

        return CatalogItem(
            id=f"tmdb:{data.get('id')}",
            type=media_type,
            title=title,
            year=year,
            overview=data.get("overview"),
            poster_url=f"{TMDB_IMAGE_BASE}/w185{poster_path}" if poster_path else None,
            backdrop_url=f"{TMDB_IMAGE_BASE}/w300{backdrop_path}" if backdrop_path else None,
            genres=[str(g) for g in data.get("genre_ids", [])],
            rating=data.get("vote_average"),
            popularity=data.get("popularity"),
            language=data.get("original_language"),
            country=None,
            sources=sources,
        )

    async def trending(self, media_type: str, page: int) -> List[CatalogItem]:
        data = await self._get(f"/trending/{media_type}/week", {"page": page})
        if not data:
            return []
        return [self._to_item(item, media_type) for item in data.get("results", [])]

    async def popular(self, media_type: str, page: int) -> List[CatalogItem]:
        data = await self._get(f"/{media_type}/popular", {"page": page})
        if not data:
            return []
        return [self._to_item(item, media_type) for item in data.get("results", [])]

    async def top_rated(self, media_type: str, page: int) -> List[CatalogItem]:
        data = await self._get(f"/{media_type}/top_rated", {"page": page})
        if not data:
            return []
        return [self._to_item(item, media_type) for item in data.get("results", [])]

    async def search(self, query: str, media_type: str, page: int) -> List[CatalogItem]:
        data = await self._get(f"/search/{media_type}", {"query": query, "page": page})
        if not data:
            return []
        return [self._to_item(item, media_type) for item in data.get("results", [])]

    async def genres(self, media_type: str) -> List[dict]:
        data = await self._get(f"/genre/{media_type}/list", {})
        if not data:
            return []
        return [
            {"id": g.get("id"), "name": g.get("name", "")}
            for g in data.get("genres", [])
            if g.get("id") is not None
        ]
