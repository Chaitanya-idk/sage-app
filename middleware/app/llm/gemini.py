from typing import AsyncIterator

from app.llm.base import LLMProvider

COOLDOWN_S = 120  # skip a busy model for this long


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, api_key: str, model: str, max_tokens: int, fallbacks: list[str] | None = None,
                 timeout_s: float = 90, thinking_level: str = "low"):
        from google import genai
        from google.genai import types

        # Per-request cap (ms). Gemini also uses it as the server-side deadline (504 DEADLINE_EXCEEDED when hit),
        # so it must leave room for a full advisory; overloaded/expired calls then move to the fallback models.
        self.client = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=int(timeout_s * 1000)))
        self.thinking_level = thinking_level.strip().lower()
        self._cooldown: dict[str, float] = {}
        self.model, self.max_tokens = model, max_tokens
        self.models = [model] + [m for m in (fallbacks or []) if m and m != model]

    def _cfg(self, system: str, json_mode: bool):
        from google.genai import types

        # Low thinking keeps Gemini 3.x fast for this grounded, extractive task. Empty GEMINI_THINKING_LEVEL = model default.
        thinking = types.ThinkingConfig(thinking_level=self.thinking_level) if self.thinking_level else None
        return types.GenerateContentConfig(system_instruction=system, max_output_tokens=self.max_tokens,
                                           response_mime_type="application/json" if json_mode else None,
                                           thinking_config=thinking)

    @staticmethod
    def _contents(messages: list[dict]) -> list[dict]:
        return [{"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
                for m in messages]

    async def _retry(self, call):
        """Try each model once; a model that is overloaded / rate-limited / past deadline (429, 500, 503, 504)
        is put on a short cooldown so later requests go straight to a model that is answering."""
        import logging
        import time

        from google.genai import errors

        now = time.monotonic()
        ready = [m for m in self.models if self._cooldown.get(m, 0) <= now]
        last = None
        for model in ready or self.models:  # if every model is cooling down, try them all anyway
            try:
                return await call(model)
            except errors.APIError as e:
                if getattr(e, "code", None) not in (429, 500, 503, 504):
                    raise
                last = e
                self._cooldown[model] = time.monotonic() + COOLDOWN_S
                logging.getLogger("sage.llm").warning("gemini %s unavailable (%s); trying next model", model, e.code)
        raise last

    async def complete(self, system: str, messages: list[dict], json_mode: bool = False) -> str:
        r = await self._retry(lambda m: self.client.aio.models.generate_content(
            model=m, contents=self._contents(messages), config=self._cfg(system, json_mode)))
        return r.text or ""

    async def stream(self, system: str, messages: list[dict]) -> AsyncIterator[str]:
        # Gemini reports overload when the first chunk is read, so the retry wraps opening the stream AND its
        # first chunk; once text has been sent to the client we can no longer switch models.
        async def open_stream(model):
            it = await self.client.aio.models.generate_content_stream(
                model=model, contents=self._contents(messages), config=self._cfg(system, False))
            it = aiter(it)
            return it, await anext(it, None)

        it, first = await self._retry(open_stream)
        if first is not None and first.text:
            yield first.text
        async for chunk in it:
            if chunk.text:
                yield chunk.text
