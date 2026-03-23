"""VidSrc resolver provider (direct HLS)."""

from __future__ import annotations

import asyncio
import base64
import re
from typing import Dict, List, Optional
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup, Comment

from core.config import settings
from core.logging import get_logger
from schemas.stream import StreamSource
from services.providers.common import guess_quality, stream_type_from_url, build_referer_headers

logger = get_logger("provider.vidsrc_resolver")

BASE_URL = "https://vidsrc.me"
BASE_ALT_URL = "https://vidsrcme.ru"
RCP_URL = "https://vidsrc.stream/rcp"
TMDB_EMBED_URL = "https://vidsrc.net/embed/movie?tmdb={tmdb_id}"
TMDB_EMBED_ALT_URL = "https://vsembed.ru/embed/movie?tmdb={tmdb_id}"
TMDB_TV_EMBED_URL = "https://vidsrc.net/embed/tv?tmdb={tmdb_id}&season={season}&episode={episode}"
TMDB_TV_EMBED_ALT_URL = "https://vsembed.ru/embed/tv?tmdb={tmdb_id}&season={season}&episode={episode}"
PROVIDER_NAME = "VidSrc Resolver"
RELIABILITY_SCORE = 90.0

PREFERRED_SOURCES = ("VidSrc PRO", "Superembed")
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}
CAPTCHA_IN_URL = "https://2captcha.com/in.php"
CAPTCHA_RES_URL = "https://2captcha.com/res.php"


def _merge_headers(headers: Optional[Dict[str, str]]) -> Dict[str, str]:
    merged = dict(DEFAULT_HEADERS)
    if headers:
        merged.update(headers)
    return merged


def _rcp_headers(referrer: str, user_agent: Optional[str] = None) -> Dict[str, str]:
    headers = {"Referer": referrer}
    if user_agent:
        headers["User-Agent"] = user_agent
    if settings.VIDSRC_RCP_COOKIE:
        headers["Cookie"] = settings.VIDSRC_RCP_COOKIE
    return headers


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


