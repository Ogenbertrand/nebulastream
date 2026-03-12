"""
Health check endpoints
"""

from datetime import datetime
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.cache import cache_service

router = APIRouter()


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """Basic health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "nebula-backend-api"
    }


@router.get("/health/ready", status_code=status.HTTP_200_OK)
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """Readiness check - verifies database and cache connections"""
    checks = {
        "database": False,
        "cache": False
    }
    
    # Check database
    try:
        from sqlalchemy import text
        await db.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception:
        pass
    
    # Check cache
    try:
        await cache_service.ping()
        checks["cache"] = True
    except Exception:
        pass
    
    all_healthy = all(checks.values())
    
    return {
        "status": "ready" if all_healthy else "not_ready",
        "timestamp": datetime.utcnow().isoformat(),
        "checks": checks
    }


@router.get("/health/live", status_code=status.HTTP_200_OK)
async def liveness_check():
    """Liveness check - basic service availability"""
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat()
    }
