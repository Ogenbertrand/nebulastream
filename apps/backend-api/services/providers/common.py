"""
Shared helpers for stream provider scraping.
"""

from __future__ import annotations

import re
from typing import List, Optional, Set
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from core.logging import get_logger
from schemas.stream import StreamSource

logger = get_logger("stream_provider")

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

MEDIA_URL_RE = re.compile(
    r"https?://[^\s\"'<>]+\.(?:m3u8|mp4)(?:\?[^\s\"'<>]+)?",
    re.IGNORECASE,
)


def normalize_url(raw_url: str, base_url: str) -> Optional[str]:
    if not raw_url:
        return None
    raw_url = raw_url.strip()
    if raw_url.startswith("//"):
        return f"https:{raw_url}"
    if raw_url.startswith("http://") or raw_url.startswith("https://"):
        return raw_url
    return urljoin(base_url, raw_url)


def extract_iframe_urls(html: str, base_url: str) -> List[str]:
    soup = BeautifulSoup(html, "html.parser")
    urls: List[str] = []
    for iframe in soup.find_all("iframe"):
        src = iframe.get("src")
        normalized = normalize_url(src, base_url)
        if normalized:
            urls.append(normalized)
    return urls


def extract_media_urls(html: str, base_url: str) -> List[str]:
    soup = BeautifulSoup(html, "html.parser")
    urls: Set[str] = set()

    for tag in soup.find_all(["source", "video", "a"]):
        src = tag.get("src") or tag.get("href")
        normalized = normalize_url(src, base_url)
        if normalized and (".m3u8" in normalized or ".mp4" in normalized):
            urls.add(normalized)

    for match in MEDIA_URL_RE.finditer(html):
        urls.add(match.group(0))

    return list(urls)


def guess_quality(url: str) -> str:
    lowered = url.lower()
    for marker in ("2160", "4k"):
        if marker in lowered:
            return "4k"
    if "1080" in lowered:
        return "1080p"
    if "720" in lowered:
        return "720p"
    if "480" in lowered:
        return "480p"
    return "720p"


def stream_type_from_url(url: str) -> str:
    return "hls" if ".m3u8" in url.lower() else "direct"


async def fetch_html(
    url: str,
    client: httpx.AsyncClient,
    referer: Optional[str] = None,
) -> Optional[str]:
    headers = dict(DEFAULT_HEADERS)
    if referer:
        headers["Referer"] = referer
    try:
        response = await client.get(url, headers=headers, follow_redirects=True)
        if response.status_code >= 400:
            logger.warning("provider.fetch_failed", url=url, status=response.status_code)
            return None
        return response.text
    except Exception as exc:
        logger.warning("provider.fetch_error", url=url, error=str(exc))
        return None


async def scrape_provider_streams(
    embed_url: str,
    provider_name: str,
    reliability_score: float,
    client: httpx.AsyncClient,
    max_iframes: int = 3,
) -> List[StreamSource]:
    logger.info("provider.scrape_start", provider=provider_name, url=embed_url)

    html = await fetch_html(embed_url, client)
    if not html:
        return []

    media_urls: Set[str] = set(extract_media_urls(html, embed_url))
    iframe_urls = extract_iframe_urls(html, embed_url)

    for iframe_url in iframe_urls[:max_iframes]:
        iframe_html = await fetch_html(iframe_url, client, referer=embed_url)
        if iframe_html:
            media_urls.update(extract_media_urls(iframe_html, iframe_url))

    streams: List[StreamSource] = []
    for media_url in media_urls:
        streams.append(
            StreamSource(
                url=media_url,
                quality=guess_quality(media_url),
                stream_type=stream_type_from_url(media_url),
                language="en",
                subtitles=[],
                provider_name=provider_name,
                reliability_score=reliability_score,
            )
        )

    logger.info(
        "provider.scrape_complete",
        provider=provider_name,
        discovered=len(streams),
    )

    return streams
