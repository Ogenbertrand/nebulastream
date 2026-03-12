# NebulaStream

A modern, high-performance movie streaming aggregator platform built with microservices architecture.

![NebulaStream](https://img.shields.io/badge/NebulaStream-1.0.0-blue)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?logo=fastapi)
![Rust](https://img.shields.io/badge/Rust-1.75-000000?logo=rust)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql)

## Features

- **Modern UI**: Netflix-style interface with responsive design
- **Fast Streaming**: High-performance Rust-based stream proxy
- **Smart Aggregation**: Multiple streaming sources with automatic failover
- **User Features**: Watch history, favorites, continue watching
- **Search**: Full-text search with suggestions
- **Recommendations**: Similar movies and personalized suggestions

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend API   │────▶│   PostgreSQL    │
│   (React/TS)    │     │   (FastAPI)     │     │   (Database)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Stream Proxy   │     │ Torrent Engine  │     │     Redis       │
│     (Rust)      │     │     (Rust)      │     │    (Cache)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Git
- TMDB API Key (get one at https://www.themoviedb.org/settings/api)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd nebula-stream
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your TMDB API key:
   ```
   TMDB_API_KEY=your_tmdb_api_key_here
   ```

3. **Start all services**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Stopping the Services

```bash
docker-compose down
```

To remove all data (including database volumes):
```bash
docker-compose down -v
```

## Development

### Frontend Development

```bash
cd apps/frontend
npm install
npm start
```

### Backend Development

```bash
cd apps/backend-api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Stream Proxy Development

```bash
cd services/stream-proxy
cargo run
```

### Torrent Engine Development

```bash
cd services/torrent-engine
cargo run
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | React web application |
| Backend API | 8000 | FastAPI REST API |
| Stream Proxy | 8080 | Rust stream forwarding service |
| Torrent Engine | 8081 | Rust torrent streaming service |
| PostgreSQL | 5432 | Main database |
| Redis | 6379 | Cache layer |

## API Documentation

Once running, API documentation is available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

See [docs/API.md](docs/API.md) for detailed API documentation.

## Project Structure

```
nebula-stream/
├── apps/
│   ├── frontend/          # React frontend application
│   └── backend-api/       # FastAPI backend service
├── services/
│   ├── stream-proxy/      # Rust stream proxy service
│   └── torrent-engine/    # Rust torrent engine service
├── packages/
│   └── shared-types/      # Shared TypeScript types
├── infra/
│   └── docker/            # Docker configurations
├── docs/                  # Documentation
└── docker-compose.yml     # Main compose file
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TMDB_API_KEY` | The Movie Database API key | Required |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://nebula:nebula123@postgres:5432/nebulastream` |
| `REDIS_URL` | Redis connection string | `redis://redis:6379/0` |
| `JWT_SECRET` | Secret key for JWT tokens | Random string |
| `API_PORT` | Backend API port | `8000` |
| `DEBUG` | Enable debug mode | `false` |

## Database Schema

The PostgreSQL database includes the following tables:
- `users` - User accounts
- `movies` - Movie metadata
- `genres` - Movie genres
- `watch_history` - User watch progress
- `favorites` - User favorites
- `providers` - Stream providers
- `streams` - Stream sources

See [infra/docker/postgres/init/01-init.sql](infra/docker/postgres/init/01-init.sql) for the full schema.

## Troubleshooting

### Services not starting

Check logs:
```bash
docker-compose logs -f [service-name]
```

### Database connection issues

Ensure PostgreSQL is healthy:
```bash
docker-compose ps
```

### Reset everything

```bash
docker-compose down -v
docker-compose up -d
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [TMDB](https://www.themoviedb.org/) for movie metadata
- [FastAPI](https://fastapi.tiangolo.com/) for the backend framework
- [React](https://reactjs.org/) for the frontend library
- [Rust](https://www.rust-lang.org/) for high-performance services

## Support

For support, please open an issue in the GitHub repository.

---

**Disclaimer**: NebulaStream is a demonstration project for educational purposes. Please respect copyright laws and only stream content you have the right to access.
