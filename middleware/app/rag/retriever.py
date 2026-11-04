import logging
import threading
from typing import Any, Optional

from app.config import Settings, get_settings
from app.schemas import RetrievedChunk

log = logging.getLogger("sage.rag")


class Retriever:
    """ChromaDB retriever. Opens the store lazily; EMBEDDING_MODEL must match the one used to build it."""

    def __init__(self, settings: Settings):
        self.s = settings
        self._collection = None
        self._lock = threading.Lock()

    def _get_collection(self):
        if self._collection is None:
            with self._lock:
                if self._collection is None:
                    import chromadb
                    from sentence_transformers import SentenceTransformer

                    # Newer Chroma stores an embedding-function config in the collection and rejects a different
                    # one, so open it without one and pass query vectors computed with EMBEDDING_MODEL ourselves.
                    self._encoder = SentenceTransformer(self.s.embedding_model)
                    client = chromadb.PersistentClient(path=self.s.chroma_path)
                    self._collection = client.get_collection(self.s.chroma_collection, embedding_function=None)
                    log.info("chroma collection '%s' loaded", self.s.chroma_collection)
        return self._collection

    def _embed(self, text: str) -> list[list[float]]:
        return self._encoder.encode([text], normalize_embeddings=True).tolist()

    def status(self) -> dict[str, Any]:
        return {"collection": self.s.chroma_collection, "doc_count": self._get_collection().count(),
                "embedding_model": self.s.embedding_model}

    def query(self, text: str, crop: Optional[str] = None, k: Optional[int] = None) -> list[RetrievedChunk]:
        col = self._get_collection()
        k = k or self.s.rag_top_k
        vec = self._embed(text)
        res = col.query(query_embeddings=vec, n_results=k, where={"crop_clean": crop.lower()} if crop else None)
        if crop and not res["ids"][0]:
            res = col.query(query_embeddings=vec, n_results=k)  # crop filter matched nothing: search everything
        return [
            RetrievedChunk(id=str(cid), text=doc or "", source=_source(meta or {}),
                           score=round(1.0 - float(dist), 4), metadata=meta or {})
            for cid, doc, meta, dist in zip(res["ids"][0], res["documents"][0], res["metadatas"][0], res["distances"][0])
        ]


    def taxonomy(self, crop: str, disease: str) -> dict[str, str]:
        """Look up disease_type / pathogen / plant_organ for (crop, disease) from chunk metadata. No embedding needed."""
        col = self._get_collection()
        d = disease.strip().lower()
        for variant in dict.fromkeys([d, d.replace(" ", "_"), d.replace("_", " ")]):
            res = col.get(where={"$and": [{"crop_clean": crop.lower()}, {"disease_clean": variant}, {"disease_type": {"$ne": ""}}]},
                          limit=25, include=["metadatas"])
            out: dict[str, str] = {}
            for m in res.get("metadatas") or []:
                for k in ("disease_type", "pathogen", "plant_organ"):
                    if m and m.get(k) and k not in out:
                        out[k] = str(m[k])
            if out:
                return out
        return {}


def _source(meta: dict) -> str:
    label = " — ".join(str(meta[k]) for k in ("crop", "disease") if meta.get(k)) or "knowledge base"
    if meta.get("source_row") is not None:
        label += f" (row {meta['source_row']})"
    return label


def build_query(pred: dict, extra: str = "") -> str:
    p = pred.get("prediction") or {}
    bits = [extra, pred.get("crop"), p.get("class_name"), p.get("pathogen"), p.get("visual_symptoms")]
    return " ".join(str(b) for b in bits if b)


def is_healthy(pred: dict) -> bool:
    return "healthy" in ((pred.get("prediction") or {}).get("class_name") or "").lower()


_retriever: Optional[Retriever] = None


def get_retriever() -> Retriever:
    global _retriever
    if _retriever is None:
        _retriever = Retriever(get_settings())
    return _retriever
