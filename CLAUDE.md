# CLAUDE.md

## Structure
- `middleware/` — FastAPI on :8001. The only thing the frontend talks to.
  - `app/config.py`: pydantic-settings, reads `middleware/.env`
  - `app/clients/backend.py`: httpx client for the Kaggle backend; maps transport and HTTP errors to `APIError`
  - `app/rag/retriever.py`: ChromaDB `PersistentClient`, lazy-loaded, filters on the `crop_clean` metadata
  - `app/llm/`: `base.py` interface, `anthropic.py`, `gemini.py`, `factory.py` (`LLM_PROVIDER`), `advisory.py` (prompts and JSON synthesis with one retry)
  - `app/routes/`: `system.py` (health, crops, model status), `diagnose.py`, `chat.py` (SSE)
  - `tests/`: pytest; mocks are injected with `app.dependency_overrides`
- `frontend/` — Vite + React 18 + TypeScript + Tailwind v4 + lucide-react
  - `src/types/sage.ts`: every API type. Keep it in sync with `middleware/app/schemas.py` and the backend
  - `src/services/api.ts`: the only module that calls `fetch`; turns HTTP status codes into user-facing messages
  - `src/components/`: one component per UI area; theme tokens (moss/soil/wheat/clay) and animations live in `src/index.css`
- Backend source is in `../Sage-backend`. Read it; never modify it.

## Conventions
- Middleware errors are JSON `{"error": code, "detail": message}`, raised through `APIError`.
- The backend authenticates with `Authorization: Bearer <SAGE_API_KEY>`, not `X-API-Key`.
- `/api/diagnose` must still return the prediction when RAG or the LLM fails; it sets `partial_failure` instead.
- The LLM must never invent dosages, must cite chunk ids, and only recommends. Citations are filtered to retrieved chunk ids.
- `needs_expert` is enforced server-side: non-canonical match, no chunk ≥ `RAG_MIN_SCORE`, or high severity.
- Secrets go only in `middleware/.env`. The frontend's only env var is `VITE_MIDDLEWARE_URL`.
- `chroma_db/`, model weights and `.env` are gitignored.
- The embedding model must stay `all-MiniLM-L6-v2`, the model the store was built with.

## Commands
- Middleware: `cd middleware && uvicorn app.main:app --reload --port 8001`; tests: `pytest`
- Frontend: `cd frontend && npm install && npm run dev`; type-check and build: `npm run build`
