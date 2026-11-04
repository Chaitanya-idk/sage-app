import logging
from typing import Any, Optional

import httpx

from app.config import Settings, get_settings
from app.errors import APIError

log = logging.getLogger("sage.backend")

TUNNEL_DOWN = {502, 503, 504, 520, 521, 522, 523, 524, 530}
OFFLINE_MSG = "Backend offline — restart the Kaggle notebook and update BACKEND_URL."


class BackendClient:
    """Async client for the SAGE inference backend (Kaggle GPU behind a Cloudflare tunnel)."""

    def __init__(self, settings: Settings):
        self.base = settings.backend_url.rstrip("/")
        self.timeout = settings.backend_timeout_s
        key = settings.backend_api_key.strip()
        # The backend verifies "Authorization: Bearer"; X-API-Key is sent too for forward compatibility.
        self.headers = {"Authorization": f"Bearer {key}", "X-API-Key": key} if key else {}

    async def _request(self, method: str, path: str, timeout: Optional[float] = None, **kw) -> Any:
        try:
            async with httpx.AsyncClient(timeout=timeout or self.timeout, headers=self.headers) as c:
                r = await c.request(method, f"{self.base}{path}", **kw)
        except httpx.TimeoutException:
            raise APIError(504, "backend_timeout",
                           "The SAGE backend timed out. The first request for a crop loads a new adapter — try again shortly.")
        except httpx.HTTPError as e:
            log.warning("backend unreachable: %s", e)
            raise APIError(502, "backend_unreachable", OFFLINE_MSG)

        if r.status_code >= 400:
            detail = _detail(r)
            log.warning("backend %s %s -> %s: %s", method, path, r.status_code, detail)
            if r.status_code in TUNNEL_DOWN:
                raise APIError(502, "backend_unreachable", OFFLINE_MSG)
            if r.status_code in (401, 403):
                raise APIError(502, "backend_auth", f"Backend rejected the API key: {detail}")
            code = {400: "bad_request", 413: "image_too_large", 415: "unsupported_media",
                    422: "invalid_image"}.get(r.status_code, "backend_error")
            raise APIError(r.status_code if r.status_code < 500 else 502, code, detail)
        try:
            return r.json()
        except ValueError:
            raise APIError(502, "backend_bad_response", "Backend returned a non-JSON response — is BACKEND_URL correct?")

    async def health(self) -> dict:
        return await self._request("GET", "/health", timeout=10)

    async def model_status(self) -> dict:
        return await self._request("GET", "/api/v1/model/status", timeout=10)

    async def crops(self) -> dict:
        return await self._request("GET", "/api/v1/crops", timeout=20)

    async def predict(self, crop: str, image: bytes, filename: str, content_type: str, prompt: Optional[str],
                      max_new_tokens: Optional[int], temperature: Optional[float]) -> dict:
        data: dict[str, str] = {"crop": crop}
        if prompt:
            data["prompt"] = prompt
        if max_new_tokens is not None:
            data["max_new_tokens"] = str(max_new_tokens)
        if temperature is not None:
            data["temperature"] = str(temperature)
        return await self._request("POST", "/api/v1/predict", data=data,
                                   files={"image": (filename, image, content_type)})


def _detail(r: httpx.Response) -> str:
    try:
        body = r.json()
        d = body.get("detail", body) if isinstance(body, dict) else body
        return d if isinstance(d, str) else str(d)
    except ValueError:
        return (r.text or r.reason_phrase)[:300]


def get_backend() -> BackendClient:
    return BackendClient(get_settings())
