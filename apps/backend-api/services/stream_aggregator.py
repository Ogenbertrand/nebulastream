"""
Stream aggregation service
Aggregates streaming sources from multiple providers
"""

from typing import List, Optional
from core.config import settings
from core.logging import get_logger
from schemas.stream import StreamSource

logger = get_logger()


class StreamAggregator:
    """Aggregates streams from multiple providers"""
    
    def __init__(self):
        self.providers = []
        self._load_providers()
    
    def _load_providers(self):
        """Load configured providers"""
        # In production, these would be loaded from database
        # For now, we'll define some example providers
        self.providers = [
            {
                "name": "vidcloud",
                "display_name": "VidCloud",
                "type": "embed",
                "base_url": "https://vidcloud.pro",
                "reliability": 75
            },
            {
                "name": "vidsrc",
                "display_name": "VidSrc",
                "type": "embed",
                "base_url": "https://vidsrc.me",
                "reliability": 80
            },
            {
                "name": "superembed",
                "display_name": "SuperEmbed",
                "type": "embed",
                "base_url": "https://multiembed.mov",
                "reliability": 70
            },
            {
                "name": "2embed",
                "display_name": "2Embed",
                "type": "embed",
                "base_url": "https://2embed.org",
                "reliability": 65
            }
        ]
    
    async def get_streams(
        self,
        movie_id: int,
        preferred_quality: str = "720p",
        preferred_language: str = "en"
    ) -> List[StreamSource]:
        """Get streaming sources for a movie"""
        sources = []
        
        # Get TMDB ID for the movie (we'll use movie_id as tmdb_id for now)
        tmdb_id = movie_id
        
        # Generate sources from each provider
        for provider in self.providers:
            try:
                source = self._generate_source(provider, tmdb_id, preferred_quality, preferred_language)
                if source:
                    sources.append(source)
            except Exception as e:
                logger.warning(
                    "Failed to generate source",
                    provider=provider["name"],
                    movie_id=movie_id,
                    error=str(e)
                )
        
        # Sort by reliability score (highest first)
        sources.sort(key=lambda x: x.reliability_score, reverse=True)
        
        return sources
    
    def _generate_source(
        self,
        provider: dict,
        tmdb_id: int,
        quality: str,
        language: str
    ) -> Optional[StreamSource]:
        """Generate stream source for a provider"""
        provider_type = provider["type"]
        base_url = provider["base_url"]
        
        if provider_type == "embed":
            # Generate embed URL
            if "vidcloud" in provider["name"]:
                url = f"{base_url}/embed/movie/{tmdb_id}"
            elif "vidsrc" in provider["name"]:
                url = f"{base_url}/embed/movie/{tmdb_id}"
            elif "superembed" in provider["name"] or "multiembed" in provider["name"]:
                url = f"{base_url}/?video_id={tmdb_id}&tmdb=1"
            elif "2embed" in provider["name"]:
                url = f"{base_url}/embed/tmdb/movie?id={tmdb_id}"
            else:
                url = f"{base_url}/embed/{tmdb_id}"
            
            return StreamSource(
                url=url,
                quality=quality,
                stream_type="embed",
                language=language,
                subtitles=[],
                provider_name=provider["display_name"],
                reliability_score=provider["reliability"]
            )
        
        elif provider_type == "direct":
            # Direct HLS/MP4 streams would be handled here
            # These would typically come from your own infrastructure
            pass
        
        return None
    
    async def check_stream_health(self, url: str) -> bool:
        """Check if a stream URL is accessible"""
        # TODO: Implement stream health checking
        # This would make a HEAD request to verify the stream is accessible
        return True
    
    async def report_issue(self, url: str, issue_type: str):
        """Report a stream issue"""
        logger.warning("Stream issue reported", url=url, issue_type=issue_type)
        # TODO: Implement issue tracking and provider score adjustment


# Global stream aggregator instance
stream_aggregator = StreamAggregator()