def _extract_turnstile_payload(html: str) -> Optional[Dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    el = soup.find(class_="cf-turnstile")
    if not el:
        return None
    sitekey = el.get("data-sitekey")
    if not sitekey:
        return None
    payload: Dict[str, str] = {"sitekey": sitekey}
    if el.get("data-action"):
        payload["action"] = el.get("data-action")
    if el.get("data-cdata"):
        payload["data"] = el.get("data-cdata")
    if el.get("data-pagedata"):
        payload["pagedata"] = el.get("data-pagedata")
    return payload


async def _solve_turnstile_2captcha(
    page_url: str,
    payload: Dict[str, str],
    client: httpx.AsyncClient,
    timeout_seconds: Optional[int] = None,
) -> Optional[Dict[str, str]]:
    api_key = settings.CAPTCHA_2CAPTCHA_API_KEY
    if not api_key:
        return None
    timeout_seconds = timeout_seconds or settings.CAPTCHA_2CAPTCHA_TIMEOUT_SECONDS

    data = {
        "key": api_key,
        "method": "turnstile",
        "sitekey": payload.get("sitekey"),
        "pageurl": page_url,
        "json": 1,
    }
    if payload.get("action"):
        data["action"] = payload["action"]
    if payload.get("data"):
        data["data"] = payload["data"]
    if payload.get("pagedata"):
        data["pagedata"] = payload["pagedata"]

    try:
        resp = await client.post(CAPTCHA_IN_URL, data=data)
        result = resp.json()
    except Exception as exc:
        logger.warning("vidsrc.turnstile_submit_failed", error=repr(exc))
        return None

    if result.get("status") != 1:
        logger.warning("vidsrc.turnstile_submit_error", error=result.get("request"))
        return None

    request_id = result.get("request")
    if not request_id:
        return None

    poll_deadline = asyncio.get_event_loop().time() + timeout_seconds
    while asyncio.get_event_loop().time() < poll_deadline:
        await asyncio.sleep(settings.CAPTCHA_2CAPTCHA_POLL_SECONDS)
        try:
            poll = await client.get(
                CAPTCHA_RES_URL,
                params={"key": api_key, "action": "get", "id": request_id, "json": 1},
            )
            poll_data = poll.json()
        except Exception as exc:
            logger.warning("vidsrc.turnstile_poll_failed", error=repr(exc))
            continue

        if poll_data.get("status") == 1:
            token = poll_data.get("request")
            user_agent = poll_data.get("useragent")
            if token:
                return {"token": token, "useragent": user_agent or ""}
            return None

        if poll_data.get("request") == "CAPCHA_NOT_READY":
            continue

        logger.warning("vidsrc.turnstile_poll_error", error=poll_data.get("request"))
        return None

    logger.warning("vidsrc.turnstile_timeout")
    return None


async def _collect_turnstile_params_playwright(
    page_url: str,
    referrer: str,
) -> Optional[Dict[str, str]]:
    if not settings.VIDSRC_TURNSTILE_INTERCEPT:
        return None
    try:
        from playwright.async_api import TimeoutError as PlaywrightTimeoutError
        from playwright.async_api import async_playwright
    except Exception as exc:
        logger.warning("vidsrc.turnstile_playwright_unavailable", error=repr(exc))
        return None

    user_agent = DEFAULT_HEADERS["User-Agent"]
    intercept_script = """
        Object.defineProperty(window, 'turnstile', {
          configurable: true,
          get() { return window.__tsObj; },
          set(value) {
            window.__tsObj = value;
            if (value && value.render && !value.__wrapped) {
              const original = value.render;
              value.render = function(el, params) {
                window.__tsParams = params;
                return original(el, params);
              };
              value.__wrapped = true;
            }
          }
        });
    """
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            try:
                context = await browser.new_context(
                    user_agent=user_agent,
                    ignore_https_errors=True,
                    extra_http_headers=_rcp_headers(referrer, user_agent=user_agent),
                )
                page = await context.new_page()
                await page.add_init_script(intercept_script)
                await page.goto(
                    page_url,
                    wait_until="domcontentloaded",
                    timeout=settings.VIDSRC_TURNSTILE_INTERCEPT_TIMEOUT_SECONDS * 1000,
                )
                await page.wait_for_function(
                    "window.__tsParams !== undefined",
                    timeout=settings.VIDSRC_TURNSTILE_INTERCEPT_TIMEOUT_SECONDS * 1000,
                )
                params = await page.evaluate("window.__tsParams")
                if not params:
                    return None
                payload: Dict[str, str] = {
                    "sitekey": params.get("sitekey") or "",
                    "action": params.get("action") or "",
                    "data": params.get("cData") or "",
                    "pagedata": params.get("chlPageData") or "",
                    "useragent": user_agent,
                }
                return payload
            finally:
                await browser.close()
    except PlaywrightTimeoutError:
        logger.warning("vidsrc.turnstile_intercept_timeout", url=page_url)
        return None
    except Exception as exc:
        logger.warning("vidsrc.turnstile_intercept_failed", url=page_url, error=repr(exc))
        return None


async def _maybe_bypass_turnstile(
    rcp_url: str,
    html: str,
    client: httpx.AsyncClient,
    referrer: str,
) -> Optional[str]:
    payload = _extract_turnstile_payload(html)
    if not payload:
        payload = await _collect_turnstile_params_playwright(rcp_url, referrer)
        if not payload:
            return html
    else:
        if not any(payload.get(key) for key in ("action", "data", "pagedata")):
            intercepted = await _collect_turnstile_params_playwright(rcp_url, referrer)
            if intercepted:
                for key in ("action", "data", "pagedata"):
                    if intercepted.get(key):
                        payload[key] = intercepted[key]
                if intercepted.get("sitekey"):
                    payload["sitekey"] = intercepted["sitekey"]

    logger.info("vidsrc.turnstile_detected", url=rcp_url)

    solved = await _solve_turnstile_2captcha(rcp_url, payload, client)
    if not solved:
        return html

    headers = _rcp_headers(referrer, user_agent=solved.get("useragent"))
    if solved.get("useragent"):
        headers["User-Agent"] = solved["useragent"]

    origin = _origin_from_url(rcp_url)
    verify_url = f"{origin}/rcp_verify"
    try:
        await client.post(verify_url, data={"token": solved["token"]}, headers=headers)
    except Exception as exc:
        logger.warning("vidsrc.turnstile_verify_failed", error=repr(exc))
        return html

    refreshed = await _fetch_text(rcp_url, client, headers=headers)
    return refreshed or html


def _b64_decode_string(value: str) -> str:
    padding = "=" * ((4 - len(value) % 4) % 4)
    return base64.b64decode(value + padding).decode("utf-8", errors="ignore")


def _bMGyx71TzQLfdonN(value: str) -> str:
    step = 3
    if not isinstance(value, str):
        return ""
    parts = [value[i : i + step] for i in range(0, len(value), step)]
    return "".join(parts[::-1])


def _Iry9MQXnLs(value: str) -> str:
    key = "pWB9V)[*4I`nJpp?ozyB~dbr9yt!_n4u"
    pairs = re.findall(r"..", value)
    decoded = "".join(chr(int(pair, 16)) for pair in pairs)
    xor_chars = []
    for idx, ch in enumerate(decoded):
        xor_chars.append(chr(ord(ch) ^ ord(key[idx % len(key)])))
    shifted = "".join(chr(ord(ch) - 3) for ch in xor_chars)
    return _b64_decode_string(shifted)


def _IGLImMhWrI(value: str) -> str:
    reversed_value = value[::-1]
    rot13 = []
    for ch in reversed_value:
        if "a" <= ch <= "z":
            rot13.append(chr(((ord(ch) - 97 + 13) % 26) + 97))
        elif "A" <= ch <= "Z":
            rot13.append(chr(((ord(ch) - 65 + 13) % 26) + 65))
        else:
            rot13.append(ch)
    return _b64_decode_string("".join(rot13)[::-1])


def _GTAxQyTyBx(value: str) -> str:
    reversed_value = value[::-1]
    filtered = "".join(reversed_value[i] for i in range(0, len(reversed_value), 2))
    return _b64_decode_string(filtered)


def _C66jPHx8qu(value: str) -> str:
    reversed_value = value[::-1]
    key = "X9a(O;FMV2-7VO5x;Ao\x05:dN1NoFs?j,"
    pairs = re.findall(r"..", reversed_value)
    decoded = "".join(chr(int(pair, 16)) for pair in pairs)
    out = []
    for idx, ch in enumerate(decoded):
        out.append(chr(ord(ch) ^ ord(key[idx % len(key)])))
    return "".join(out)


def _MyL1IRSfHe(value: str) -> str:
    reversed_value = value[::-1]
    shifted = "".join(chr(ord(ch) - 1) for ch in reversed_value)
    out = []
    for i in range(0, len(shifted), 2):
        chunk = shifted[i : i + 2]
        if len(chunk) < 2:
            continue
        out.append(chr(int(chunk, 16)))
    return "".join(out)


def _detdj7JHiK(value: str) -> str:
    sliced = value[10:-16]
    key = "3SAY~#%Y(V%>5d/Yg\"$G[Lh1rK4a;7ok"
    decoded = _b64_decode_string(sliced)
    repeated = (key * (len(decoded) // len(key) + 1))[: len(decoded)]
    out = []
    for idx, ch in enumerate(decoded):
        out.append(chr(ord(ch) ^ ord(repeated[idx])))
    return "".join(out)


def _nZlUnj2VSo(value: str) -> str:
    mapping = {
        "x": "a",
        "y": "b",
        "z": "c",
        "a": "d",
        "b": "e",
        "c": "f",
        "d": "g",
        "e": "h",
        "f": "i",
        "g": "j",
        "h": "k",
        "i": "l",
        "j": "m",
        "k": "n",
        "l": "o",
        "m": "p",
        "n": "q",
        "o": "r",
        "p": "s",
        "q": "t",
        "r": "u",
        "s": "v",
        "t": "w",
        "u": "x",
        "v": "y",
        "w": "z",
        "X": "A",
        "Y": "B",
        "Z": "C",
        "A": "D",
        "B": "E",
        "C": "F",
        "D": "G",
        "E": "H",
        "F": "I",
        "G": "J",
        "H": "K",
        "I": "L",
        "J": "M",
        "K": "N",
        "L": "O",
        "M": "P",
        "N": "Q",
        "O": "R",
        "P": "S",
        "Q": "T",
        "R": "U",
        "S": "V",
        "T": "W",
        "U": "X",
        "V": "Y",
        "W": "Z",
    }
    return "".join(mapping.get(ch, ch) for ch in value)


def _laM1dAi3vO(value: str, shift: int) -> str:
    reversed_value = value[::-1].replace("-", "+").replace("_", "/")
    decoded = _b64_decode_string(reversed_value)
    return "".join(chr(ord(ch) - shift) for ch in decoded)


def _prorcp_decrypt(param: str, decrypt_type: str) -> Optional[str]:
    try:
        if decrypt_type == "LXVUMCoAHJ":
            return _laM1dAi3vO(param, 3)
        if decrypt_type == "GuxKGDsA2T":
            return _laM1dAi3vO(param, 7)
        if decrypt_type == "laM1dAi3vO":
            return _laM1dAi3vO(param, 5)
        if decrypt_type == "nZlUnj2VSo":
            return _nZlUnj2VSo(param)
        if decrypt_type == "Iry9MQXnLs":
            return _Iry9MQXnLs(param)
        if decrypt_type == "IGLImMhWrI":
            return _IGLImMhWrI(param)
        if decrypt_type == "GTAxQyTyBx":
            return _GTAxQyTyBx(param)
        if decrypt_type == "C66jPHx8qu":
            return _C66jPHx8qu(param)
        if decrypt_type == "MyL1IRSfHe":
            return _MyL1IRSfHe(param)
        if decrypt_type == "detdj7JHiK":
            return _detdj7JHiK(param)
        if decrypt_type == "SqmOaLsKHv7vWtli":
            return ""
        if decrypt_type == "bMGyx71TzQLfdonN":
            return _bMGyx71TzQLfdonN(param)
    except Exception as exc:
        logger.warning("vidsrc.prorcp_decrypt_failed", error=repr(exc), decrypt_type=decrypt_type)
        return None
    return None


async def _resolve_prorcp_js(
    prorcp_url: str,
    referrer: str,
    html: str,
    client: httpx.AsyncClient,
) -> Optional[str]:
    soup = BeautifulSoup(html, "html.parser")
    script_srcs = [s.get("src") for s in soup.find_all("script") if s.get("src")]
    if not script_srcs:
        return None
    selected = None
    for src in reversed(script_srcs):
        if "cpt.js" in src:
            continue
        if ".js" in src:
            selected = src
            break
    if not selected:
        return None
    if selected.startswith("//"):
        script_url = f"https:{selected}"
    elif selected.startswith("/"):
        script_url = f"{_origin_from_url(prorcp_url)}{selected}"
    else:
        script_url = selected

    js_code = await _fetch_text(
        script_url,
        client,
        headers={"Referer": f"{_origin_from_url(prorcp_url)}/"},
    )
    if not js_code:
        return None

    decrypt_match = re.search(
        r"window\\[(?:\"|')?([A-Za-z0-9_]+)(?:\"|')?\\]\\(\"([^\"]+)\"\\)",
        js_code,
    )
    if not decrypt_match:
        decrypt_match = re.search(
            r"window\\[(?:\"|')?([A-Za-z0-9_]+)(?:\"|')?\\]\\('([^']+)'\\)",
            js_code,
        )
    if not decrypt_match:
        return None

    decrypt_type = decrypt_match.group(1).strip()
    decrypt_param = decrypt_match.group(2).strip()
    element_id = _prorcp_decrypt(decrypt_param, decrypt_type)
    if not element_id:
        return None
    data_el = soup.find(id=element_id)
    if not data_el:
        return None
    raw_data = data_el.get_text()
    if not raw_data:
        return None
    return _prorcp_decrypt(raw_data.strip(), decrypt_param)


async def _resolve_first_available(
    embed_urls: List[str],
    client: httpx.AsyncClient,
    timeout: float = 20.0,
) -> List[StreamSource]:
    tasks = [asyncio.create_task(_resolve_sources(url, client)) for url in embed_urls]
    try:
        for task in asyncio.as_completed(tasks, timeout=timeout):
            streams = await task
            if streams:
                for pending in tasks:
                    if pending is not task and not pending.done():
                        pending.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
                return streams
    except asyncio.TimeoutError:
        pass
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
    return []


async def _resolve_with_retry(
    embed_urls: List[str],
    client: httpx.AsyncClient,
    timeout: float = 25.0,
    attempts: int = 2,
    base_delay: float = 0.6,
) -> List[StreamSource]:
    for attempt in range(attempts):
        streams = await _resolve_first_available(embed_urls, client, timeout=timeout)
        if streams:
            return streams
        if attempt < attempts - 1:
            await asyncio.sleep(base_delay * (2 ** attempt))
    return []


async def _fetch_text(
    url: str,
    client: httpx.AsyncClient,
    headers: Optional[Dict[str, str]] = None,
    follow_redirects: bool = True,
) -> Optional[str]:
    last_exc: Optional[Exception] = None
    for attempt in range(3):
        try:
            response = await client.get(url, headers=_merge_headers(headers), follow_redirects=follow_redirects)
        except Exception as exc:
            last_exc = exc
            if attempt < 2:
                await asyncio.sleep(0.4 * (attempt + 1))
                continue
            logger.warning("vidsrc.fetch_error", url=url, error=repr(exc))
            return None
        if response.status_code >= 400:
            if response.status_code >= 500 and attempt < 2:
                await asyncio.sleep(0.4 * (attempt + 1))
                continue
            logger.warning("vidsrc.fetch_failed", url=url, status=response.status_code)
            return None
        return response.text
    if last_exc:
        logger.warning("vidsrc.fetch_error", url=url, error=repr(last_exc))
    return None


async def _get_sources(
    embed_url: str,
    client: httpx.AsyncClient,
) -> tuple[Dict[str, str], str, Optional[str], Optional[str]]:
    html = await _fetch_text(embed_url, client)
    if not html:
        return {}, _origin_from_url(embed_url), None, None
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
    iframe_origin: Optional[str] = None
    iframe_src_full: Optional[str] = None
    iframe = soup.find("iframe")
    if iframe and iframe.get("src"):
        iframe_src = iframe.get("src")
        if iframe_src.startswith("//"):
            iframe_src = f"https:{iframe_src}"
        elif iframe_src.startswith("/"):
            iframe_src = f"{base_origin}{iframe_src}"
        iframe_src_full = iframe_src
        iframe_origin = _origin_from_url(iframe_src)
    return sources, base_origin, iframe_origin, iframe_src_full


async def _resolve_rcp(
    source_hash: str,
    base_origin: str,
    client: httpx.AsyncClient,
    referrer: Optional[str] = None,
) -> Optional[Dict[str, str]]:
    rcp_candidates = [f"{base_origin}/rcp/{source_hash}"]
    if RCP_URL:
        rcp_candidates.append(f"{RCP_URL}/{source_hash}")

    for rcp_url in rcp_candidates:
        referer_header = referrer or f"{base_origin}/"
        html = await _fetch_text(rcp_url, client, headers=_rcp_headers(referer_header))
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
            return {"kind": "prorcp", "url": src_url, "referrer": rcp_url}

        # Only attempt Turnstile bypass if the payload is not already present.
        html = await _maybe_bypass_turnstile(rcp_url, html, client, referer_header) or html
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
            return {"kind": "prorcp", "url": src_url, "referrer": rcp_url}

    return None


async def _resolve_rcp_url(
    rcp_url: str,
    referrer: str,
    client: httpx.AsyncClient,
) -> Optional[Dict[str, str]]:
    html = await _fetch_text(rcp_url, client, headers=_rcp_headers(referrer))
    if not html:
        return None
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
        base_origin = _origin_from_url(rcp_url)
        if src_path.startswith("//"):
            src_url = f"https:{src_path}"
        elif src_path.startswith("/"):
            src_url = f"{base_origin}{src_path}"
        else:
            src_url = src_path
        return {"kind": "prorcp", "url": src_url, "referrer": rcp_url}

    # Only attempt Turnstile bypass if the payload is not already present.
    html = await _maybe_bypass_turnstile(rcp_url, html, client, referrer) or html
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
        base_origin = _origin_from_url(rcp_url)
        if src_path.startswith("//"):
            src_url = f"https:{src_path}"
        elif src_path.startswith("/"):
            src_url = f"{base_origin}{src_path}"
        else:
            src_url = src_path
        return {"kind": "prorcp", "url": src_url, "referrer": rcp_url}
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
    return {"streams": [hls_url], "subtitles": {}, "headers": build_referer_headers(referrer)}


async def _resolve_prorcp(
    prorcp_url: str,
    referrer: str,
    client: httpx.AsyncClient,
) -> Optional[Dict]:
    html = await _fetch_text(prorcp_url, client, headers={"Referer": referrer})
    if not html:
        return None
    if html.strip() in {"", "123"} or len(html.strip()) < 20:
        logger.warning("vidsrc.prorcp_blocked", url=prorcp_url, sample=html.strip()[:20])
        return None
    direct_match = re.search(r"https?://[^\s'\"\\]+\\.m3u8", html)
    if direct_match:
        return {"streams": [direct_match.group(0)], "subtitles": {}, "headers": build_referer_headers(referrer)}

    host_match = re.search(r"tmstr\\d+\\.[a-zA-Z0-9\\.-]+", html)
    host = host_match.group(0) if host_match else urlparse(prorcp_url).hostname
    pl_match = re.search(r"/pl/[^\s'\"]+/master\.m3u8", html)
    if not pl_match:
        pl_match = re.search(r"/pl/[^\s'\"]+/list\.m3u8", html)
    if not pl_match:
        decoded = await _resolve_prorcp_js(prorcp_url, referrer, html, client)
        if not decoded:
            return None
        direct_match = re.search(r"https?://[^\s'\"\\]+\\.m3u8", decoded)
        if direct_match:
            return {"streams": [direct_match.group(0)], "subtitles": {}, "headers": build_referer_headers(referrer)}
        pl_match = re.search(r"/pl/[^\s'\"]+/(?:master|list)\\.m3u8", decoded)
        if not pl_match:
            if decoded.startswith("//"):
                return {
                    "streams": [f"https:{decoded}"],
                    "subtitles": {},
                    "headers": build_referer_headers(referrer),
                }
            if decoded.startswith("/"):
                host = urlparse(prorcp_url).hostname
                if host:
                    return {
                        "streams": [f"https://{host}{decoded}"],
                        "subtitles": {},
                        "headers": build_referer_headers(referrer),
                    }
            if decoded.startswith("http"):
                return {
                    "streams": [decoded],
                    "subtitles": {},
                    "headers": build_referer_headers(referrer),
                }
            return None
    path = pl_match.group(0)
    if path.startswith("http"):
        hls_url = path
    elif host:
        hls_host = host
        if hls_host == "cloudnestra.com":
            hls_host = "tmstr3.cloudnestra.com"
        hls_url = f"https://{hls_host}{path}"
    else:
        hls_url = path
    return {"streams": [hls_url], "subtitles": {}, "headers": build_referer_headers(referrer)}


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
    return {"streams": hls_urls, "subtitles": subtitles, "headers": build_referer_headers(referrer)}


async def _resolve_sources(
    embed_url: str,
    client: httpx.AsyncClient,
) -> List[StreamSource]:
    sources, base_origin, iframe_origin, iframe_src = await _get_sources(embed_url, client)
    if not sources and not iframe_src:
        return []

    embed_referrer = embed_url

    origin_candidates = [base_origin]
    if iframe_origin and iframe_origin not in origin_candidates:
        origin_candidates.append(iframe_origin)

    ordered_names = [name for name in PREFERRED_SOURCES if name in sources]
    ordered_names += [name for name in sources.keys() if name not in ordered_names]

    # If the page already exposes an iframe RCP/prorcp URL, resolve it directly.
    if iframe_src:
        if "/prorcp/" in iframe_src or "/srcrcp/" in iframe_src:
            resolved = await _resolve_prorcp(iframe_src, embed_referrer, client)
        elif "/rcp/" in iframe_src:
            payload = await _resolve_rcp_url(iframe_src, embed_referrer, client)
            if payload:
                if payload["kind"] == "prorcp":
                    resolved = await _resolve_prorcp(payload["url"], payload["referrer"], client)
                else:
                    redirect_location = await _get_redirect_location(payload["url"], payload["referrer"], client)
                    if redirect_location and "vidsrc.stream" in redirect_location:
                        resolved = await _resolve_vidsrc_stream(payload["url"], payload["referrer"], client)
                    elif redirect_location and "multiembed.mov" in redirect_location:
                        resolved = await _resolve_superembed(payload["url"], payload["referrer"], client)
                    else:
                        resolved = None
            else:
                resolved = None
        else:
            resolved = None

        if resolved and resolved.get("streams"):
            subtitles = _subtitle_list(resolved.get("subtitles"))
            headers = resolved.get("headers")
            streams: List[StreamSource] = []
            for stream_url in resolved["streams"]:
                streams.append(
                    StreamSource(
                        url=stream_url,
                        quality=guess_quality(stream_url),
                        stream_type=stream_type_from_url(stream_url),
                        language="en",
                        subtitles=subtitles,
                        headers=headers,
                        provider_name=PROVIDER_NAME,
                        reliability_score=RELIABILITY_SCORE,
                    )
                )
            return streams

    for name in ordered_names:
        source_hash = sources.get(name)
        if not source_hash:
            continue
        for origin in origin_candidates:
            rcp_payload = await _resolve_rcp(source_hash, origin, client, referrer=embed_referrer)
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
            headers = resolved.get("headers")
            streams: List[StreamSource] = []
            for stream_url in resolved["streams"]:
                streams.append(
                    StreamSource(
                        url=stream_url,
                        quality=guess_quality(stream_url),
                        stream_type=stream_type_from_url(stream_url),
                        language="en",
                        subtitles=subtitles,
                        headers=headers,
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
        TMDB_EMBED_ALT_URL.format(tmdb_id=tmdb_id),
        f"{BASE_ALT_URL}/embed/movie/{tmdb_id}",
        TMDB_EMBED_URL.format(tmdb_id=tmdb_id),
        f"{BASE_URL}/embed/movie/{tmdb_id}",
    ]
    if client is None:
        async with httpx.AsyncClient(
            timeout=15.0,
            verify=not settings.STREAM_PROVIDER_SKIP_SSL_VERIFY,
        ) as owned_client:
            return await _resolve_with_retry(embed_urls, owned_client)
    return await _resolve_with_retry(embed_urls, client)


async def get_tv_streams(
    tmdb_id: int,
    season: int,
    episode: int,
    client: Optional[httpx.AsyncClient] = None,
) -> List[StreamSource]:
    embed_urls = [
        TMDB_TV_EMBED_ALT_URL.format(tmdb_id=tmdb_id, season=season, episode=episode),
        f"{BASE_ALT_URL}/embed/tv/{tmdb_id}/{season}/{episode}",
        TMDB_TV_EMBED_URL.format(tmdb_id=tmdb_id, season=season, episode=episode),
        f"{BASE_URL}/embed/tv/{tmdb_id}/{season}/{episode}",
    ]
    if client is None:
        async with httpx.AsyncClient(
            timeout=15.0,
            verify=not settings.STREAM_PROVIDER_SKIP_SSL_VERIFY,
        ) as owned_client:
            return await _resolve_with_retry(embed_urls, owned_client)
    return await _resolve_with_retry(embed_urls, client)
