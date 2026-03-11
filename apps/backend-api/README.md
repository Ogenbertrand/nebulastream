# Backend API

FastAPI service for NebulaStream backend capabilities.

## Requirements
- Python 3.12

## Setup
```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

## Run (development)
```bash
uvicorn backend_api.main:app --reload --host 127.0.0.1 --port 8000
```

## Health check
```bash
curl http://127.0.0.1:8000/
```
Expected response:
```json
{"status":"ok"}
```
