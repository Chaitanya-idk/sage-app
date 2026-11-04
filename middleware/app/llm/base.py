from abc import ABC, abstractmethod
from typing import AsyncIterator


class LLMProvider(ABC):
    """Provider-agnostic LLM interface. messages = [{"role": "user"|"assistant", "content": str}]."""

    name: str = "base"
    model: str = ""

    @abstractmethod
    async def complete(self, system: str, messages: list[dict], json_mode: bool = False) -> str: ...

    @abstractmethod
    def stream(self, system: str, messages: list[dict]) -> AsyncIterator[str]: ...
