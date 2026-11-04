import asyncio
import time

from fastapi import APIRouter, Depends

from app.clients.backend import BackendClient, get_backend
from app.llm import describe_llm
from app.rag.retriever import Retriever, get_retriever

router = APIRouter(prefix="/api")

_CROPS_TTL = 300
_crops_cache: dict = {"at": 0.0, "data": None}


async def _safe(coro):
    try:
        return {"ok": True, "data": await coro}
    except Exception as e:  # noqa: BLE001 — health must never crash
        return {"ok": False, "error": getattr(e, "message", str(e))}


@router.get("/health")
async def health(backend: BackendClient = Depends(get_backend), retriever: Retriever = Depends(get_retriever)):
    h, ms = await asyncio.gather(_safe(backend.health()), _safe(backend.model_status()))
    try:
        chroma = {"status": "ok", **await asyncio.to_thread(retriever.status)}
    except Exception as e:  # noqa: BLE001
        chroma = {"status": "error", "error": str(e)[:300]}
    llm = describe_llm()
    return {
        "middleware": {"status": "ok"},
        "backend": {
            "status": "ok" if h["ok"] else "down",
            "url": backend.base,
            "health": h.get("data"),
            "model_status": ms.get("data"),
            "error": h.get("error") or ms.get("error"),
        },
        "chromadb": chroma,
        "llm": {"status": "ok" if llm["configured"] else "not_configured", **llm},
    }


@router.get("/crops")
async def crops(backend: BackendClient = Depends(get_backend)):
    if _crops_cache["data"] and time.time() - _crops_cache["at"] < _CROPS_TTL:
        return _crops_cache["data"]
    data = await backend.crops()
    _crops_cache.update(at=time.time(), data=data)
    return data


@router.get("/model/status")
async def model_status(backend: BackendClient = Depends(get_backend)):
    return await backend.model_status()
