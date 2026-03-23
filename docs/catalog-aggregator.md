# NebulaStream Catalog Aggregator

## Purpose
Create a dedicated service that aggregates movie and TV metadata from multiple providers and returns a single, clean catalog API for NebulaStream. This service decouples discovery from playback and allows us to rank, merge, and cache content intelligently.

## Goals
- Unify content from TMDB, Trakt, IMDb (via OMDb or datasets), MDBList, and Watchmode.
- Provide a consistent catalog schema for the FastAPI backend and frontend.
- Support strong caching and graceful degradation when any provider fails.
- Keep playback decisions separate (streaming stays in Rust services).

## Non‑Goals (MVP)
- Full ingestion of IMDb datasets.
- Persistent catalog storage with scheduled backfills.
- Advanced personalization or ML ranking.

## High‑Level Architecture
- `catalog-aggregator` (new service):
  - Pulls and merges data from providers.
  - Returns unified catalog responses.
- `backend-api`:
  - Calls aggregator for catalog data.
  - Handles auth, user state, watch history, and playback orchestration.
- `streaming-service` + `torrent-engine`:
  - Handle playback, HLS, and ingest only.

## Data Sources (Pluggable)
- TMDB: primary metadata baseline.
- Trakt: trending and community signals.
- IMDb: list enrichment via OMDb or datasets.
- MDBList: curated list aggregation.
- Watchmode: availability and region metadata.

## Canonical Schema (Simplified)
`CatalogItem`:
- `id`: canonical id (stable internal)
- `type`: movie | tv
- `title`
- `year`
- `overview`
- `poster_url`
- `backdrop_url`
- `genres[]`
- `rating`
- `popularity`
- `language`
- `country`
- `sources[]`:
  - `source`: tmdb | trakt | imdb | mdblist | watchmode
  - `external_id`
  - `score`
  - `raw` (optional provider payload)

## Merge Strategy (MVP)
- Prefer TMDB IDs as the primary key when present.
- If TMDB ID missing, fallback to normalized title + year + type.
- Merge fields by weighted source confidence:
  - TMDB for base metadata.
  - Trakt for trending/popularity signal.
  - Watchmode for availability (if present).

## Ranking Strategy (MVP)
Score example:
- `score = 0.5 * popularity + 0.3 * trakt_trending + 0.2 * vote_average`
Weights can be tuned later by config.

## API Endpoints (MVP)
- `GET /health`
- `GET /catalog/trending?type=movie|tv&page=1`
- `GET /catalog/popular?type=movie|tv&page=1`
- `GET /catalog/top-rated?type=movie|tv&page=1`
- `GET /catalog/search?q=...&type=movie|tv&page=1`
- `GET /catalog/genres?type=movie|tv`

## Caching
- Use Redis if configured.
- Cache keys per source and query.
- TTL defaults: trending 15m, popular 30m, search 5m.

## Error Handling
- If a provider fails, return partial results with a `sources_missing` list.
- If no providers succeed, return 503 with provider error summaries.

## Security
- Only server‑to‑server access in MVP.
- Later: internal token or mTLS between backend and aggregator.

## Observability
- Structured logs per provider call.
- Latency + cache hit rate metrics.

## MVP Implementation Plan
1. Create `catalog-aggregator` service with FastAPI.
2. Implement TMDB provider adapter (movie + TV).
3. Add provider interface with stubs for Trakt, MDBList, Watchmode, IMDb.
4. Implement merge + ranking with TMDB‑only initial output.
5. Add health + catalog endpoints.
6. Wire Docker Compose for local dev.
7. Add backend integration toggle (`CATALOG_AGGREGATOR_URL`), no default routing yet.

## Future Phases
- Add Trakt adapter (trending + lists).
- Add Watchmode adapter (availability).
- Add MDBList adapter (curated lists).
- Add IMDb via OMDb or datasets.
- Add scheduled refresh + persistent storage.
