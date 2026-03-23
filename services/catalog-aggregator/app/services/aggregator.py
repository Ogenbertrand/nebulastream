from typing import List, Tuple, Dict
import asyncio

from app.schemas import CatalogItem, CatalogResponse, GenresResponse, GenreItem
from app.providers.tmdb import TMDBProvider
from app.providers.trakt import TraktProvider
from app.providers.mdblist import MDBListProvider
from app.providers.watchmode import WatchmodeProvider
from app.providers.imdb import IMDbProvider
from app.services.cache import cache
from app.config import settings


class CatalogAggregator:
    def __init__(self) -> None:
        self.providers = [
            TMDBProvider(),
            TraktProvider(),
            MDBListProvider(),
            IMDbProvider(),
        ]
        self.watchmode = WatchmodeProvider()

    def _merge(self, items: List[CatalogItem]) -> List[CatalogItem]:
        merged: dict[str, CatalogItem] = {}
        for item in items:
            if item.id in merged:
                target = merged[item.id]
                target.sources.extend(item.sources)
                if not target.overview and item.overview:
                    target.overview = item.overview
                if not target.poster_url and item.poster_url:
                    target.poster_url = item.poster_url
                if not target.backdrop_url and item.backdrop_url:
                    target.backdrop_url = item.backdrop_url
                if not target.genres and item.genres:
                    target.genres = item.genres
                if target.availability is None and item.availability:
                    target.availability = item.availability
                elif item.availability:
                    target.availability = (target.availability or []) + item.availability
            else:
                merged[item.id] = item
        return list(merged.values())

    def _cache_key(self, name: str, *parts: object) -> str:
        suffix = ":".join(str(p) for p in parts)
        return f"catalog:{name}:{suffix}"

    async def _collect(self, method: str, *args) -> Tuple[List[CatalogItem], List[str]]:
        results: List[CatalogItem] = []
        missing: List[str] = []

        async def _call_provider(provider):
            try:
                fn = getattr(provider, method)
                items = await asyncio.wait_for(fn(*args), timeout=settings.timeout_seconds)
                return provider.name, items
            except Exception:
                return provider.name, None

        tasks = [asyncio.create_task(_call_provider(provider)) for provider in self.providers]
        responses = await asyncio.gather(*tasks, return_exceptions=False)
        for name, items in responses:
            if not items:
                missing.append(name)
                continue
            results.extend(items)

        merged = self._merge(results)
        if self.watchmode.api_key and merged:
            try:
                merged = await asyncio.wait_for(
                    self.watchmode.enrich_availability(merged),
                    timeout=settings.timeout_seconds,
                )
            except Exception:
                pass
        return merged, missing

    async def trending(self, media_type: str, page: int) -> CatalogResponse:
        cache_key = self._cache_key("trending", media_type, page)
        cached = await cache.get_json(cache_key)
        if cached:
            return CatalogResponse(**cached)

        items, missing = await self._collect("trending", media_type, page)
        response = CatalogResponse(items=items, sources_missing=missing)
        await cache.set_json(cache_key, response.dict(), settings.cache_ttl_trending)
        return response

    async def popular(self, media_type: str, page: int) -> CatalogResponse:
        cache_key = self._cache_key("popular", media_type, page)
        cached = await cache.get_json(cache_key)
        if cached:
            return CatalogResponse(**cached)

        items, missing = await self._collect("popular", media_type, page)
        response = CatalogResponse(items=items, sources_missing=missing)
        await cache.set_json(cache_key, response.dict(), settings.cache_ttl_popular)
        return response

    async def top_rated(self, media_type: str, page: int) -> CatalogResponse:
        cache_key = self._cache_key("top_rated", media_type, page)
        cached = await cache.get_json(cache_key)
        if cached:
            return CatalogResponse(**cached)

        items, missing = await self._collect("top_rated", media_type, page)
        response = CatalogResponse(items=items, sources_missing=missing)
        await cache.set_json(cache_key, response.dict(), settings.cache_ttl_top_rated)
        return response

    async def search(self, query: str, media_type: str, page: int) -> CatalogResponse:
        cache_key = self._cache_key("search", media_type, page, query)
        cached = await cache.get_json(cache_key)
        if cached:
            return CatalogResponse(**cached)

        items, missing = await self._collect("search", query, media_type, page)
        response = CatalogResponse(items=items, sources_missing=missing)
        await cache.set_json(cache_key, response.dict(), settings.cache_ttl_search)
        return response

    async def genres(self, media_type: str) -> GenresResponse:
        cache_key = self._cache_key("genres", media_type)
        cached = await cache.get_json(cache_key)
        if cached:
            return GenresResponse(**cached)

        genres: List[GenreItem] = []
        missing: List[str] = []
        for provider in self.providers:
            try:
                items = await provider.genres(media_type)
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    if item.get("id") is None or not item.get("name"):
                        continue
                    genres.append(GenreItem(id=int(item["id"]), name=item["name"]))
            except Exception:
                missing.append(provider.name)

        unique: Dict[int, GenreItem] = {}
        for item in genres:
            unique[item.id] = item

        response = GenresResponse(genres=list(unique.values()), sources_missing=missing)
        await cache.set_json(cache_key, response.dict(), settings.cache_ttl_genres)
        return response
