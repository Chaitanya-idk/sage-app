from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"  # middleware/.env, regardless of the working directory


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    backend_url: str = "http://localhost:8000"
    backend_api_key: str = ""
    backend_timeout_s: float = 120.0

    chroma_path: str = "./chroma_db"
    chroma_collection: str = "sage_crop_knowledge"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    rag_top_k: int = 6
    rag_min_score: float = 0.35

    llm_provider: str = "anthropic"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5-5"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    gemini_fallback_models: str = "gemini-3.7-flash,gemini-3.5-flash-lite"
    llm_max_tokens: int = 2048

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    log_level: str = "INFO"
    max_image_mb: int = 10

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
