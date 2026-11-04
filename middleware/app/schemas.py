from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class RetrievedChunk(BaseModel):
    id: str
    text: str
    source: str
    score: float
    metadata: dict[str, Any] = Field(default_factory=dict)


class Retrieval(BaseModel):
    query: str = ""
    chunks: list[RetrievedChunk] = Field(default_factory=list)
    skipped_reason: Optional[str] = None


class Citation(BaseModel):
    chunk_id: str
    source: str = ""


class Treatments(BaseModel):
    chemical: list[str] = Field(default_factory=list)
    organic: list[str] = Field(default_factory=list)
    cultural: list[str] = Field(default_factory=list)


class Advisory(BaseModel):
    summary: str
    severity: Literal["low", "medium", "high", "unknown"] = "unknown"
    treatments: Treatments = Field(default_factory=Treatments)
    prevention: list[str] = Field(default_factory=list)
    optimal_conditions: str = ""
    citations: list[Citation] = Field(default_factory=list)
    confidence: Literal["low", "medium", "high"] = "low"
    needs_expert: bool = False
    expert_reason: str = ""


class Timings(BaseModel):
    inference_s: float = 0.0
    retrieval_s: float = 0.0
    llm_s: float = 0.0
    total_s: float = 0.0


class PartialFailure(BaseModel):
    retrieval: Optional[str] = None
    llm: Optional[str] = None


class DiagnoseResponse(BaseModel):
    prediction: dict[str, Any]
    retrieval: Retrieval
    advisory: Optional[Advisory] = None
    farm_context: dict[str, str] = Field(default_factory=dict)
    timings: Timings
    partial_failure: Optional[PartialFailure] = None


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class DiagnosisContext(BaseModel):
    prediction: dict[str, Any]
    retrieval: Optional[Retrieval] = None
    advisory: Optional[Advisory] = None
    farm_context: dict[str, str] = Field(default_factory=dict)


class ChatRequest(BaseModel):
    diagnosis_context: DiagnosisContext
    messages: list[ChatMessage] = Field(min_length=1)
