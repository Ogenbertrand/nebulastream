FROM mcr.microsoft.com/playwright/python:v1.58.0-jammy

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY apps/backend-api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY apps/backend-api/ .
COPY packages/shared-types/ /packages/shared-types/

# Create non-root user (don't force UID; base image may already use 1000)
RUN id -u appuser >/dev/null 2>&1 || useradd -m appuser
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
