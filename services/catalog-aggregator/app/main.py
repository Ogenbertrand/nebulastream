from fastapi import FastAPI, Query
from fastapi.responses import ORJSONResponse

from app.services.aggregator import CatalogAggregator
from app.services.cache import cache
from app.config import settings

app = FastAPI(
    title="NebulaStream Catalog Aggregator",
    version="0.1.0",
    default_response_class=ORJSONResponse,
)

aggregator = CatalogAggregator()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/catalog/trending")
async def catalog_trending(
    type: str = Query("movie", pattern="^(movie|tv)$"),
    page: int = Query(1, ge=1),
):
    cache_key = f"catalog:trending:{type}:{page}"
    cached = await cache.get_json(cache_key)
    if cached is not None:
        return cached
    data = await aggregator.trending(type, page)
    await cache.set_json(cache_key, data.model_dump(), ttl=settings.cache_ttl_trending)
    return data


@app.get("/catalog/popular")
async def catalog_popular(
    type: str = Query("movie", pattern="^(movie|tv)$"),
    page: int = Query(1, ge=1),
):
    cache_key = f"catalog:popular:{type}:{page}"
    cached = await cache.get_json(cache_key)
    if cached is not None:
        return cached
    data = await aggregator.popular(type, page)
    await cache.set_json(cache_key, data.model_dump(), ttl=settings.cache_ttl_popular)
    return data


@app.get("/catalog/top-rated")
async def catalog_top_rated(
    type: str = Query("movie", pattern="^(movie|tv)$"),
    page: int = Query(1, ge=1),
):
    cache_key = f"catalog:top-rated:{type}:{page}"
    cached = await cache.get_json(cache_key)
    if cached is not None:
        return cached
    data = await aggregator.top_rated(type, page)
    await cache.set_json(cache_key, data.model_dump(), ttl=settings.cache_ttl_top_rated)
    return data


@app.get("/catalog/search")
async def catalog_search(
    q: str = Query(..., min_length=2),
    type: str = Query("movie", pattern="^(movie|tv)$"),
    page: int = Query(1, ge=1),
):
    cache_key = f"catalog:search:{type}:{q}:{page}"
    cached = await cache.get_json(cache_key)
    if cached is not None:
        return cached
    data = await aggregator.search(q, type, page)
    await cache.set_json(cache_key, data.model_dump(), ttl=settings.cache_ttl_search)
    return data


@app.get("/catalog/genres")
async def catalog_genres(
    type: str = Query("movie", pattern="^(movie|tv)$")
):
    cache_key = f"catalog:genres:{type}"
    cached = await cache.get_json(cache_key)
    if cached is not None:
        return cached
    data = await aggregator.genres(type)
    await cache.set_json(cache_key, data.model_dump(), ttl=settings.cache_ttl_genres)
    return data
