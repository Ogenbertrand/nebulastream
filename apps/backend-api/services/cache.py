"""
Redis cache service
"""

import json
from typing import Any, Optional
import redis.asyncio as redis
from fastapi.encoders import jsonable_encoder
from core.config import settings
from core.logging import get_logger

logger = get_logger()


class CacheService:
    """Redis cache service"""
    
    def __init__(self):
        self._redis: Optional[redis.Redis] = None

    def _format_key(self, key: str) -> str:
        prefix = (settings.CACHE_PREFIX or "").strip()
        if not prefix:
            return key
        return f"{prefix}:{key}"

    def _stale_key(self, key: str) -> str:
        return self._format_key(f"stale:{key}")
    
    async def connect(self):
        """Connect to Redis"""
        try:
            self._redis = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
            await self._redis.ping()
            logger.info("Connected to Redis")
        except Exception as e:
            logger.error("Failed to connect to Redis", error=str(e))
            self._redis = None
    
    async def disconnect(self):
        """Disconnect from Redis"""
        if self._redis:
            await self._redis.close()
            logger.info("Disconnected from Redis")
    
    async def ping(self) -> bool:
        """Check Redis connection"""
        if not self._redis:
            return False
        try:
            return await self._redis.ping()
        except Exception:
            return False
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if not self._redis:
            return None
        
        try:
            value = await self._redis.get(self._format_key(key))
            if value:
                return json.loads(value)
            return None
        except json.JSONDecodeError as e:
            logger.warning("Cache decode error", key=key, error=str(e))
            return None
        except Exception as e:
            logger.warning("Cache get error", key=key, error=str(e))
            return None

    async def get_stale(self, key: str) -> Optional[Any]:
        """Get stale value from cache (longer TTL fallback)"""
        if not self._redis:
            return None

        try:
            value = await self._redis.get(self._stale_key(key))
            if value:
                return json.loads(value)
            return None
        except json.JSONDecodeError as e:
            logger.warning("Cache stale decode error", key=key, error=str(e))
            return None
        except Exception as e:
            logger.warning("Cache stale get error", key=key, error=str(e))
            return None
    
    async def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        """Set value in cache"""
        if not self._redis:
            return False
        
        try:
            payload = jsonable_encoder(value)
            serialized = json.dumps(payload)
            await self._redis.setex(self._format_key(key), ttl, serialized)
            return True
        except Exception as e:
            logger.warning("Cache set error", key=key, error=str(e))
            return False

    async def set_with_stale(self, key: str, value: Any, ttl: int = 3600, stale_ttl: int | None = None) -> bool:
        """Set value in cache and keep a longer-lived stale fallback."""
        if not self._redis:
            return False

        try:
            payload = jsonable_encoder(value)
            serialized = json.dumps(payload)
            await self._redis.setex(self._format_key(key), ttl, serialized)
            ttl_stale = stale_ttl or max(ttl * 6, 24 * 60 * 60)
            await self._redis.setex(self._stale_key(key), ttl_stale, serialized)
            return True
        except Exception as e:
            logger.warning("Cache set stale error", key=key, error=str(e))
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete value from cache"""
        if not self._redis:
            return False
        
        try:
            await self._redis.delete(self._format_key(key))
            return True
        except Exception as e:
            logger.warning("Cache delete error", key=key, error=str(e))
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """Delete keys matching pattern"""
        if not self._redis:
            return 0
        
        try:
            full_pattern = self._format_key(pattern)
            keys = await self._redis.keys(full_pattern)
            if keys:
                return await self._redis.delete(*keys)
            return 0
        except Exception as e:
            logger.warning("Cache delete pattern error", pattern=pattern, error=str(e))
            return 0
    
    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        if not self._redis:
            return False
        
        try:
            return await self._redis.exists(self._format_key(key)) > 0
        except Exception:
            return False
    
    async def increment(self, key: str, amount: int = 1) -> int:
        """Increment counter"""
        if not self._redis:
            return 0
        
        try:
            return await self._redis.incrby(self._format_key(key), amount)
        except Exception as e:
            logger.warning("Cache increment error", key=key, error=str(e))
            return 0


# Global cache service instance
cache_service = CacheService()
