# Catalog Aggregator Service

FastAPI service that aggregates movie and TV metadata from multiple providers and returns a unified catalog for NebulaStream.

## Local Dev
```
cd services/catalog-aggregator
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8100
```

## Environment
- `TMDB_API_KEY` (required for MVP)
- `CATALOG_AGGREGATOR_LOG_LEVEL` (default: info)
- `CATALOG_AGGREGATOR_TIMEOUT_SECONDS` (default: 20)

## Endpoints
- `GET /health`
- `GET /catalog/trending?type=movie|tv&page=1`
- `GET /catalog/popular?type=movie|tv&page=1`
- `GET /catalog/top-rated?type=movie|tv&page=1`
- `GET /catalog/search?q=...&type=movie|tv&page=1`
- `GET /catalog/genres?type=movie|tv`
