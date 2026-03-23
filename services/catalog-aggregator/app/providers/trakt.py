from typing import List, Dict, Any
import os
import httpx

from app.config import settings
from app.providers.base import Provider
from app.schemas import CatalogItem, ProviderItem


class TraktProvider(Provider):
    name = "trakt"

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None

    @property
    def client_id(self) -> str:
        return settings.trakt_client_id or os.getenv("TRAKT_CLIENT_ID", "")

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url="https://api.trakt.tv",
                timeout=settings.timeout_seconds,
                headers={
                    "Content-Type": "application/json",
                    "trakt-api-version": "2",
                    "trakt-api-key": self.client_id,
                },
            )
        return self._client

    async def _get(self, endpoint: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        if not self.client_id:
            return []
        resp = await self.client.get(endpoint, params=params)
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, list):
            return data
        return []

    def _to_item(self, payload: Dict[str, Any], media_type: str) -> CatalogItem | None:
        key = "movie" if media_type == "movie" else "show"
        base = payload.get(key) or {}
        if not base:
            return None

        ids = base.get("ids") or {}
        tmdb_id = ids.get("tmdb")
        trakt_id = ids.get("trakt")
        external_id = str(trakt_id) if trakt_id is not None else None

        title = base.get("title", "")
        year = base.get("year")
        watchers = payload.get("watchers")

        item_id = f"tmdb:{tmdb_id}" if tmdb_id else f"trakt:{trakt_id}"

        return CatalogItem(
            id=item_id,
            type=media_type,
            title=title,
            year=year,
            overview=base.get("overview"),
            poster_url=None,
            backdrop_url=None,
            genres=[str(g) for g in (base.get("genres") or [])],
            rating=base.get("rating"),
            popularity=watchers or base.get("votes"),
            language=base.get("language"),
            country=(base.get("country") or "").upper() if base.get("country") else None,
            sources=[
                ProviderItem(
                    source=self.name,
                    external_id=external_id,
                    score=watchers,
                    raw=None,
                )
            ],
        )

    async def trending(self, media_type: str, page: int) -> List[CatalogItem]:
        items = await self._get(f"/{media_type}s/trending", {"page": page, "limit": 20})
        results = []
        for item in items:
            mapped = self._to_item(item, media_type)
            if mapped:
                results.append(mapped)
        return results

    async def popular(self, media_type: str, page: int) -> List[CatalogItem]:
        items = await self._get(f"/{media_type}s/popular", {"page": page, "limit": 20})
        results = []
        for item in items:
            mapped = self._to_item({"movie" if media_type == "movie" else "show": item}, media_type)
            if mapped:
                results.append(mapped)
        return results

    async def top_rated(self, media_type: str, page: int) -> List[CatalogItem]:
        # Trakt exposes rating endpoints; if unavailable, return empty and let other providers fill.
        items = await self._get(f"/{media_type}s/ratings", {"page": page, "limit": 20})
        results = []
        for item in items:
            mapped = self._to_item({"movie" if media_type == "movie" else "show": item}, media_type)
            if mapped:
                results.append(mapped)
        return results

    async def search(self, query: str, media_type: str, page: int) -> List[CatalogItem]:
        items = await self._get(f"/search/{media_type}", {"query": query, "page": page, "limit": 20})
        results = []
        for item in items:
            mapped = self._to_item(item, media_type)
            if mapped:
                results.append(mapped)
        return results

    async def genres(self, media_type: str) -> List[dict]:
        return []
