"""Stream provider scrapers."""

from services.providers.vidsrc_provider import get_streams as vidsrc_streams
from services.providers.vidcloud_provider import get_streams as vidcloud_streams
from services.providers.superembed_provider import get_streams as superembed_streams
from services.providers.twoembed_provider import get_streams as twoembed_streams
from services.providers.vidlink_provider import get_streams as vidlink_streams

__all__ = [
    "vidsrc_streams",
    "vidcloud_streams",
    "superembed_streams",
    "twoembed_streams",
    "vidlink_streams",
]
