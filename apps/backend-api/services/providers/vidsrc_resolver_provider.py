"""VidSrc resolver provider (direct HLS)."""

from __future__ import annotations

import base64
import re
from typing import Dict, List, Optional
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup, Comment

from core.config import settings
from core.logging import get_logger
from schemas.stream import StreamSource
from services.providers.common import guess_quality, stream_type_from_url

logger = get_logger("provider.vidsrc_resolver")

BASE_URL = "https://vidsrc.me"
RCP_URL = "https://vidsrc.stream/rcp"
TMDB_EMBED_URL = "https://vidsrc.net/embed/movie?tmdb={tmdb_id}"
PROVIDER_NAME = "VidSrc Resolver"
RELIABILITY_SCORE = 90.0

PREFERRED_SOURCES = ("VidSrc PRO", "Superembed")
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}


def _merge_headers(headers: Optional[Dict[str, str]]) -> Dict[str, str]:
    merged = dict(DEFAULT_HEADERS)
    if headers:
        merged.update(headers)
    return merged


def _origin_from_url(url: str) -> str:
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.hostname:
        return ""
    return f"{parsed.scheme}://{parsed.hostname}"


def _decode_src(encoded: str, seed: str) -> str:
    encoded_buffer = bytes.fromhex(encoded)
    decoded = ""
    for i in range(len(encoded_buffer)):
        decoded += chr(encoded_buffer[i] ^ ord(seed[i % len(seed)]))
    return decoded


def _decode_base64_url_safe(value: str) -> bytearray:
    standardized_input = value.replace("_", "/").replace("-", "+")
    return bytearray(base64.b64decode(standardized_input))


def _hunter(h, u, n, t, e, r) -> str:
    charset = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/"

    def _hunter_def(d, base_from, base_to) -> int:
        source_base = charset[0:base_from]
        target_base = charset[0:base_to]
        reversed_input = list(d)[::-1]
        result = 0
        for power, digit in enumerate(reversed_input):
            if digit in source_base:
                result += source_base.index(digit) * base_from**power
        converted_result = ""
        while result > 0:
            converted_result = target_base[result % base_to] + converted_result
            result = (result - (result % base_to)) // base_to
        return int(converted_result) or 0

    i = 0
    result_str = ""
    while i < len(h):
        j = 0
        s = ""
        while h[i] != n[e]:
            s += h[i]
            i += 1
        while j < len(n):
            s = s.replace(n[j], str(j))
            j += 1
        result_str += chr(_hunter_def(s, e, 10) - t)
        i += 1
    return result_str


def _decode_hls_url(encoded_url: str) -> str:
    def _format_hls_b64(data: str) -> str:
        cleaned = re.sub(r"/@#@/[^=/]+==", "", data)
        if re.search(r"/@#@/[^=/]+==", cleaned):
            return _format_hls_b64(cleaned)
        return cleaned

    formatted_b64 = _format_hls_b64(encoded_url[2:])
    b64_data = _decode_base64_url_safe(formatted_b64)
    return b64_data.decode("utf-8")


def _subtitle_list(subtitles: Optional[Dict[str, str]]) -> List[dict]:
    if not subtitles:
        return []
    return [{"lang": lang, "url": url, "label": lang} for lang, url in subtitles.items()]


async def _fetch_text(
    url: str,
    client: httpx.AsyncClient,
    headers: Optional[Dict[str, str]] = None,
    follow_redirects: bool = True,
) -> Optional[str]:
    try:
        response = await client.get(url, headers=_merge_headers(headers), follow_redirects=follow_redirects)
    except Exception as exc:
        logger.warning("vidsrc.fetch_error", url=url, error=str(exc))
        return None
    if response.status_code >= 400:
        logger.warning("vidsrc.fetch_failed", url=url, status=response.status_code)
        return None
    return response.text


