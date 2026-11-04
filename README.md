# SAGE — Smart Agricultural Generative Expert

Visual plant disease diagnosis and agronomy advisory for **corn, rice, soybean, tomato and wheat**.

```
frontend (React, :5173) ──► middleware (FastAPI, :8001) ──┬─► SAGE backend (Kaggle GPU, Cloudflare tunnel)
                                                          ├─► ChromaDB (middleware/chroma_db)
                                                          └─► LLM (Anthropic or Gemini)
```

The frontend talks **only** to the middleware. All secrets live in `middleware/.env`.

## Prerequisites

- Python 3.10+
- Node.js 18+
- The ChromaDB folder at `middleware/chroma_db/` (≈1.7 GB, not in git — copy it from Drive)
- A running SAGE backend notebook on Kaggle with its trycloudflare.com URL

## 0. Inference backend (cloud GPU)

`backend/sage_inference_server.ipynb` loads Qwen2.5-VL-3B once and attaches each crop's LoRA adapter from
`IDK-Chaitanya/SAGE5Class-cp` **on demand**, using the paths in `backend/modelpath.txt`. The first request for a crop
downloads and attaches its adapter; after that, switching crops is instant.

1. On Kaggle, create a notebook → **File → Import notebook** → `backend/sage_inference_server.ipynb`.
2. Settings: Accelerator **GPU T4 x2**, Internet **On**. Optionally add the Kaggle model *Qwen2.5-VL 3B-Instruct* (Transformers) so the base weights don't download.
3. **Add-ons → Secrets**: add `HF_TOKEN` (and optionally `SAGE_API_KEY`), attached to this notebook.
4. **Run All**. The last cells print `BACKEND_URL=https://….trycloudflare.com`.

The notebook also runs on Colab (secrets via the 🔑 panel); there the base model downloads from the Hub.

## 1. Middleware

```powershell
cd middleware
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env            # macOS/Linux: cp .env.example .env
# edit .env: BACKEND_URL, BACKEND_API_KEY, ANTHROPIC_API_KEY (or GEMINI_API_KEY)
uvicorn app.main:app --reload --port 8001
```

API docs: http://localhost:8001/docs  ·  Status: http://localhost:8001/api/health

The first diagnosis downloads the `all-MiniLM-L6-v2` embedding model (~90 MB) and opens the ChromaDB store, so it takes longer.

Run the tests (backend, ChromaDB and LLM are mocked):

```powershell
pytest
```

## 2. Frontend

```powershell
cd frontend
npm install
copy .env.example .env            # optional; defaults to http://localhost:8001
npm run dev
```

Open http://localhost:5173.

## Environment variables (`middleware/.env`)

| Variable | Purpose | Default |
|---|---|---|
| `BACKEND_URL` | Kaggle Cloudflare tunnel URL (changes every session) | — |
| `BACKEND_API_KEY` | Backend `SAGE_API_KEY`, sent as `Authorization: Bearer …` | empty |
| `BACKEND_TIMEOUT_S` | Timeout for backend calls, in seconds | `120` |
| `CHROMA_PATH` | ChromaDB folder | `./chroma_db` |
| `CHROMA_COLLECTION` | Collection name | `sage_crop_knowledge` |
| `EMBEDDING_MODEL` | **Must match the model used to build the store** | `sentence-transformers/all-MiniLM-L6-v2` |
| `RAG_TOP_K` | Chunks retrieved per query | `6` |
| `RAG_MIN_SCORE` | Cosine-similarity threshold; below it, `needs_expert` is set | `0.35` |
| `LLM_PROVIDER` | `anthropic` or `gemini` | `anthropic` |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Anthropic credentials and model | `claude-sonnet-5-5` |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Gemini credentials and model | `gemini-2.5-flash` |
| `LLM_MAX_TOKENS` | Max output tokens | `2048` |
| `CORS_ORIGINS` | Comma-separated allowed origins | Vite dev origins |
| `MAX_IMAGE_MB` | Upload size limit | `10` |

Frontend (`frontend/.env`): `VITE_MIDDLEWARE_URL` (default `http://localhost:8001`).

## Updating `BACKEND_URL` each Kaggle session

1. Start the Kaggle notebook and copy the new `https://….trycloudflare.com` URL from its output.
2. Set `BACKEND_URL=` to that URL in `middleware/.env`.
3. Restart the middleware (`Ctrl+C`, then run `uvicorn` again). Settings are read at startup.
4. Within 30 s the header's **Backend** badge turns green.

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Status of middleware, backend tunnel, ChromaDB and LLM (never fails when the backend is down) |
| GET | `/api/crops` | Proxy of `/api/v1/crops`, cached for 5 minutes |
| GET | `/api/model/status` | Proxy of `/api/v1/model/status` |
| POST | `/api/diagnose` | Multipart request: prediction → RAG → LLM advisory. Returns `partial_failure` if RAG or the LLM fails |
| POST | `/api/chat` | Follow-up questions, streamed as Server-Sent Events (`chunks`, `delta`, `done`, `error`) |
