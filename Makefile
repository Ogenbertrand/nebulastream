.PHONY: help build up down logs restart clean dev frontend backend proxy torrent

# Default target
help:
	@echo "NebulaStream - Available Commands:"
	@echo ""
	@echo "  make build      - Build all Docker images"
	@echo "  make up         - Start all services"
	@echo "  make down       - Stop all services"
	@echo "  make restart    - Restart all services"
	@echo "  make logs       - View logs from all services"
	@echo "  make clean      - Stop services and remove volumes"
	@echo ""
	@echo "  make dev        - Start services in development mode"
	@echo "  make frontend   - Start frontend only"
	@echo "  make backend    - Start backend only"
	@echo "  make proxy      - Start stream proxy only"
	@echo "  make torrent    - Start torrent engine only"
	@echo ""
	@echo "  make test       - Run tests"
	@echo "  make lint       - Run linters"

# Build all services
build:
	docker-compose build

# Start all services
up:
	docker-compose up -d

# Stop all services
down:
	docker-compose down

# View logs
logs:
	docker-compose logs -f

# Restart services
restart: down up

# Clean everything
clean:
	docker-compose down -v
	docker system prune -f

# Development mode
dev:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Individual services
frontend:
	docker-compose up -d frontend

backend:
	docker-compose up -d backend-api postgres redis

proxy:
	docker-compose up -d stream-proxy

torrent:
	docker-compose up -d torrent-engine

# Testing
test:
	@echo "Running tests..."
	cd apps/backend-api && pytest
	cd apps/frontend && npm test

# Linting
lint:
	@echo "Running linters..."
	cd apps/backend-api && flake8 .
	cd apps/frontend && npm run lint

# Database
migrate:
	docker-compose exec backend-api alembic upgrade head

db-shell:
	docker-compose exec postgres psql -U nebula -d nebulastream

redis-cli:
	docker-compose exec redis redis-cli

# Health checks
health:
	@curl -s http://localhost:8000/health | jq .

status:
	docker-compose ps
