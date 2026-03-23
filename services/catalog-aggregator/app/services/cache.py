from __future__ import annotations

from typing import Any, Optional
import orjson
from redis.asyncio import Redis

from app.config import settings


class Cache:
    def __init__(self) -> None:
        self._client: Optional[Redis] = None

    @property
    def enabled(self) -> bool:
        return bool(settings.redis_url)

    @property
    def client(self) -> Optional[Redis]:
        if not self.enabled:
            return None
        if self._client is None:
            self._client = Redis.from_url(settings.redis_url, decode_responses=False)
        return self._client

    async def get_json(self, key: str) -> Optional[Any]:
        if not self.client:
            return None
        value = await self.client.get(key)
        if not value:
            return None
        try:
            return orjson.loads(value)
        except Exception:
            return None

    async def set_json(self, key: str, value: Any, ttl: int) -> None:
        if not self.client:
            return
        try:
            payload = orjson.dumps(value)
            await self.client.setex(key, ttl, payload)
        except Exception:
            return


cache = Cache()
