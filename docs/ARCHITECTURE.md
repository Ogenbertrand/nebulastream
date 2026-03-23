# NebulaStream Architecture

## System Overview

NebulaStream is a modern movie streaming platform built with a microservices architecture. The system is designed for scalability, performance, and maintainability.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         React Frontend                               │   │
│  │  - Netflix-style UI  - HLS.js Player  - Tailwind CSS               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                               API LAYER                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      FastAPI Backend API                             │   │
│  │  - REST API  - Auth (JWT)  - TMDB Integration  - Business Logic    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
          ┌──────────────────────────┼──────────────────────────┐
          ▼                          ▼                          ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  STREAM LAYER   │      │   DATA LAYER    │      │  CACHE LAYER    │
│  ┌───────────┐  │      │  ┌───────────┐  │      │  ┌───────────┐  │
│  │Stream     │  │      │  │PostgreSQL │  │      │  │   Redis   │  │
│  │Proxy(Rust)│  │      │  │           │  │      │  │           │  │
│  └───────────┘  │      │  └───────────┘  │      │  └───────────┘  │
│  ┌───────────┐  │      └─────────────────┘      └─────────────────┘
│  │Torrent    │  │
│  │Engine     │  │
│  │(Rust)     │  │
│  └───────────┘  │
│  ┌───────────┐  │
│  │Streaming  │  │
│  │Service    │  │
│  │(Rust)     │  │
│  └───────────┘  │
└─────────────────┘
```

## Service Descriptions

### Frontend (React + TypeScript)
- **Port**: 3000
- **Technology**: React 18, TypeScript, Tailwind CSS, HLS.js
- **Features**:
  - Netflix-style user interface
  - Responsive design
  - Video player with HLS support
  - State management with Zustand
  - Authentication with JWT

### Backend API (FastAPI + Python)
- **Port**: 8000
- **Technology**: Python 3.11, FastAPI, SQLAlchemy, Pydantic
- **Features**:
  - RESTful API endpoints
  - JWT authentication
  - TMDB API integration
  - Database models and migrations
  - Redis caching
  - Structured logging

### Stream Proxy (Rust + Axum)
- **Port**: 8080
- **Technology**: Rust 1.75, Axum, Tokio
- **Features**:
  - High-performance stream forwarding
  - CORS handling
  - Bandwidth optimization
  - Connection pooling

### Torrent Engine (Rust)
- **Port**: 8081
- **Technology**: Rust 1.75
- **Features**:
  - Magnet link parsing
  - Sequential streaming support
  - Download management
  - Stream preparation

### Streaming Service (Rust)
- **Port**: 8090
- **Technology**: Rust 1.85, Axum
- **Features**:
  - Playback session issuance
  - Signed master/variant HLS manifests
  - Segment access control
  - Object storage caching (MinIO/S3)

### PostgreSQL Database
- **Port**: 5432
- **Technology**: PostgreSQL 15
- **Schema**:
  - users
  - movies
  - genres
  - watch_history
  - favorites
  - providers
  - streams

### Redis Cache
- **Port**: 6379
- **Technology**: Redis 7
- **Usage**:
  - API response caching
  - Session storage
  - Rate limiting

## Data Flow

### Movie Discovery Flow
```
User → Frontend → Backend API → TMDB API
                    ↓
                 PostgreSQL (cache)
                    ↓
                 Redis (hot cache)
```

### Streaming Flow
```
User → Frontend → Backend API (get streams)
                    ↓
                 Stream Aggregator
                    ↓
                 Stream Proxy → External Source
                    ↓
                 User (video playback)
```

### Streaming Flow (Internal HLS)
```
User → Frontend → Backend API (create session)
                   ↓
            Streaming Service (Rust)
                   ↓
             MinIO / S3 (segments)
                   ↓
               User (HLS playback)
```

### Authentication Flow
```
User → Login → Backend API
                ↓
             Validate Credentials
                ↓
             Generate JWT
                ↓
             Store in Redis
                ↓
             Return Token
```

## API Endpoints

### Health
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user

### Movies
- `GET /movies/trending` - Trending movies
- `GET /movies/popular` - Popular movies
- `GET /movies/top-rated` - Top rated movies
- `GET /movies/upcoming` - Upcoming movies
- `GET /movies/now-playing` - Now playing movies
- `GET /movies/{id}` - Movie details
- `GET /movies/{id}/similar` - Similar movies
- `GET /movies/{id}/recommendations` - Recommendations

### Search
- `GET /search/movies?q={query}` - Search movies
- `GET /search/suggestions?q={query}` - Search suggestions
- `GET /search/genres` - Get all genres

### Streams
- `GET /streams/{movie_id}` - Get stream sources
- `GET /streams/{movie_id}/proxy` - Get proxied stream
- `POST /streams/{movie_id}/report` - Report stream issue

### Users
- `GET /users/profile` - Get user profile
- `PUT /users/profile` - Update profile
- `GET /users/favorites` - Get favorites
- `POST /users/favorites/{movie_id}` - Add favorite
- `DELETE /users/favorites/{movie_id}` - Remove favorite

### Watch History
- `GET /watch-history/` - Get watch history
- `GET /watch-history/continue-watching` - Continue watching
- `POST /watch-history/` - Add to history
- `PUT /watch-history/{movie_id}` - Update progress
- `DELETE /watch-history/{movie_id}` - Delete entry

## Security Considerations

1. **Authentication**: JWT tokens with expiration
2. **Authorization**: Role-based access control
3. **Input Validation**: Pydantic models for all inputs
4. **CORS**: Configured for frontend origin
5. **Rate Limiting**: Redis-based rate limiting
6. **SQL Injection**: SQLAlchemy ORM prevents injection
7. **XSS Protection**: React's built-in XSS protection

## Scalability

### Horizontal Scaling
- Stateless backend API
- Shared Redis cache
- PostgreSQL read replicas

### Performance Optimizations
- Redis caching for API responses
- Database connection pooling
- Image optimization
- Lazy loading
- CDN for static assets

## Monitoring & Observability

### Logging
- Structured logging with structlog
- Log levels: DEBUG, INFO, WARNING, ERROR

### Metrics
- Request latency
- Error rates
- Cache hit rates
- Database query performance

### Health Checks
- `/health` - Service health
- `/health/ready` - Ready to receive traffic
- `/health/live` - Service is alive
