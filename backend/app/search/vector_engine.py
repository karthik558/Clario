import math
import hashlib
import json
from typing import List, Dict, Any, Tuple
import numpy as np

def cosine_similarity(v1: np.ndarray, v2: np.ndarray) -> float:
    dot = np.dot(v1, v2)
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(dot / (norm1 * norm2))

class FastSemanticEmbeddingProvider:
    """
    Deterministic subword and n-gram semantic vectorizer (dim=384).
    Generates dense embeddings with normalized L2 length.
    Ensures zero external network dependencies and instant local computation.
    """
    def __init__(self, dim: int = 384):
        self.dim = dim

    def encode(self, text: str) -> List[float]:
        tokens = text.lower().split()
        if not tokens:
            return [0.0] * self.dim

        vec = np.zeros(self.dim, dtype=np.float32)

        # Word unigrams and character trigrams
        for word in tokens:
            clean_word = "".join(c for c in word if c.isalnum())
            if not clean_word:
                continue
            
            # Hash word
            h = int(hashlib.md5(clean_word.encode("utf-8")).hexdigest(), 16)
            idx1 = h % self.dim
            idx2 = (h >> 16) % self.dim
            vec[idx1] += 1.0
            vec[idx2] += 0.5

            # Char trigrams for subword morphology
            padded = f"<{clean_word}>"
            for i in range(len(padded) - 2):
                ngram = padded[i:i+3]
                nh = int(hashlib.sha256(ngram.encode("utf-8")).hexdigest(), 16)
                nidx = nh % self.dim
                vec[nidx] += 0.25

        # Normalize to unit length
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()

    def encode_batch(self, texts: List[str]) -> List[List[float]]:
        return [self.encode(t) for t in texts]


class VectorSearchEngine:
    def __init__(self):
        self.provider = FastSemanticEmbeddingProvider(dim=384)
        self.chunks: List[Dict[str, Any]] = []
        self.chunk_vectors: List[np.ndarray] = []

    def set_provider(self, provider):
        self.provider = provider

    def embed_text(self, text: str) -> List[float]:
        return self.provider.encode(text)

    def index_chunks(self, chunks: List[Dict[str, Any]]):
        self.chunks = chunks
        self.chunk_vectors = []
        for c in chunks:
            raw_emb = c.get("embedding")
            if isinstance(raw_emb, str):
                try:
                    vec = np.array(json.loads(raw_emb), dtype=np.float32)
                except Exception:
                    vec = np.array(self.embed_text(c["content"]), dtype=np.float32)
            elif isinstance(raw_emb, list):
                vec = np.array(raw_emb, dtype=np.float32)
            else:
                vec = np.array(self.embed_text(c["content"]), dtype=np.float32)
            self.chunk_vectors.append(vec)

    def search(self, query: str, top_k: int = 5, document_ids: List[str] = None) -> List[Dict[str, Any]]:
        top_k = top_k or 5
        if not self.chunks or not self.chunk_vectors:
            return []

        q_vec = np.array(self.embed_text(query), dtype=np.float32)
        q_norm = np.linalg.norm(q_vec)
        if q_norm == 0:
            return []

        scored_results: List[Tuple[float, Dict[str, Any]]] = []
        limit = min(len(self.chunk_vectors), len(self.chunks))
        for i in range(limit):
            doc_vec = self.chunk_vectors[i]
            chunk = self.chunks[i]
            if document_ids and chunk.get("document_id") not in document_ids:
                continue
            if doc_vec.shape != q_vec.shape:
                continue

            sim = cosine_similarity(q_vec, doc_vec)
            if sim > 0.05:
                scored_results.append((sim, chunk))

        scored_results.sort(key=lambda x: x[0], reverse=True)
        top_slice = scored_results[:top_k]

        results = []
        for rank, (score, chunk) in enumerate(top_slice, start=1):
            results.append({
                "chunk_id": chunk["id"],
                "document_id": chunk["document_id"],
                "document_title": chunk.get("document_title") or "Document",
                "page_number": int(chunk.get("page_number") or 1),
                "snippet": chunk["content"],
                "raw_score": round(score, 4),
                "score": round(score, 4),
                "rank": rank,
                "method": "vector"
            })
        return results
