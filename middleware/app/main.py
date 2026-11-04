import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.errors import APIError, api_error_handler
from app.routes import chat, diagnose, system

settings = get_settings()
logging.basicConfig(level=settings.log_level.upper(),
                    format="%(asctime)s level=%(levelname)s logger=%(name)s msg=%(message)s")
log = logging.getLogger("sage.middleware")

from app.config import ENV_FILE  # noqa: E402

if not ENV_FILE.exists():
    log.warning("%s not found — using defaults. Copy .env.example to .env and fill it in.", ENV_FILE)
log.info("backend_url=%s llm_provider=%s chroma=%s", settings.backend_url, settings.llm_provider, settings.chroma_path)

app = FastAPI(title="SAGE Middleware", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_list, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])
app.add_exception_handler(APIError, api_error_handler)


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    msg = "; ".join(f"{'.'.join(str(p) for p in e['loc'][1:])}: {e['msg']}" for e in exc.errors())
    return JSONResponse(status_code=422, content={"error": "validation_error", "detail": msg})


@app.middleware("http")
async def log_requests(request: Request, call_next):
    import time
    t = time.perf_counter()
    response = await call_next(request)
    log.info("method=%s path=%s status=%s duration_ms=%.0f", request.method, request.url.path,
             response.status_code, (time.perf_counter() - t) * 1000)
    return response


for r in (system.router, diagnose.router, chat.router):
    app.include_router(r)