async def _get_sources(
    embed_url: str,
    client: httpx.AsyncClient,
) -> tuple[Dict[str, str], str]:
    html = await _fetch_text(embed_url, client)
    if not html:
        return {}, embed_url
    soup = BeautifulSoup(html, "html.parser")
    sources = {
        source.text.strip(): source.get("data-hash")
        for source in soup.find_all("div", {"class": "server"})
        if source.text and source.get("data-hash")
    }
    if not sources:
        for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
            if "data-hash" not in comment:
                continue
            comment_soup = BeautifulSoup(comment, "html.parser")
            sources = {
                source.text.strip(): source.get("data-hash")
                for source in comment_soup.find_all("div", {"class": "server"})
                if source.text and source.get("data-hash")
            }
            if sources:
                break
    base_origin = _origin_from_url(embed_url)
    iframe = soup.find("iframe")
    if iframe and iframe.get("src"):
        iframe_src = iframe.get("src")
        if iframe_src.startswith("//"):
            iframe_src = f"https:{iframe_src}"
        elif iframe_src.startswith("/"):
            iframe_src = f"{base_origin}{iframe_src}"
        iframe_origin = _origin_from_url(iframe_src)
        if iframe_origin:
            base_origin = iframe_origin
    return sources, base_origin


async def _resolve_rcp(
    source_hash: str,
    base_origin: str,
    client: httpx.AsyncClient,
) -> Optional[Dict[str, str]]:
    rcp_candidates = [f"{base_origin}/rcp/{source_hash}"]
    if RCP_URL:
        rcp_candidates.append(f"{RCP_URL}/{source_hash}")

    for rcp_url in rcp_candidates:
        html = await _fetch_text(rcp_url, client, headers={"Referer": f"{base_origin}/"})
        if not html:
            continue
        soup = BeautifulSoup(html, "html.parser")
        hidden = soup.find("div", {"id": "hidden"})
        seed = soup.find("body").get("data-i") if soup.find("body") else None
        if hidden and seed and hidden.get("data-h"):
            decoded_url = _decode_src(hidden.get("data-h"), seed)
            if decoded_url.startswith("//"):
                decoded_url = f"https:{decoded_url}"
            return {"kind": "redirect", "url": decoded_url, "referrer": rcp_url}

        src_match = re.search(r"src:\s*['\"]([^'\"]+)['\"]", html)
        if src_match:
            src_path = src_match.group(1)
            if src_path.startswith("//"):
                src_url = f"https:{src_path}"
            elif src_path.startswith("/"):
                src_url = f"{base_origin}{src_path}"
            else:
                src_url = src_path
            return {"kind": "prorcp", "url": src_url, "referrer": f"{base_origin}/"}

    return None


async def _get_redirect_location(
    url: str,
    referrer: str,
    client: httpx.AsyncClient,
) -> Optional[str]:
    try:
        response = await client.get(url, headers={"Referer": referrer}, follow_redirects=False)
    except Exception as exc:
        logger.warning("vidsrc.redirect_error", url=url, error=str(exc))
        return None
    if response.status_code != 302:
        return None
    return response.headers.get("location")


async def _resolve_vidsrc_stream(
    source_url: str,
    referrer: str,
    client: httpx.AsyncClient,
) -> Optional[Dict]:
    html = await _fetch_text(source_url, client, headers={"Referer": referrer})
    if not html:
        return None
    encoded_hls = re.search(r'file:"([^"]*)"', html)
    pass_path = re.search(r'var pass_path = "(.*?)";', html)
    if not encoded_hls:
        return None
    hls_url = _decode_hls_url(encoded_hls.group(1))
    if pass_path:
        pass_url = pass_path.group(1)
        if pass_url.startswith("//"):
            pass_url = f"https:{pass_url}"
        await client.get(pass_url, headers={"Referer": referrer})
    return {"streams": [hls_url], "subtitles": {}}


async def _resolve_prorcp(
    prorcp_url: str,
    referrer: str,
    client: httpx.AsyncClient,
) -> Optional[Dict]:
    html = await _fetch_text(prorcp_url, client, headers={"Referer": referrer})
    if not html:
        return None
    host_match = re.search(r"tmstr3\.[a-zA-Z0-9\.-]+", html)
    host = host_match.group(0) if host_match else urlparse(prorcp_url).hostname
    pl_match = re.search(r"/pl/[^\s'\"]+/master\.m3u8", html)
    if not pl_match:
        pl_match = re.search(r"/pl/[^\s'\"]+/list\.m3u8", html)
    if not pl_match:
        return None
    path = pl_match.group(0)
    if path.startswith("http"):
        hls_url = path
    elif host:
        hls_url = f"https://{host}{path}"
    else:
        hls_url = path
    return {"streams": [hls_url], "subtitles": {}}


