from typing import List, Dict, Any
import os
import httpx

from app.config import settings
from app.providers.base import Provider
from app.schemas import CatalogItem, ProviderItem


class WatchmodeProvider(Provider):
    name = "watchmode"

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None

    @property
    def api_key(self) -> str:
        return settings.watchmode_api_key or os.getenv("WATCHMODE_API_KEY", "")

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url="https://api.watchmode.com/v1",
                timeout=settings.timeout_seconds,
            )
        return self._client

    async def _get(self, endpoint: str, params: Dict[str, Any]) -> Any:
        if not self.api_key:
            return None
        params = {**params, "apiKey": self.api_key}
        resp = await self.client.get(endpoint, params=params)
        resp.raise_for_status()
        return resp.json()

    async def enrich_availability(self, items: List[CatalogItem]) -> List[CatalogItem]:
        if not self.api_key:
            return items

        limit = max(0, settings.watchmode_enrich_limit)
        remaining = items[:limit] if limit else []

        for item in remaining:
            tmdb_id = None
            if item.id.startswith("tmdb:"):
                try:
                    tmdb_id = int(item.id.split(":", 1)[1])
                except ValueError:
                    tmdb_id = None

            if not tmdb_id:
                continue

            try:
                search = await self._get(
                    "/search/",
                    {
                        "search_field": "tmdb_id",
                        "search_value": tmdb_id,
                        "types": item.type,
                    },
                )
                title_results = search.get("title_results") if isinstance(search, dict) else []
                if not title_results:
                    continue
                watchmode_id = title_results[0].get("id")
                if not watchmode_id:
                    continue

                sources = await self._get(
                    f"/title/{watchmode_id}/sources/",
                    {"regions": settings.watchmode_regions},
                )
                if sources:
                    item.availability = list(sources)
                    item.sources.append(
                        ProviderItem(
                            source=self.name,
                            external_id=str(watchmode_id),
                            score=None,
                            raw=None,
                        )
                    )
            except Exception:
                continue

        return items

    async def trending(self, media_type: str, page: int) -> List[CatalogItem]:
        return []

    async def popular(self, media_type: str, page: int) -> List[CatalogItem]:
        return []

    async def top_rated(self, media_type: str, page: int) -> List[CatalogItem]:
        return []

    async def search(self, query: str, media_type: str, page: int) -> List[CatalogItem]:
        return []

    async def genres(self, media_type: str) -> List[dict]:
        return []
