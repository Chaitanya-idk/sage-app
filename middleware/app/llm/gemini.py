from typing import AsyncIterator

from app.llm.base import LLMProvider


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, api_key: str, model: str, max_tokens: int):
        from google import genai

        self.client = genai.Client(api_key=api_key)
        self.model, self.max_tokens = model, max_tokens

    def _cfg(self, system: str, json_mode: bool):
        from google.genai import types

        return types.GenerateContentConfig(system_instruction=system, max_output_tokens=self.max_tokens,
                                           response_mime_type="application/json" if json_mode else None)

    @staticmethod
    def _contents(messages: list[dict]) -> list[dict]:
        return [{"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
                for m in messages]

    async def complete(self, system: str, messages: list[dict], json_mode: bool = False) -> str:
        r = await self.client.aio.models.generate_content(model=self.model, contents=self._contents(messages),
                                                          config=self._cfg(system, json_mode))
        return r.text or ""

    async def stream(self, system: str, messages: list[dict]) -> AsyncIterator[str]:
        it = await self.client.aio.models.generate_content_stream(model=self.model, contents=self._contents(messages),
                                                                  config=self._cfg(system, False))
        async for chunk in it:
            if chunk.text:
                yield chunk.text
