import time
from typing import List, Dict, Any, Tuple
from app.search.bm25_engine import BM25SearchEngine
from app.search.vector_engine import VectorSearchEngine

class HybridSearchEngine:
    def __init__(self, bm25_engine: BM25SearchEngine, vector_engine: VectorSearchEngine, rrf_k: int = 60):
        self.bm25_engine = bm25_engine
        self.vector_engine = vector_engine
        self.rrf_k = rrf_k

    def search(
        self,
        query: str,
        top_k: int = 5,
        document_ids: List[str] = None
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Executes BM25 and Vector search, records their latencies, computes RRF fusion,
        and returns both hybrid results and comparative metrics.
        """
        top_k = top_k or 5
        # Run BM25
        t0 = time.perf_counter()
        bm25_results = self.bm25_engine.search(query, top_k=top_k * 2, document_ids=document_ids)
        t_bm25_ms = (time.perf_counter() - t0) * 1000

        # Run Vector
        t1 = time.perf_counter()
        vector_results = self.vector_engine.search(query, top_k=top_k * 2, document_ids=document_ids)
        t_vector_ms = (time.perf_counter() - t1) * 1000

        # Compute Reciprocal Rank Fusion (RRF)
        t2 = time.perf_counter()
        scores: Dict[str, float] = {}
        chunk_map: Dict[str, Dict[str, Any]] = {}

        for item in bm25_results:
            cid = item["chunk_id"]
            rank = item["rank"]
            scores[cid] = scores.get(cid, 0.0) + (1.0 / (self.rrf_k + rank))
            chunk_map[cid] = item

        for item in vector_results:
            cid = item["chunk_id"]
            rank = item["rank"]
            scores[cid] = scores.get(cid, 0.0) + (1.0 / (self.rrf_k + rank))
            if cid not in chunk_map:
                chunk_map[cid] = item

        # Sort by RRF score descending
        sorted_chunks = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        top_slice = sorted_chunks[:top_k]

        max_rrf = top_slice[0][1] if top_slice else 1.0
        hybrid_results = []
        for rank, (cid, score) in enumerate(top_slice, start=1):
            base_item = chunk_map[cid]
            norm_score = round(min(1.0, score / max_rrf) if max_rrf > 0 else 0.0, 4)
            hybrid_results.append({
                "chunk_id": cid,
                "document_id": base_item["document_id"],
                "document_title": base_item["document_title"],
                "page_number": base_item["page_number"],
                "snippet": base_item["snippet"],
                "raw_score": round(score, 6),
                "score": norm_score,
                "rank": rank,
                "method": "hybrid"
            })

        t_hybrid_ms = (time.perf_counter() - t0) * 1000

        # Calculate overlap between BM25 and Vector top_k
        bm25_top_ids = set(x["chunk_id"] for x in bm25_results[:top_k])
        vector_top_ids = set(x["chunk_id"] for x in vector_results[:top_k])
        overlap_count = len(bm25_top_ids.intersection(vector_top_ids))
        union_count = len(bm25_top_ids.union(vector_top_ids))
        jaccard = round(overlap_count / union_count, 4) if union_count > 0 else 0.0

        stats = {
            "query": query,
            "latency_bm25_ms": round(t_bm25_ms, 2),
            "latency_vector_ms": round(t_vector_ms, 2),
            "latency_hybrid_ms": round(t_hybrid_ms, 2),
            "overlap_count": overlap_count,
            "jaccard_similarity": jaccard,
            "bm25_results": bm25_results[:top_k],
            "vector_results": vector_results[:top_k],
            "hybrid_results": hybrid_results
        }

        return hybrid_results, stats
