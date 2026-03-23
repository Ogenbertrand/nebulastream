"""Stream provider scrapers."""

from services.providers.vidsrc_provider import get_streams as vidsrc_streams
from services.providers.vidsrc_provider import get_tv_streams as vidsrc_tv_streams
from services.providers.vidcloud_provider import get_streams as vidcloud_streams
from services.providers.vidcloud_provider import get_tv_streams as vidcloud_tv_streams
from services.providers.superembed_provider import get_streams as superembed_streams
from services.providers.superembed_provider import get_tv_streams as superembed_tv_streams
from services.providers.twoembed_provider import get_streams as twoembed_streams
from services.providers.twoembed_provider import get_tv_streams as twoembed_tv_streams
from services.providers.vidlink_provider import get_streams as vidlink_streams
from services.providers.vidlink_provider import get_tv_streams as vidlink_tv_streams
from services.providers.vidsrc_resolver_provider import get_streams as vidsrc_resolver_streams
from services.providers.vidsrc_resolver_provider import get_tv_streams as vidsrc_resolver_tv_streams

__all__ = [
    "vidsrc_streams",
    "vidsrc_tv_streams",
    "vidsrc_resolver_streams",
    "vidsrc_resolver_tv_streams",
    "vidcloud_streams",
    "vidcloud_tv_streams",
    "superembed_streams",
    "superembed_tv_streams",
    "twoembed_streams",
    "twoembed_tv_streams",
    "vidlink_streams",
    "vidlink_tv_streams",
]
