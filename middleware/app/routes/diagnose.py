import asyncio
import logging
import time
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.clients.backend import BackendClient, get_backend
from app.config import get_settings
from app.errors import APIError
from app.llm import LLMProvider, get_llm
from app.llm.advisory import synthesize_advisory
from app.rag.retriever import Retriever, build_query, get_retriever, is_healthy
from app.schemas import DiagnoseResponse, PartialFailure, Retrieval, Timings

router = APIRouter(prefix="/api")
log = logging.getLogger("sage.diagnose")

ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}


def _llm_or_none() -> Optional[LLMProvider]:
    try:
        return get_llm()
    except APIError as e:
        log.warning("LLM unavailable: %s", e.message)
        return None


@router.post("/diagnose", response_model=DiagnoseResponse)
async def diagnose(
    crop: str = Form(...),
    image: UploadFile = File(...),
    prompt: Optional[str] = Form(None),
    max_new_tokens: Optional[int] = Form(None),
    temperature: Optional[float] = Form(None),
    growth_stage: Optional[str] = Form(None),
    soil_hydration: Optional[str] = Form(None),
    recent_weather: Optional[str] = Form(None),
    past_treatments: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    backend: BackendClient = Depends(get_backend),
    retriever: Retriever = Depends(get_retriever),
    llm: Optional[LLMProvider] = Depends(_llm_or_none),
):
    s = get_settings()
    t0 = time.perf_counter()

    # a. validate before forwarding
    ctype = (image.content_type or "").lower()
    if ctype not in ALLOWED_TYPES:
        raise APIError(415, "unsupported_media", f"Unsupported image type '{ctype or 'unknown'}'. Use JPEG, PNG or WebP.")
    data = await image.read()
    if not data:
        raise APIError(400, "empty_image", "The uploaded image is empty.")
    if len(data) > s.max_image_mb * 1024 * 1024:
        raise APIError(413, "image_too_large", f"Image is {len(data) / 1048576:.1f} MB; the limit is {s.max_image_mb} MB.")

    # b. inference
    prediction = await backend.predict(crop.lower(), data, image.filename or "upload.jpg", ctype,
                                       prompt, max_new_tokens, temperature)
    t1 = time.perf_counter()

    farm = {k: v for k, v in {"growth_stage": growth_stage, "soil_hydration": soil_hydration,
                              "recent_weather": recent_weather, "past_treatments": past_treatments,
                              "notes": notes}.items() if v}
    failure = PartialFailure()

    # b2. the fine-tuned model returns only a class name: fill taxonomy fields from the knowledge base
    p = prediction.setdefault("prediction", {})
    if p.get("class_name") and p.get("is_canonical_match") is not False and not is_healthy(prediction):
        try:
            tax = await asyncio.to_thread(retriever.taxonomy, prediction.get("crop") or crop, p["class_name"])
            filled = []
            for k, v in tax.items():
                if not p.get(k):
                    p[k] = v
                    filled.append(k)
            if filled:
                p.setdefault("attributes", {})["enriched_from_knowledge_base"] = filled
        except Exception as e:  # noqa: BLE001 — enrichment is best-effort
            log.warning("taxonomy enrichment failed: %s", e)

    # c. retrieval
    retrieval = Retrieval(query=build_query(prediction))
    if is_healthy(prediction):
        retrieval.skipped_reason = "Plant classified as healthy; no disease knowledge retrieved."
    else:
        try:
            retrieval.chunks = await asyncio.to_thread(retriever.query, retrieval.query, prediction.get("crop") or crop)
        except Exception as e:  # noqa: BLE001
            log.exception("retrieval failed")
            failure.retrieval = f"Knowledge retrieval failed: {str(e)[:200]}"
    t2 = time.perf_counter()

    # d. LLM synthesis
    advisory = None
    if llm is None:
        failure.llm = "LLM is not configured (set LLM_PROVIDER and its API key in middleware/.env)."
    elif failure.retrieval is None:
        try:
            advisory = await synthesize_advisory(llm, prediction, farm, retrieval.chunks)
        except Exception as e:  # noqa: BLE001
            log.exception("advisory synthesis failed")
            failure.llm = f"Advisory generation failed: {str(e)[:200]}"
    else:
        failure.llm = "Skipped because knowledge retrieval failed."
    t3 = time.perf_counter()

    if advisory:
        reasons = []
        if (prediction.get("prediction") or {}).get("is_canonical_match") is False:
            reasons.append("the diagnosis did not match a known disease class")
        relevant = [c for c in retrieval.chunks if c.score >= s.rag_min_score]
        if not is_healthy(prediction) and not relevant:
            reasons.append("no sufficiently relevant knowledge was found")
        if advisory.severity == "high":
            reasons.append("severity is high")
        if reasons:
            advisory.needs_expert = True
            joined = "; ".join(reasons)
            advisory.expert_reason = f"{advisory.expert_reason}; {joined}".strip("; ") if advisory.expert_reason else joined.capitalize()

    return DiagnoseResponse(
        prediction=prediction, retrieval=retrieval, advisory=advisory, farm_context=farm,
        timings=Timings(inference_s=round(t1 - t0, 2), retrieval_s=round(t2 - t1, 2),
                        llm_s=round(t3 - t2, 2), total_s=round(t3 - t0, 2)),
        partial_failure=failure if (failure.retrieval or failure.llm) else None,
    )
