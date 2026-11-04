from typing import Optional

from app.config import get_settings
from app.errors import APIError
from app.llm.base import LLMProvider

_llm: Optional[LLMProvider] = None


def describe_llm() -> dict:
    s = get_settings()
    p = s.llm_provider.lower()
    model = s.anthropic_model if p == "anthropic" else s.gemini_model
    key = s.anthropic_api_key if p == "anthropic" else s.gemini_api_key
    return {"provider": p, "model": model, "configured": bool(key.strip())}


def get_llm() -> LLMProvider:
    global _llm
    if _llm is None:
        s = get_settings()
        p = s.llm_provider.lower()
        if p == "anthropic":
            if not s.anthropic_api_key:
                raise APIError(500, "llm_not_configured", "ANTHROPIC_API_KEY is not set in middleware/.env")
            from app.llm.anthropic import AnthropicProvider
            _llm = AnthropicProvider(s.anthropic_api_key, s.anthropic_model, s.llm_max_tokens)
        elif p == "gemini":
            if not s.gemini_api_key:
                raise APIError(500, "llm_not_configured", "GEMINI_API_KEY is not set in middleware/.env")
            from app.llm.gemini import GeminiProvider
            _llm = GeminiProvider(s.gemini_api_key, s.gemini_model, s.llm_max_tokens,
                                 [m.strip() for m in s.gemini_fallback_models.split(",")],
                                 s.llm_timeout_s, s.gemini_thinking_level)
        else:
            raise APIError(500, "llm_not_configured", f"Unknown LLM_PROVIDER '{s.llm_provider}' (use anthropic or gemini)")
    return _llm
