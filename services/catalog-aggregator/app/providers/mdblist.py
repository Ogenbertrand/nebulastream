from typing import List
from app.providers.base import Provider
from app.schemas import CatalogItem


class MDBListProvider(Provider):
    name = "mdblist"

    async def trending(self, media_type: str, page: int) -> List[CatalogItem]:
        return []

    async def popular(self, media_type: str, page: int) -> List[CatalogItem]:
        return []

    async def top_rated(self, media_type: str, page: int) -> List[CatalogItem]:
        return []

    async def search(self, query: str, media_type: str, page: int) -> List[CatalogItem]:
        return []

    async def genres(self, media_type: str) -> List[dict]:
        return []
