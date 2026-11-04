from typing import AsyncIterator

from app.llm.base import LLMProvider


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, api_key: str, model: str, max_tokens: int, fallbacks: list[str] | None = None):
        from google import genai
        from google.genai import types

        # Cap each request (ms) so an overloaded model fails fast and the fallback list is tried.
        self.client = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=30_000))
        self.model, self.max_tokens = model, max_tokens
        self.models = [model] + [m for m in (fallbacks or []) if m and m != model]

    def _cfg(self, system: str, json_mode: bool):
        from google.genai import types

        return types.GenerateContentConfig(system_instruction=system, max_output_tokens=self.max_tokens,
                                           response_mime_type="application/json" if json_mode else None)

    @staticmethod
    def _contents(messages: list[dict]) -> list[dict]:
        return [{"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
                for m in messages]

    async def _retry(self, call):
        """Retry overload / rate-limit errors (429, 500, 503) with backoff, then fall back to the next model."""
        import asyncio
        import logging

        from google.genai import errors

        last = None
        for model in self.models:
            for attempt in range(2):
                try:
                    return await call(model)
                except errors.APIError as e:
                    if getattr(e, "code", None) not in (429, 500, 503):
                        raise
                    last = e
                    logging.getLogger("sage.llm").warning("gemini %s busy (%s), attempt %d", model, e.code, attempt + 1)
                    await asyncio.sleep(1.5 * (attempt + 1))
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
