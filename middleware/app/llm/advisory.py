import json
import logging
import re

from pydantic import ValidationError

from app.llm.base import LLMProvider
from app.schemas import Advisory, RetrievedChunk

log = logging.getLogger("sage.advisory")
MAX_CHUNK_CHARS = 1200  # keeps the prompt small and the LLM fast

ADVISORY_SYSTEM = """You are SAGE, an agronomy advisor. You write a treatment advisory for a farmer.
Rules:
- Use ONLY the structured diagnosis, farm context, and knowledge chunks provided. Do not use outside knowledge.
- Cite every recommendation's source chunk by its id in "citations".
- NEVER state a dosage, rate, concentration, or interval that does not appear verbatim in a chunk.
  If none is given, say to confirm the dosage with a local agricultural extension officer.
- If the chunks do not cover something, leave that list empty rather than guessing.
- You only recommend. Never claim to take any action.
Style: plain, confident language a farmer can act on. In every text field, never mention "sources", "chunks",
"context", "knowledge base", or what information is missing; put chunk ids ONLY in "citations", never inside text.
Each list item is one short, actionable sentence.
Return ONLY a JSON object (no markdown, no prose) with exactly this shape:
{"summary": str, "severity": "low"|"medium"|"high"|"unknown",
 "treatments": {"chemical": [str], "organic": [str], "cultural": [str]},
 "prevention": [str], "optimal_conditions": str,
 "citations": [{"chunk_id": str, "source": str}],
 "confidence": "low"|"medium"|"high", "needs_expert": bool, "expert_reason": str}"""

CHAT_SYSTEM = """You are SAGE's AI Agronomist, talking with a farmer about one crop diagnosis.

Style:
- Warm, direct and practical. Open with the answer in one or two sentences, then up to 5 short bullet points if helpful.
- Use **bold** for the key action. Keep it under about 150 words unless the farmer asks for detail.
- Never talk about "sources", "chunks", "context", "the knowledge base", or what was or wasn't provided. Just answer.

Grounding:
- Base specific facts (symptoms, pathogens, products, timings) on the CONTEXT and put the supporting chunk id in
  square brackets right after that sentence, e.g. [chunk_id].
- When the CONTEXT only partly answers, combine what it says with widely accepted, non-quantitative good practice
  (scouting, sanitation, spacing, irrigation timing, removing infected material) and give a useful answer.
- Never invent dosages, rates, concentrations or spray intervals. For those, pesticide handling, or severe or
  uncertain cases, add one brief closing line suggesting a local agricultural extension officer.
- You only advise; never claim to have taken, scheduled or ordered any action.

CONTEXT:
{context}"""


def format_chunks(chunks: list[RetrievedChunk]) -> str:
    if not chunks:
        return "(no knowledge chunks retrieved)"
    return "\n\n".join(f"[{c.id}] source: {c.source} (relevance {c.score:.2f})\n{c.text[:MAX_CHUNK_CHARS]}" for c in chunks)


def build_context(prediction: dict, farm: dict, chunks: list[RetrievedChunk], advisory: dict | None = None) -> str:
    p = prediction.get("prediction") or {}
    diag = {k: p.get(k) for k in ("class_name", "crop", "disease_type", "plant_organ", "visual_symptoms",
                                   "pathogen", "matched_taxonomy_class", "is_canonical_match")}
    diag["crop"] = diag["crop"] or prediction.get("crop")
    parts = [f"DIAGNOSIS:\n{json.dumps(diag, indent=1)}",
             f"FARM CONTEXT:\n{json.dumps(farm or {}, indent=1)}"]
    if advisory:
        parts.append(f"ADVISORY ALREADY GIVEN:\n{json.dumps(advisory, indent=1)}")
    parts.append(f"KNOWLEDGE CHUNKS:\n{format_chunks(chunks)}")
    return "\n\n".join(parts)


def _extract_json(text: str) -> dict:
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    start, end = text.find("{"), text.rfind("}")
    return json.loads(text[start:end + 1] if start >= 0 else text)


async def synthesize_advisory(llm: LLMProvider, prediction: dict, farm: dict, chunks: list[RetrievedChunk]) -> Advisory:
    messages = [{"role": "user", "content": build_context(prediction, farm, chunks) + "\n\nWrite the advisory JSON."}]
    last_err = ""
    for attempt in range(2):
        raw = await llm.complete(ADVISORY_SYSTEM, messages, json_mode=True)
        try:
            adv = Advisory.model_validate(_extract_json(raw))
            break
        except (ValueError, ValidationError) as e:
            last_err = str(e)[:500]
            log.warning("advisory JSON invalid (attempt %d): %s", attempt + 1, last_err)
            messages += [{"role": "assistant", "content": raw},
                         {"role": "user", "content": f"That was not valid JSON for the schema: {last_err}\nReturn ONLY the corrected JSON object."}]
    else:
        raise ValueError(f"LLM returned invalid advisory JSON twice: {last_err}")

    # Keep only citations that point at chunks we actually retrieved; fill in their sources.
    by_id = {c.id: c for c in chunks}
    adv.citations = [c.model_copy(update={"source": by_id[c.chunk_id].source})
                     for c in adv.citations if c.chunk_id in by_id]
    return adv
