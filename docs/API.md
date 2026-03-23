# NebulaStream API Documentation

## Base URL
```
Development: http://localhost:8000
Production: https://api.nebulastream.com
```

## Authentication

Most endpoints require authentication via Bearer token:

```
Authorization: Bearer <access_token>
```

## Response Format

All responses follow this structure:

```json
{
  "data": {},
  "message": "string",
  "success": true
}
```

Error responses:

```json
{
  "error": true,
  "status": 400,
  "message": "Error description"
}
```

## Endpoints

### Health

#### GET /health
Basic health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "service": "nebula-backend-api"
}
```

#### GET /health/ready
Readiness probe with dependency checks.

**Response:**
```json
{
  "status": "ready",
  "timestamp": "2024-01-01T00:00:00Z",
  "checks": {
    "database": true,
    "cache": true
  }
}
```

### Authentication

#### POST /auth/register
Register a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "password123",
  "display_name": "User Name"
}
```

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "username",
  "display_name": "User Name",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### POST /auth/login
Login user and get access token.

**Request Body (form-data):**
```
username: user@example.com
password: password123
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

#### GET /auth/me
Get current user information.

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "username",
  "display_name": "User Name",
  "avatar_url": null,
  "is_active": true,
  "is_verified": false,
  "created_at": "2024-01-01T00:00:00Z",
  "last_login": "2024-01-01T00:00:00Z"
}
```

### Movies

#### GET /movies/trending
Get trending movies.

**Query Parameters:**
- `time_window` (string): `day` or `week` (default: `week`)
- `page` (integer): Page number (default: 1)

**Response:**
```json
[
  {
    "id": 123,
    "title": "Movie Title",
    "poster_path": "https://image.tmdb.org/t/p/w500/...",
    "backdrop_path": "https://image.tmdb.org/t/p/original/...",
    "vote_average": 8.5,
    "release_date": "2024-01-01",
    "genre_ids": [28, 12]
  }
]
```

#### GET /movies/popular
Get popular movies.

**Query Parameters:**
- `page` (integer): Page number (default: 1)

**Response:** Same as trending

#### GET /movies/{id}
Get detailed movie information.

**Response:**
```json
{
  "id": 123,
  "tmdb_id": 123,
  "imdb_id": "tt1234567",
  "title": "Movie Title",
  "original_title": "Original Title",
  "overview": "Movie description...",
  "tagline": "Movie tagline",
  "poster_path": "https://image.tmdb.org/t/p/w500/...",
  "backdrop_path": "https://image.tmdb.org/t/p/original/...",
  "release_date": "2024-01-01",
  "runtime": 120,
  "vote_average": 8.5,
  "vote_count": 1000,
  "popularity": 100.5,
  "adult": false,
  "original_language": "en",
  "genres": [
    { "id": 28, "name": "Action" }
  ],
  "cast": [
    {
      "id": 1,
      "name": "Actor Name",
      "character": "Character Name",
      "profile_path": "https://image.tmdb.org/t/p/w200/...",
      "order": 0
    }
  ],
  "crew": [
    {
      "id": 1,
      "name": "Director Name",
      "job": "Director",
      "department": "Directing",
      "profile_path": null
    }
  ],
  "trailers": [
    {
      "key": "video_key",
      "name": "Trailer",
      "site": "YouTube",
      "type": "Trailer"
    }
  ],
  "similar": []
}
```

### Search

#### GET /search/movies
Search for movies.

**Query Parameters:**
- `q` (string, required): Search query
- `page` (integer): Page number (default: 1)
- `year` (integer): Filter by release year
- `include_adult` (boolean): Include adult content (default: false)

**Response:** Array of MovieListItem

#### GET /search/suggestions
Get search suggestions.

**Query Parameters:**
- `q` (string, required): Search query
- `limit` (integer): Number of suggestions (default: 5, max: 10)

**Response:**
```json
{
  "query": "search term",
  "suggestions": [
    {
      "id": 123,
      "title": "Movie Title",
      "poster_path": "https://image.tmdb.org/t/p/w500/...",
      "year": 2024
    }
  ]
}
```

### Streams

#### GET /streams/{movie_id}
Get streaming sources for a movie.

**Query Parameters:**
- `preferred_quality` (string): `480p`, `720p`, `1080p`, or `4k` (default: `720p`)
- `preferred_language` (string): Language code (default: `en`)

