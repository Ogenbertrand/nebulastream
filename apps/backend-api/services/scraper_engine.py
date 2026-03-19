"""
Playwright-based scraper engine for extracting direct media URLs from embeds.
"""

from __future__ import annotations

import asyncio
import random
import re
from typing import Dict, Iterable, List, Optional, Set

from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright

try:
    from playwright_stealth import stealth_async
except Exception:  # pragma: no cover - optional dependency
    stealth_async = None

from core.config import settings
from core.logging import get_logger
from schemas.stream import StreamSource
from services.cache import cache_service
from services.providers.common import guess_quality, stream_type_from_url

logger = get_logger("scraper_engine")

MEDIA_URL_RE = re.compile(r"https?://[^\s\"'<>]+\\.(?:m3u8|mp4)(?:\\?[^\s\"'<>]+)?", re.IGNORECASE)
MAX_RESPONSE_BYTES = 2_000_000

USER_AGENTS = [
    (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    ),
]

PROVIDERS = [
    {
        "name": "vidsrc",
        "display_name": "VidSrc",
        "base_url": "https://vidsrc.me",
        "embed_path": "/embed/movie/{tmdb_id}",
        "reliability": 80.0,
    },
    {
        "name": "vidcloud",
        "display_name": "VidCloud",
        "base_url": "https://vidcloud1.com",
        "embed_path": "/embed/movie/{tmdb_id}",
        "reliability": 75.0,
    },
    {
        "name": "superembed",
        "display_name": "SuperEmbed",
        "base_url": "https://multiembed.mov",
        "embed_path": "/?video_id={tmdb_id}&tmdb=1",
        "reliability": 70.0,
    },
    {
        "name": "2embed",
        "display_name": "2Embed",
        "base_url": "https://2embed.org",
        "embed_path": "/embed/tmdb/movie?id={tmdb_id}",
        "reliability": 65.0,
    },
    {
        "name": "vidlink",
        "display_name": "VidLink",
        "base_url": "https://vidlink.pro",
        "embed_path": "/movie/{tmdb_id}",
        "reliability": 60.0,
    },
]


def _build_embed_url(provider: Dict[str, str], tmdb_id: int) -> str:
    return f"{provider['base_url']}{provider['embed_path'].format(tmdb_id=tmdb_id)}"


def _is_media_url(url: str) -> bool:
    lowered = url.lower()
    return ".m3u8" in lowered or ".mp4" in lowered


def _extract_media_urls(text: str) -> Set[str]:
    return set(match.group(0) for match in MEDIA_URL_RE.finditer(text or ""))


def _should_parse_response(response) -> bool:
    content_type = (response.headers.get("content-type") or "").lower()
    if any(token in content_type for token in ("application/json", "text/", "application/javascript")):
        return True
    if response.url.lower().endswith((".json", ".txt")):
        return True
    return False


async def _extract_from_response(response, media_urls: Set[str]) -> None:
    if not _should_parse_response(response):
        return
    size_header = response.headers.get("content-length")
    try:
        if size_header and int(size_header) > MAX_RESPONSE_BYTES:
            return
    except ValueError:
        pass
    try:
        text = await response.text()
    except Exception:
        return
    media_urls.update(_extract_media_urls(text))


async def _scrape_provider(
    browser,
    provider: Dict[str, str],
    tmdb_id: int,
    semaphore: asyncio.Semaphore,
) -> List[StreamSource]:
    async with semaphore:
        embed_url = _build_embed_url(provider, tmdb_id)
        user_agent = random.choice(USER_AGENTS)
        media_urls: Set[str] = set()

        context = await browser.new_context(
            user_agent=user_agent,
            ignore_https_errors=True,
            java_script_enabled=True,
        )
        page = await context.new_page()
        response_tasks: Set[asyncio.Task] = set()

        if stealth_async is not None:
            await stealth_async(page)

        def capture_url(url: str) -> None:
            if _is_media_url(url):
                media_urls.add(url)

        page.on("request", lambda request: capture_url(request.url))

        def on_response(response):
            capture_url(response.url)
            if _should_parse_response(response):
                task = asyncio.create_task(_extract_from_response(response, media_urls))
                response_tasks.add(task)
                task.add_done_callback(lambda t: response_tasks.discard(t))

        page.on("response", on_response)

        try:
            await page.goto(
                embed_url,
                wait_until="domcontentloaded",
                timeout=settings.STREAM_SCRAPER_TIMEOUT_SECONDS * 1000,
            )
            await page.wait_for_timeout(settings.STREAM_SCRAPER_WAIT_MS)
        except PlaywrightTimeoutError:
            logger.warning("scraper.timeout", provider=provider["name"], url=embed_url)
        except Exception as exc:
            logger.warning("scraper.error", provider=provider["name"], url=embed_url, error=str(exc))
        finally:
            if response_tasks:
                await asyncio.gather(*response_tasks, return_exceptions=True)
            await page.close()
            await context.close()

        sources: List[StreamSource] = []
        for url in media_urls:
            sources.append(
                StreamSource(
                    url=url,
                    quality=guess_quality(url),
                    stream_type=stream_type_from_url(url),
                    language="en",
                    subtitles=[],
                    provider_name=provider["display_name"],
                    reliability_score=provider["reliability"],
                )
            )

        logger.info(
            "scraper.provider_complete",
            provider=provider["name"],
            discovered=len(sources),
        )
        return sources


def _dedupe_streams(streams: Iterable[StreamSource]) -> List[StreamSource]:
    seen: Set[str] = set()
    unique: List[StreamSource] = []
    for stream in streams:
        if stream.url in seen:
            continue
        seen.add(stream.url)
        unique.append(stream)
    return unique


async def scrape_streams(tmdb_id: int) -> List[StreamSource]:
    if not settings.STREAM_SCRAPER_ENABLED:
        return []

    cache_key = f"stream:scraper:{tmdb_id}"
    cached = await cache_service.get(cache_key)
    if cached:
        logger.info("scraper.cache_hit", tmdb_id=tmdb_id)
        return cached

    semaphore = asyncio.Semaphore(settings.STREAM_SCRAPER_MAX_CONCURRENCY)
    results: List[StreamSource] = []

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        try:
            tasks = [
                _scrape_provider(browser, provider, tmdb_id, semaphore)
                for provider in PROVIDERS
            ]
            provider_results = await asyncio.gather(*tasks, return_exceptions=True)
            for result in provider_results:
                if isinstance(result, Exception):
                    logger.warning("scraper.provider_error", tmdb_id=tmdb_id, error=str(result))
                    continue
                results.extend(result)
        finally:
            await browser.close()

    deduped = _dedupe_streams(results)
    if deduped:
        await cache_service.set(cache_key, deduped, ttl=settings.STREAM_SCRAPER_CACHE_TTL)
        logger.info("scraper.complete", tmdb_id=tmdb_id, discovered=len(deduped))
    else:
        logger.info("scraper.empty", tmdb_id=tmdb_id)

    return deduped
