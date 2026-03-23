from typing import List, Optional, Dict
from pydantic import BaseModel


class ProviderItem(BaseModel):
    source: str
    external_id: Optional[str] = None
    score: Optional[float] = None
    raw: Optional[Dict] = None


class CatalogItem(BaseModel):
    id: str
    type: str
    title: str
    year: Optional[int] = None
    overview: Optional[str] = None
    poster_url: Optional[str] = None
    backdrop_url: Optional[str] = None
    genres: List[str] = []
    rating: Optional[float] = None
    popularity: Optional[float] = None
    language: Optional[str] = None
    country: Optional[str] = None
    availability: Optional[List[Dict]] = None
    sources: List[ProviderItem] = []


class CatalogResponse(BaseModel):
    items: List[CatalogItem]
    sources_missing: List[str] = []


class GenreItem(BaseModel):
    id: int
    name: str


class GenresResponse(BaseModel):
    genres: List[GenreItem]
    sources_missing: List[str] = []
