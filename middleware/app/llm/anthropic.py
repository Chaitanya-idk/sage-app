from typing import AsyncIterator

from app.llm.base import LLMProvider


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self, api_key: str, model: str, max_tokens: int):
        from anthropic import AsyncAnthropic

        self.client = AsyncAnthropic(api_key=api_key)
        self.model, self.max_tokens = model, max_tokens

    async def complete(self, system: str, messages: list[dict], json_mode: bool = False) -> str:
        msg = await self.client.messages.create(model=self.model, max_tokens=self.max_tokens,
                                                system=system, messages=messages)
        return "".join(b.text for b in msg.content if b.type == "text")

    async def stream(self, system: str, messages: list[dict]) -> AsyncIterator[str]:
        async with self.client.messages.stream(model=self.model, max_tokens=self.max_tokens,
                                               system=system, messages=messages) as s:
            async for text in s.text_stream:
                yield text
