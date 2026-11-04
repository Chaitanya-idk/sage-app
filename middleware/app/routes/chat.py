import asyncio
import json
import logging

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.llm import LLMProvider, get_llm
from app.llm.advisory import CHAT_SYSTEM, build_context
from app.rag.retriever import Retriever, build_query, get_retriever
from app.schemas import ChatRequest

router = APIRouter(prefix="/api")
log = logging.getLogger("sage.chat")


def _sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/chat")
async def chat(req: ChatRequest, retriever: Retriever = Depends(get_retriever), llm: LLMProvider = Depends(get_llm)):
    ctx = req.diagnosis_context
    question = next((m.content for m in reversed(req.messages) if m.role == "user"), "")

    async def events():
        chunks = list(ctx.retrieval.chunks) if ctx.retrieval else []
        try:
            fresh = await asyncio.to_thread(retriever.query, build_query(ctx.prediction, question),
                                            ctx.prediction.get("crop"))
            seen = {c.id for c in chunks}
            chunks += [c for c in fresh if c.id not in seen]
        except Exception as e:  # noqa: BLE001 — answer from existing chunks
            log.warning("chat re-retrieval failed: %s", e)
        yield _sse("chunks", [c.model_dump(exclude={"metadata"}) for c in chunks])

        system = CHAT_SYSTEM.format(context=build_context(
            ctx.prediction, ctx.farm_context, chunks, ctx.advisory.model_dump() if ctx.advisory else None))
        try:
            async for delta in llm.stream(system, [m.model_dump() for m in req.messages[-12:]]):
                yield _sse("delta", {"text": delta})
            yield _sse("done", {})
        except Exception as e:  # noqa: BLE001
            log.exception("chat stream failed")
            yield _sse("error", {"detail": f"The AI agronomist failed to respond: {str(e)[:200]}"})

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
