import math
from typing import List, Dict, Any, Set
from app.schemas.dtos import IRMetricScore, BenchmarkResultItem, BenchmarkSummaryResponse

def calculate_metrics(retrieved_doc_ids: List[str], ground_truth_ids: Set[str], k_values: List[int] = [3, 5]) -> IRMetricScore:
    """
    Computes rigorous IR evaluation metrics:
    - Precision@3, Precision@5
    - Recall@5
    - MRR (Mean Reciprocal Rank)
    - nDCG@5 (Normalized Discounted Cumulative Gain)
    """
    retrieved_doc_ids = list(dict.fromkeys(retrieved_doc_ids))
    if not ground_truth_ids:
        return IRMetricScore(
            precision_at_3=0.0,
            precision_at_5=0.0,
            recall_at_5=0.0,
            mrr=0.0,
            ndcg_at_5=0.0
        )

    # Precision@3
    top3 = retrieved_doc_ids[:3]
    rel_in_top3 = sum(1 for doc_id in top3 if doc_id in ground_truth_ids)
    p3 = rel_in_top3 / 3.0 if top3 else 0.0

    # Precision@5
    top5 = retrieved_doc_ids[:5]
    rel_in_top5 = sum(1 for doc_id in top5 if doc_id in ground_truth_ids)
    p5 = rel_in_top5 / 5.0 if top5 else 0.0

    # Recall@5
    r5 = rel_in_top5 / float(len(ground_truth_ids))

    # Reciprocal Rank (RR)
    rr = 0.0
    for rank, doc_id in enumerate(retrieved_doc_ids, start=1):
        if doc_id in ground_truth_ids:
            rr = 1.0 / rank
            break

    # DCG@5
    dcg5 = 0.0
    for i, doc_id in enumerate(top5):
        rel = 1.0 if doc_id in ground_truth_ids else 0.0
        dcg5 += rel / math.log2(i + 2) # i=0 -> rank 1, log2(2) = 1

    # IDCG@5
    idcg5 = 0.0
    ideal_count = min(5, len(ground_truth_ids))
    for i in range(ideal_count):
        idcg5 += 1.0 / math.log2(i + 2)

    ndcg5 = (dcg5 / idcg5) if idcg5 > 0 else 0.0

    return IRMetricScore(
        precision_at_3=round(p3, 4),
        precision_at_5=round(p5, 4),
        recall_at_5=round(r5, 4),
        mrr=round(rr, 4),
        ndcg_at_5=round(ndcg5, 4)
    )

class IREvaluationBenchmark:
    """
    Academic benchmark engine for Information Retrieval evaluation.
    Holds labeled query-relevance test sets and runs evaluation on BM25, Vector, and Hybrid.
    """
    def __init__(self, hybrid_engine):
        self.hybrid_engine = hybrid_engine

    def evaluate_test_suite(
        self,
        test_queries: List[Dict[str, Any]]
    ) -> BenchmarkSummaryResponse:
        """
        Runs evaluation on a suite of queries formatted as:
        [
            {
                "id": "q1",
                "query": "customer data retention period termination",
                "target_keywords": ["retention", "days", "termination"],
                "target_doc_titles": ["CloudScale Data Retention"]
            }
        ]
        """
        query_results: List[BenchmarkResultItem] = []
        bm25_metrics_list = []
        vector_metrics_list = []
        hybrid_metrics_list = []

        # Find document IDs matching the target criteria
        all_chunks = self.hybrid_engine.bm25_engine.chunks
        doc_id_to_title = {c["document_id"]: c.get("document_title", "") for c in all_chunks}

        for item in test_queries:
            qid = item["id"]
            qtext = item["query"]
            target_titles = [t.lower() for t in item.get("target_doc_titles", [])]
            target_kws = [k.lower() for k in item.get("target_keywords", [])]

            # Determine ground truth relevant document chunks
            ground_truth_doc_ids: Set[str] = set()
            for doc_id, title in doc_id_to_title.items():
                if any(tt in title.lower() for tt in target_titles):
                    ground_truth_doc_ids.add(doc_id)

            # If no direct title match, identify chunks containing key target concepts
            if not ground_truth_doc_ids and target_kws:
                for c in all_chunks:
                    content_lower = c["content"].lower()
                    if all(kw in content_lower for kw in target_kws):
                        ground_truth_doc_ids.add(c["document_id"])

            # Run search through all 3 methods
            _, stats = self.hybrid_engine.search(qtext, top_k=10)

            bm25_doc_ids = [r["document_id"] for r in stats["bm25_results"]]
            vector_doc_ids = [r["document_id"] for r in stats["vector_results"]]
            hybrid_doc_ids = [r["document_id"] for r in stats["hybrid_results"]]

            m_bm25 = calculate_metrics(bm25_doc_ids, ground_truth_doc_ids)
            m_vector = calculate_metrics(vector_doc_ids, ground_truth_doc_ids)
            m_hybrid = calculate_metrics(hybrid_doc_ids, ground_truth_doc_ids)

            bm25_metrics_list.append(m_bm25)
            vector_metrics_list.append(m_vector)
            hybrid_metrics_list.append(m_hybrid)

            query_results.append(
                BenchmarkResultItem(
                    query_id=qid,
                    query_text=qtext,
                    relevant_doc_ids=list(ground_truth_doc_ids),
                    bm25_metrics=m_bm25,
                    vector_metrics=m_vector,
                    hybrid_metrics=m_hybrid
                )
            )

        n = len(test_queries) if test_queries else 1
        
        def mean_metric(metrics: List[IRMetricScore]) -> IRMetricScore:
            return IRMetricScore(
                precision_at_3=round(sum(m.precision_at_3 for m in metrics) / n, 4),
                precision_at_5=round(sum(m.precision_at_5 for m in metrics) / n, 4),
                recall_at_5=round(sum(m.recall_at_5 for m in metrics) / n, 4),
                mrr=round(sum(m.mrr for m in metrics) / n, 4),
                ndcg_at_5=round(sum(m.ndcg_at_5 for m in metrics) / n, 4)
            )

        return BenchmarkSummaryResponse(
            total_queries=len(test_queries),
            bm25_mean=mean_metric(bm25_metrics_list),
            vector_mean=mean_metric(vector_metrics_list),
            hybrid_mean=mean_metric(hybrid_metrics_list),
            queries=query_results
        )
