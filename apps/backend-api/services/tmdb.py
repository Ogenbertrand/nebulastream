"""
TMDB (The Movie Database) API service
"""

from typing import List, Optional, Dict, Any
from datetime import date
import httpx
from core.config import settings
from core.logging import get_logger
from schemas.movie import MovieList, MovieDetail, Genre, CastMember, CrewMember, Trailer

logger = get_logger()


class TMDBService:
    """TMDB API service"""
    
    def __init__(self):
        self.base_url = settings.TMDB_BASE_URL
        self.image_base_url = settings.TMDB_IMAGE_BASE_URL
        self.api_key = settings.TMDB_API_KEY
        self._client: Optional[httpx.AsyncClient] = None
    
    @property
    def client(self) -> httpx.AsyncClient:
        """Get HTTP client"""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=30.0,
                headers={
                    "Accept": "application/json",
                    "User-Agent": "NebulaStream/1.0"
                }
            )
        return self._client
    
    def _get_image_url(self, path: Optional[str], size: str = "original") -> Optional[str]:
        """Get full image URL"""
        if not path:
            return None
        return f"{self.image_base_url}/{size}{path}"

    def _parse_date(self, value: Optional[str]) -> Optional[date]:
        """Parse TMDB date strings safely"""
        if not value:
            return None
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
    
    def _movie_to_list_item(self, data: Dict[str, Any]) -> MovieList:
        """Convert TMDB movie to MovieList schema"""
        return MovieList(
            id=data.get("id"),
            title=data.get("title", ""),
            poster_path=self._get_image_url(data.get("poster_path"), "w500"),
            backdrop_path=self._get_image_url(data.get("backdrop_path"), "original"),
            vote_average=data.get("vote_average", 0),
            release_date=self._parse_date(data.get("release_date")),
            genre_ids=data.get("genre_ids", [])
        )
    
    async def _make_request(self, endpoint: str, params: Dict[str, Any] = None) -> Optional[Dict]:
        """Make API request to TMDB"""
        if not self.api_key:
            logger.error("TMDB API key not configured")
            return None
        
        params = params or {}
        params["api_key"] = self.api_key
        
        try:
            response = await self.client.get(endpoint, params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error("TMDB API error", endpoint=endpoint, error=str(e))
            return None
        except Exception as e:
            logger.error("TMDB request error", endpoint=endpoint, error=str(e))
            return None
    
    async def get_trending(self, time_window: str = "week", page: int = 1) -> List[MovieList]:
        """Get trending movies"""
        data = await self._make_request(f"/trending/movie/{time_window}", {"page": page})
        if data and "results" in data:
            return [self._movie_to_list_item(m) for m in data["results"]]
        return []
    
    async def get_popular(self, page: int = 1) -> List[MovieList]:
        """Get popular movies"""
        data = await self._make_request("/movie/popular", {"page": page})
        if data and "results" in data:
            return [self._movie_to_list_item(m) for m in data["results"]]
        return []
    
    async def get_top_rated(self, page: int = 1) -> List[MovieList]:
        """Get top rated movies"""
        data = await self._make_request("/movie/top_rated", {"page": page})
        if data and "results" in data:
            return [self._movie_to_list_item(m) for m in data["results"]]
        return []
    
    async def get_upcoming(self, page: int = 1) -> List[MovieList]:
        """Get upcoming movies"""
        data = await self._make_request("/movie/upcoming", {"page": page})
        if data and "results" in data:
            return [self._movie_to_list_item(m) for m in data["results"]]
        return []
    
    async def get_now_playing(self, page: int = 1) -> List[MovieList]:
        """Get now playing movies"""
        data = await self._make_request("/movie/now_playing", {"page": page})
        if data and "results" in data:
            return [self._movie_to_list_item(m) for m in data["results"]]
        return []
    
    async def get_movies_by_genre(self, genre_id: int, page: int = 1, sort_by: str = "popularity.desc") -> List[MovieList]:
        """Get movies by genre"""
        params = {
            "page": page,
            "sort_by": sort_by,
            "with_genres": genre_id
        }
        data = await self._make_request("/discover/movie", params)
        if data and "results" in data:
            return [self._movie_to_list_item(m) for m in data["results"]]
        return []

    async def get_movies_by_origin_country(
        self,
        country_code: str,
        page: int = 1,
        genre_id: Optional[int] = None,
        sort_by: str = "popularity.desc",
    ) -> List[MovieList]:
        """Get movies by origin country (optionally filtered by genre)"""
        params = {
            "page": page,
            "sort_by": sort_by,
            "with_origin_country": country_code,
        }
        if genre_id:
            params["with_genres"] = genre_id

        data = await self._make_request("/discover/movie", params)
        if data and "results" in data:
            return [self._movie_to_list_item(m) for m in data["results"]]
        return []
    
    async def search_movies(
        self,
        query: str,
        page: int = 1,
        year: Optional[int] = None,
        include_adult: bool = False
    ) -> List[MovieList]:
        """Search movies"""
        params = {
            "query": query,
            "page": page,
            "include_adult": include_adult
        }
        if year:
            params["year"] = year
        
        data = await self._make_request("/search/movie", params)
        if data and "results" in data:
            return [self._movie_to_list_item(m) for m in data["results"]]
        return []
    
    async def get_movie_detail(self, movie_id: int) -> Optional[MovieDetail]:
        """Get detailed movie information"""
        # Get main movie details
        data = await self._make_request(f"/movie/{movie_id}", {"append_to_response": "credits,videos,similar"})
        
        if not data:
            return None
        
        # Parse genres
        genres = [Genre(id=g["id"], name=g["name"]) for g in data.get("genres", [])]
        
        # Parse cast
        cast = []
        for c in data.get("credits", {}).get("cast", [])[:10]:  # Top 10 cast
            cast.append(CastMember(
                id=c["id"],
                name=c["name"],
                character=c.get("character", ""),
                profile_path=self._get_image_url(c.get("profile_path"), "w200"),
                order=c.get("order", 0)
            ))
        
        # Parse crew (directors, writers)
        crew = []
        for c in data.get("credits", {}).get("crew", []):
            if c.get("job") in ["Director", "Writer", "Screenplay"]:
                crew.append(CrewMember(
                    id=c["id"],
                    name=c["name"],
                    job=c["job"],
                    department=c.get("department", ""),
                    profile_path=self._get_image_url(c.get("profile_path"), "w200")
                ))
        
        # Parse trailers
        trailers = []
        for v in data.get("videos", {}).get("results", []):
            if v["site"] == "YouTube" and v["type"] in ["Trailer", "Teaser"]:
                trailers.append(Trailer(
                    key=v["key"],
                    name=v["name"],
                    site=v["site"],
                    type=v["type"]
                ))
        
        # Parse similar movies
        similar = []
        for m in data.get("similar", {}).get("results", [])[:6]:
            similar.append(self._movie_to_list_item(m))
        
        return MovieDetail(
            id=data["id"],
            tmdb_id=data["id"],
            imdb_id=data.get("imdb_id"),
            title=data.get("title", ""),
            original_title=data.get("original_title"),
            overview=data.get("overview"),
            tagline=data.get("tagline"),
            poster_path=self._get_image_url(data.get("poster_path"), "w500"),
            backdrop_path=self._get_image_url(data.get("backdrop_path"), "original"),
            release_date=self._parse_date(data.get("release_date")),
            runtime=data.get("runtime"),
            vote_average=data.get("vote_average", 0),
            vote_count=data.get("vote_count", 0),
            popularity=data.get("popularity", 0),
            adult=data.get("adult", False),
            original_language=data.get("original_language"),
            genres=genres,
            cast=cast,
            crew=crew,
            trailers=trailers,
            similar=similar
        )
    
    async def get_movie_list_item(self, movie_id: int) -> Optional[MovieList]:
        """Get minimal movie info for list display"""
        data = await self._make_request(f"/movie/{movie_id}")
        if data:
            return self._movie_to_list_item(data)
        return None
    
    async def get_similar_movies(self, movie_id: int, page: int = 1) -> List[MovieList]:
        """Get similar movies"""
        data = await self._make_request(f"/movie/{movie_id}/similar", {"page": page})
        if data and "results" in data:
            return [self._movie_to_list_item(m) for m in data["results"]]
        return []
    
    async def get_recommendations(self, movie_id: int, page: int = 1) -> List[MovieList]:
        """Get movie recommendations"""
        data = await self._make_request(f"/movie/{movie_id}/recommendations", {"page": page})
        if data and "results" in data:
            return [self._movie_to_list_item(m) for m in data["results"]]
        return []
    
    async def get_genres(self) -> List[Genre]:
        """Get all movie genres"""
        data = await self._make_request("/genre/movie/list")
        if data and "genres" in data:
            return [Genre(id=g["id"], name=g["name"]) for g in data["genres"]]
        return []
    
    async def get_search_suggestions(self, query: str, limit: int = 5) -> List[Dict]:
        """Get search suggestions"""
        movies = await self.search_movies(query, page=1)
        suggestions = []
        
        for m in movies[:limit]:
            suggestions.append({
                "id": m.id,
                "title": m.title,
                "poster_path": m.poster_path,
                "year": m.release_date.year if m.release_date else None
            })
        
        return suggestions
    
    async def close(self):
        """Close HTTP client"""
        if self._client:
            await self._client.aclose()


# Global TMDB service instance
tmdb_service = TMDBService()