**Response:**
```json
{
  "movie_id": 123,
  "sources": [
    {
      "url": "https://stream.example.com/video.mp4",
      "quality": "1080p",
      "stream_type": "mp4",
      "language": "en",
      "subtitles": [],
      "provider_name": "Provider Name",
      "reliability_score": 80
    }
  ],
  "subtitles": []
}
```

#### POST /streams/{movie_id}/session
Create an internal playback session for the Rust streaming service.

**Authentication:** Bearer token required.

**Query Parameters:**
- `preferred_quality` (string): `480p`, `720p`, `1080p`, or `4k` (default: `720p`)
- `preferred_language` (string): Language code (default: `en`)
- `source_url` (string, optional): Override upstream HLS manifest
- `magnet_link` (string, optional): Future torrent ingestion input

**Response:**
```json
{
  "session_id": "7b7a5d8a-6a9f-4c78-9d2b-3c5ab7d8e4c1",
  "manifest_url": "http://localhost:8090/v1/sessions/.../master.m3u8?token=...",
  "status": "Ready",
  "ready": true,
  "expires_at": "2024-01-01T00:00:00Z"
}
```

#### POST /streams/{movie_id}/ingest
Start a torrent ingest job (scaffold) via the torrent-engine service.

**Authentication:** Bearer token required.

**Query Parameters:**
- `magnet_link` (string, optional): Magnet link to ingest
- `torrent_url` (string, optional): Direct .torrent URL to ingest
- `quality` (string): `480p`, `720p`, `1080p`, or `4k` (default: `720p`)

**Response:**
```json
{
  "job_id": "a1b2c3d4",
  "movie_id": 123,
  "stream_id": "a1b2c3d4",
  "stream_url": "http://localhost:8081/stream/a1b2c3d4",
  "status_url": "http://localhost:8081/stream/a1b2c3d4/status",
  "session_id": "7b7a5d8a-6a9f-4c78-9d2b-3c5ab7d8e4c1",
  "manifest_url": "http://localhost:8090/v1/sessions/.../master.m3u8?token=...",
  "ready": false,
  "status": "preparing",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### GET /streams/ingest/{job_id}
Fetch ingest job status and refresh from torrent-engine.

**Authentication:** Bearer token required.

**Response:**
```json
{
  "job_id": "a1b2c3d4",
  "status": "streaming",
  "progress": 12.5,
  "download_speed": 123456,
  "peers": 8,
  "seeds": 20,
  "ready": true,
  "stream_url": "http://localhost:8081/stream/a1b2c3d4",
  "session_id": "7b7a5d8a-6a9f-4c78-9d2b-3c5ab7d8e4c1",
  "manifest_url": "http://localhost:8090/v1/sessions/.../master.m3u8?token=...",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### Users

#### GET /users/profile
Get user profile with statistics.

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "username",
  "display_name": "User Name",
  "avatar_url": null,
  "is_active": true,
  "is_verified": false,
  "created_at": "2024-01-01T00:00:00Z",
  "last_login": "2024-01-01T00:00:00Z",
  "watch_count": 10,
  "favorite_count": 5,
  "total_watch_time": 1200
}
```

#### PUT /users/profile
Update user profile.

**Request Body:**
```json
{
  "display_name": "New Name",
  "avatar_url": "https://example.com/avatar.jpg"
}
```

### Watch History

#### GET /watch-history/continue-watching
Get continue watching list.

**Query Parameters:**
- `limit` (integer): Number of items (default: 10, max: 20)

**Response:**
```json
[
  {
    "movie": {
      "id": 123,
      "title": "Movie Title",
      "poster_path": "https://image.tmdb.org/t/p/w500/...",
      "vote_average": 8.5,
      "release_date": "2024-01-01",
      "genre_ids": [28, 12]
    },
    "progress_seconds": 1800,
    "duration_seconds": 7200,
    "progress_percent": 25.0,
    "last_watched_at": "2024-01-01T00:00:00Z"
  }
]
```

#### PUT /watch-history/{movie_id}
Update watch progress.

**Request Body:**
```json
{
  "progress_seconds": 1800,
  "duration_seconds": 7200,
  "progress_percent": 25.0,
  "is_completed": false
}
```

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 422 | Validation Error - Invalid data format |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |
| 502 | Bad Gateway - Upstream service error |
| 503 | Service Unavailable |

## Rate Limiting

API requests are rate-limited per IP address:
- 100 requests per minute for authenticated users
- 20 requests per minute for unauthenticated users

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```
