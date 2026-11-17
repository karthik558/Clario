import re
import string
from typing import List, Dict, Any, Tuple
from rank_bm25 import BM25Okapi

STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", 
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", 
    "by", "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from", 
    "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him", 
    "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just", "me", 
    "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off", "on", "once", "only", 
    "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "she", 
    "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves", 
    "then", "there", "these", "they", "this", "those", "through", "to", "too", "under", "until", 
    "up", "very", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom", 
    "why", "with", "would", "you", "your", "yours", "yourself", "yourselves"
}

def tokenize(text: str) -> List[str]:
    # Lowercase and clean punctuation
    clean_text = text.lower()
    clean_text = re.sub(r'[^a-z0-9\s]', ' ', clean_text)
    tokens = clean_text.split()
    return [t for t in tokens if t not in STOPWORDS and len(t) > 1]

class BM25SearchEngine:
    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.chunks: List[Dict[str, Any]] = []
        self.corpus_tokens: List[List[str]] = []
        self.bm25: BM25Okapi = None

    def index_chunks(self, chunks: List[Dict[str, Any]]):
        self.chunks = chunks
        self.corpus_tokens = [tokenize(c["content"]) for c in chunks]
        if self.corpus_tokens and any(len(t) > 0 for t in self.corpus_tokens):
            self.bm25 = BM25Okapi(self.corpus_tokens, k1=self.k1, b=self.b)
        else:
            self.bm25 = None

    def search(self, query: str, top_k: int = 5, document_ids: List[str] = None) -> List[Dict[str, Any]]:
        top_k = top_k or 5
        if not self.bm25 or not self.chunks:
            return []

        query_tokens = tokenize(query)
        if not query_tokens:
            return []

        doc_scores = self.bm25.get_scores(query_tokens)
        
        # Pair with chunk data
        scored_results: List[Tuple[float, Dict[str, Any]]] = []
        for i, score in enumerate(doc_scores):
            chunk = self.chunks[i]
            if document_ids and chunk.get("document_id") not in document_ids:
                continue
            if score > 0.0001:
                scored_results.append((float(score), chunk))

        # Sort descending by BM25 score
        scored_results.sort(key=lambda x: x[0], reverse=True)
        top_slice = scored_results[:top_k]

        max_score = top_slice[0][0] if top_slice else 1.0
        results = []
        for rank, (score, chunk) in enumerate(top_slice, start=1):
            normalized_score = min(1.0, score / max_score) if max_score > 0 else 0.0
            results.append({
                "chunk_id": chunk["id"],
                "document_id": chunk["document_id"],
                "document_title": chunk.get("document_title", "Document"),
                "page_number": chunk.get("page_number", 1),
                "snippet": chunk["content"],
                "raw_score": round(score, 4),
                "score": round(normalized_score, 4),
                "rank": rank,
                "method": "bm25"
            })
        return results
