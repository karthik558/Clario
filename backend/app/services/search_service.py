import time
import json
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session

from app.models.entities import Document, DocumentChunk, SearchQuery
from app.search.bm25_engine import BM25SearchEngine
from app.search.vector_engine import VectorSearchEngine
from app.search.hybrid_engine import HybridSearchEngine
from app.search.benchmark import IREvaluationBenchmark
from app.schemas.dtos import BenchmarkSummaryResponse

class SearchService:
    def __init__(self):
        self.bm25_engine = BM25SearchEngine()
        self.vector_engine = VectorSearchEngine()
        self.hybrid_engine = HybridSearchEngine(self.bm25_engine, self.vector_engine)
        self.benchmark_engine = IREvaluationBenchmark(self.hybrid_engine)
        self._last_chunk_count = -1

    def reload_index(self, db: Session):
        """
        Reloads chunks from the database into the memory search indices.
        """
        chunks = (
            db.query(DocumentChunk, Document.title)
            .join(Document, DocumentChunk.document_id == Document.id)
            .filter(Document.status == "READY")
            .all()
        )

        chunk_dicts = []
        for chunk, doc_title in chunks:
            chunk_dicts.append({
                "id": chunk.id,
                "document_id": chunk.document_id,
                "document_title": doc_title,
                "page_number": chunk.page_number,
                "content": chunk.content,
                "embedding": chunk.embedding_json,
            })

        self.bm25_engine.index_chunks(chunk_dicts)
        self.vector_engine.index_chunks(chunk_dicts)
        self._last_chunk_count = len(chunk_dicts)

    def ensure_index(self, db: Session):
        current_count = db.query(DocumentChunk).count()
        if current_count != self._last_chunk_count:
            self.reload_index(db)

    def search(
        self,
        query: str,
        mode: str,
        top_k: int,
        document_ids: Optional[List[str]],
        db: Session
    ) -> Tuple[List[Dict[str, Any]], float]:
        self.ensure_index(db)
        
        t0 = time.perf_counter()
        mode_lower = mode.lower()
        if mode_lower == "bm25":
            results = self.bm25_engine.search(query, top_k=top_k, document_ids=document_ids)
        elif mode_lower == "vector":
            results = self.vector_engine.search(query, top_k=top_k, document_ids=document_ids)
        else: # default hybrid
            results, _ = self.hybrid_engine.search(query, top_k=top_k, document_ids=document_ids)
        
        latency_ms = round((time.perf_counter() - t0) * 1000, 2)

        # Log query to database
        try:
            sq = SearchQuery(
                query_text=query,
                mode=mode_lower,
                top_k=top_k,
                latency_ms=latency_ms,
                result_count=len(results),
                results_json=json.dumps([{
                    "chunk_id": r["chunk_id"],
                    "document_id": r["document_id"],
                    "score": r["score"]
                } for r in results])
            )
            db.add(sq)
            db.commit()
        except Exception:
            db.rollback()

        return results, latency_ms

    def compare_methods(self, query: str, top_k: int, db: Session) -> Dict[str, Any]:
        self.ensure_index(db)
        _, stats = self.hybrid_engine.search(query, top_k=top_k)
        return stats

    def run_benchmark(self, custom_queries: Optional[List[Dict[str, Any]]], db: Session) -> BenchmarkSummaryResponse:
        self.ensure_index(db)

        # Built-in academic test suite if no custom queries provided
        suite = custom_queries if custom_queries else [
            {
                "id": "q1",
                "query": "data retention termination deletion days",
                "target_keywords": ["retention", "days", "termination"],
                "target_doc_titles": ["Data Retention", "Retention Policy"]
            },
            {
                "id": "q2",
                "query": "limitation of liability cap monetary damages",
                "target_keywords": ["liability", "capped", "damages"],
                "target_doc_titles": ["Service Agreement", "Terms of Service"]
            },
            {
                "id": "q3",
                "query": "differential privacy epsilon synthetic EHR healthcare",
                "target_keywords": ["differential privacy", "synthetic", "healthcare", "epsilon"],
                "target_doc_titles": ["Synthetic Data", "EHR Privacy"]
            },
            {
                "id": "q4",
                "query": "employee personal data processing GDPR obligations",
                "target_keywords": ["employee", "privacy", "gdpr", "processing"],
                "target_doc_titles": ["Privacy", "Compliance"]
            },
            {
                "id": "q5",
                "query": "conflicting notice period breach indemnification",
                "target_keywords": ["notice", "breach", "indemnification"],
                "target_doc_titles": ["Agreement", "Contract"]
            }
        ]

        return self.benchmark_engine.evaluate_test_suite(suite)

search_service = SearchService()
