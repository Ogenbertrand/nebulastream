"""
Movie schemas
"""

from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class Genre(BaseModel):
    """Genre schema"""
    id: int
    name: str
    
    class Config:
        from_attributes = True


class CastMember(BaseModel):
    """Cast member schema"""
    id: int
    name: str
    character: str
    profile_path: Optional[str] = None
    order: int = 0


class CrewMember(BaseModel):
    """Crew member schema"""
    id: int
    name: str
    job: str
    department: str
    profile_path: Optional[str] = None


class Trailer(BaseModel):
    """Trailer schema"""
    key: str
    name: str
    site: str
    type: str


class SeasonSummary(BaseModel):
    id: int
    name: str
    season_number: int
    episode_count: int
    overview: Optional[str] = None
    poster_path: Optional[str] = None
    air_date: Optional[date] = None


class Episode(BaseModel):
    id: int
    name: str
    overview: Optional[str] = None
    episode_number: int
    season_number: int
    still_path: Optional[str] = None
    air_date: Optional[date] = None
    runtime: Optional[int] = None


class MovieBase(BaseModel):
    """Base movie schema"""
    title: str
    overview: Optional[str] = None
    release_date: Optional[date] = None
    poster_path: Optional[str] = None
    backdrop_path: Optional[str] = None
    vote_average: float = 0.0
    vote_count: int = 0
    popularity: float = 0.0


class MovieCreate(MovieBase):
    """Movie creation schema"""
    tmdb_id: Optional[int] = None
    imdb_id: Optional[str] = None
    original_title: Optional[str] = None
    tagline: Optional[str] = None
    runtime: Optional[int] = None
    adult: bool = False
    original_language: Optional[str] = "en"


class Movie(MovieBase):
    """Movie response schema"""
    id: int
    tmdb_id: Optional[int] = None
    imdb_id: Optional[str] = None
    original_title: Optional[str] = None
    tagline: Optional[str] = None
    runtime: Optional[int] = None
    adult: bool = False
    original_language: Optional[str] = "en"
    number_of_seasons: Optional[int] = None
    number_of_episodes: Optional[int] = None
    status: Optional[str] = None
    genres: List[Genre] = []
    
    class Config:
        from_attributes = True


class MovieDetail(Movie):
    """Detailed movie schema"""
    cast: List[CastMember] = []
    crew: List[CrewMember] = []
    trailers: List[Trailer] = []
    similar: List[Movie] = []
    seasons: List[SeasonSummary] = []


class MovieList(BaseModel):
    """Movie list response"""
    id: int
    title: str
    poster_path: Optional[str] = None
    backdrop_path: Optional[str] = None
    vote_average: float
    release_date: Optional[date] = None
    genre_ids: List[int] = []
    
    class Config:
        from_attributes = True