def _process_hunter_args(raw_args: str) -> List:
    hunter_args = re.search(r'^"(.*?)",(.*?),"(.*?)",(.*?),(.*?),(.*?)$', raw_args)
    if not hunter_args:
        return []
    processed = list(hunter_args.groups())
    processed[0] = str(processed[0])
    processed[1] = int(processed[1])
    processed[2] = str(processed[2])
    processed[3] = int(processed[3])
    processed[4] = int(processed[4])
    processed[5] = int(processed[5])
    return processed


async def _resolve_superembed(
    source_url: str,
    referrer: str,
    client: httpx.AsyncClient,
) -> Optional[Dict]:
    html = await _fetch_text(source_url, client, headers={"Referer": referrer})
    if not html:
        return None
    hunter_args = re.search(r"eval\(function\(h,u,n,t,e,r\).*?}\((.*?)\)\)", html)
    if not hunter_args:
        return None
    processed = _process_hunter_args(hunter_args.group(1))
    if not processed:
        return None
    unpacked = _hunter(*processed)
    hls_urls = re.findall(r'file:\"([^\"]*)\"', unpacked)
    if not hls_urls:
        return None
    subtitles: Dict[str, str] = {}
    subtitle_match = re.search(r'subtitle:\"([^\"]*)\"', unpacked)
    if subtitle_match:
        for subtitle in subtitle_match.group(1).split(","):
            subtitle_data = re.search(r"^\[(.*?)\](.*$)", subtitle)
            if not subtitle_data:
                continue
            subtitles[subtitle_data.group(1)] = subtitle_data.group(2)
    return {"streams": hls_urls, "subtitles": subtitles}


async def _resolve_sources(
    embed_url: str,
    client: httpx.AsyncClient,
) -> List[StreamSource]:
    sources, base_origin = await _get_sources(embed_url, client)
    if not sources:
        return []

    ordered_names = [name for name in PREFERRED_SOURCES if name in sources]
    ordered_names += [name for name in sources.keys() if name not in ordered_names]

    for name in ordered_names:
        source_hash = sources.get(name)
        if not source_hash:
            continue
        rcp_payload = await _resolve_rcp(source_hash, base_origin, client)
        if not rcp_payload:
            continue

        if rcp_payload["kind"] == "prorcp":
            resolved = await _resolve_prorcp(rcp_payload["url"], rcp_payload["referrer"], client)
        else:
            redirect_location = await _get_redirect_location(rcp_payload["url"], rcp_payload["referrer"], client)
            if not redirect_location:
                continue
            if "vidsrc.stream" in redirect_location:
                resolved = await _resolve_vidsrc_stream(rcp_payload["url"], rcp_payload["referrer"], client)
            elif "multiembed.mov" in redirect_location:
                resolved = await _resolve_superembed(rcp_payload["url"], rcp_payload["referrer"], client)
            else:
                resolved = None

        if not resolved or not resolved.get("streams"):
            continue

        subtitles = _subtitle_list(resolved.get("subtitles"))
        streams: List[StreamSource] = []
        for stream_url in resolved["streams"]:
            streams.append(
                StreamSource(
                    url=stream_url,
                    quality=guess_quality(stream_url),
                    stream_type=stream_type_from_url(stream_url),
                    language="en",
                    subtitles=subtitles,
                    provider_name=PROVIDER_NAME,
                    reliability_score=RELIABILITY_SCORE,
                )
            )
        return streams

    return []


async def get_streams(
    tmdb_id: int,
    client: Optional[httpx.AsyncClient] = None,
) -> List[StreamSource]:
    embed_urls = [
        TMDB_EMBED_URL.format(tmdb_id=tmdb_id),
        f"{BASE_URL}/embed/movie/{tmdb_id}",
    ]
    if client is None:
        async with httpx.AsyncClient(
            timeout=15.0,
            verify=not settings.STREAM_PROVIDER_SKIP_SSL_VERIFY,
        ) as owned_client:
            for embed_url in embed_urls:
                streams = await _resolve_sources(embed_url, owned_client)
                if streams:
                    return streams
            return []
    for embed_url in embed_urls:
        streams = await _resolve_sources(embed_url, client)
        if streams:
            return streams
    return []
