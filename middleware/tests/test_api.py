"""API tests with the backend, ChromaDB, and LLM all mocked."""
import json

import pytest
from fastapi.testclient import TestClient

from app.clients.backend import get_backend
from app.errors import APIError
from app.llm import get_llm
from app.main import app
from app.rag.retriever import get_retriever
from app.routes import diagnose as diagnose_route
from app.schemas import RetrievedChunk

PRED = {
    "success": True, "crop": "tomato", "base_model": "Qwen", "active_adapter": "tomato", "checkpoint": "cp",
    "input": {"prompt": "p"}, "raw_output": "Early blight",  "inference_time_seconds": 1.2,
    "image_metadata": {"width": 10, "height": 10, "format": "PNG"},
    "prediction": {"response": "Early blight", "class_name": "Early Blight", "crop": "tomato",
                   "pathogen": "Alternaria solani", "visual_symptoms": "concentric rings",
                   "is_canonical_match": True, "attributes": {}},
}
ADVICE = {"summary": "Early blight.", "severity": "medium",
          "treatments": {"chemical": ["copper fungicide [c1]"], "organic": [], "cultural": ["remove leaves"]},
          "prevention": ["rotate crops"], "optimal_conditions": "dry foliage",
          "citations": [{"chunk_id": "c1", "source": "x"}, {"chunk_id": "bogus", "source": "y"}],
          "confidence": "medium", "needs_expert": False, "expert_reason": ""}


class FakeBackend:
    base = "http://fake"
    down = False

    async def health(self):
        if self.down:
            raise APIError(502, "backend_unreachable", "offline")
        return {"status": "healthy"}

    async def model_status(self):
        if self.down:
            raise APIError(502, "backend_unreachable", "offline")
        return {"active_crop": "tomato", "gpu_status": {"available": True}}

    async def crops(self):
        return {"total_crops": 1, "available_crops": ["tomato"], "crop_details": []}

    async def predict(self, *a, **k):
        if self.down:
            raise APIError(504, "backend_timeout", "timed out")
        return json.loads(json.dumps(PRED))


class FakeRetriever:
    fail = False

    def status(self):
        return {"collection": "c", "doc_count": 3}

    def query(self, text, crop=None, k=None):
        if self.fail:
            raise RuntimeError("chroma broke")
        return [RetrievedChunk(id="c1", text="Use copper.", source="Tomato — Early blight", score=0.8)]


class FakeLLM:
    name, model = "fake", "fake-1"

    def __init__(self, outputs):
        self.outputs = list(outputs)

    async def complete(self, system, messages, json_mode=False):
        return self.outputs.pop(0)

    async def stream(self, system, messages):
        for t in ("Hello ", "farmer"):
            yield t


@pytest.fixture
def ctx():
    b, r, llm = FakeBackend(), FakeRetriever(), FakeLLM([json.dumps(ADVICE)])
    app.dependency_overrides = {get_backend: lambda: b, get_retriever: lambda: r,
                                diagnose_route._llm_or_none: lambda: llm, get_llm: lambda: llm}
    yield TestClient(app), b, r, llm
    app.dependency_overrides = {}


def post(client, ctype="image/png", data=b"\x89PNG fake"):
    return client.post("/api/diagnose", data={"crop": "tomato", "growth_stage": "flowering"},
                       files={"image": ("leaf.png", data, ctype)})


def test_health_ok_and_backend_down(ctx):
    client, b, *_ = ctx
    assert client.get("/api/health").json()["backend"]["status"] == "ok"
    b.down = True
    body = client.get("/api/health").json()
    assert body["backend"]["status"] == "down" and body["middleware"]["status"] == "ok"


def test_crops_proxy(ctx):
    assert ctx[0].get("/api/crops").json()["available_crops"] == ["tomato"]


def test_rejects_bad_type_and_size(ctx):
    client = ctx[0]
    assert post(client, ctype="image/gif").status_code == 415
    assert post(client, data=b"x" * (11 * 1024 * 1024)).status_code == 413


def test_diagnose_full_pipeline(ctx):
    body = post(ctx[0]).json()
    assert body["prediction"]["prediction"]["class_name"] == "Early Blight"
    assert body["retrieval"]["chunks"][0]["id"] == "c1"
    assert [c["chunk_id"] for c in body["advisory"]["citations"]] == ["c1"]  # bogus citation dropped
    assert body["partial_failure"] is None and body["farm_context"]["growth_stage"] == "flowering"


def test_invalid_json_retried_once(ctx):
    _, _, _, llm = ctx
    llm.outputs = ["not json", json.dumps(ADVICE)]
    assert post(ctx[0]).json()["advisory"]["severity"] == "medium"


def test_retrieval_failure_is_partial(ctx):
    ctx[2].fail = True
    body = post(ctx[0]).json()
    assert body["prediction"]["success"] and body["advisory"] is None
    assert "retrieval" in body["partial_failure"]["retrieval"].lower()


def test_needs_expert_when_not_canonical(ctx):
    PRED["prediction"]["is_canonical_match"] = False
    try:
        assert post(ctx[0]).json()["advisory"]["needs_expert"] is True
    finally:
        PRED["prediction"]["is_canonical_match"] = True


def test_backend_timeout_maps_to_504(ctx):
    ctx[1].down = True
    r = post(ctx[0])
    assert r.status_code == 504 and r.json()["error"] == "backend_timeout"


def test_chat_streams_sse(ctx):
    r = ctx[0].post("/api/chat", json={"diagnosis_context": {"prediction": PRED},
                                       "messages": [{"role": "user", "content": "How do I treat it?"}]})
    assert "event: chunks" in r.text and "Hello " in r.text and "event: done" in r.text
