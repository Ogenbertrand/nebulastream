from abc import ABC, abstractmethod
from typing import List
from app.schemas import CatalogItem


class Provider(ABC):
    name: str

    @abstractmethod
    async def trending(self, media_type: str, page: int) -> List[CatalogItem]:
        raise NotImplementedError

    @abstractmethod
    async def popular(self, media_type: str, page: int) -> List[CatalogItem]:
        raise NotImplementedError

    @abstractmethod
    async def top_rated(self, media_type: str, page: int) -> List[CatalogItem]:
        raise NotImplementedError

    @abstractmethod
    async def search(self, query: str, media_type: str, page: int) -> List[CatalogItem]:
        raise NotImplementedError

    @abstractmethod
    async def genres(self, media_type: str) -> List[dict]:
        raise NotImplementedError
