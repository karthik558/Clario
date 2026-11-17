from typing import Literal, List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

# ---------------- Documents ----------------

class ChunkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    chunk_index: int
    page_number: int
    start_char: int
    end_char: int
    content: str
    token_count: int

class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    filename: str
    file_type: str
    file_size: int
    page_count: int
    word_count: int
    chunk_count: int
    status: str
    error_message: Optional[str] = None
    tags: List[str] = []
    collection: str
    created_at: datetime
    updated_at: datetime

class DocumentDetailResponse(DocumentResponse):
    chunks: List[ChunkResponse] = []

class IngestionJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str
    status: str
    progress_percent: int
    current_stage: str
    message: Optional[str] = None
    created_at: datetime

# ---------------- Search & Lab ----------------

class SearchRequest(BaseModel):
    query: str
    mode: str = "hybrid" # "bm25", "vector", "hybrid"
    top_k: int = 5
    document_ids: Optional[List[str]] = None
    collection: Optional[str] = None

class SearchResultItem(BaseModel):
    chunk_id: str
    document_id: str
    document_title: str
    page_number: int
    snippet: str
    score: float
    rank: int
    method: str

class SearchResponse(BaseModel):
    query: str
    mode: str
    top_k: int
    latency_ms: float
    results: List[SearchResultItem]

class SearchMethodComparison(BaseModel):
    query: str
    latency_bm25_ms: float
    latency_vector_ms: float
    latency_hybrid_ms: float
    overlap_count: int
    jaccard_similarity: float
    bm25_results: List[SearchResultItem]
    vector_results: List[SearchResultItem]
    hybrid_results: List[SearchResultItem]

class IRMetricScore(BaseModel):
    precision_at_3: float
    precision_at_5: float
    recall_at_5: float
    mrr: float
    ndcg_at_5: float

class BenchmarkResultItem(BaseModel):
    query_id: str
    query_text: str
    relevant_doc_ids: List[str]
    bm25_metrics: IRMetricScore
    vector_metrics: IRMetricScore
    hybrid_metrics: IRMetricScore

class BenchmarkSummaryResponse(BaseModel):
    total_queries: int
    bm25_mean: IRMetricScore
    vector_mean: IRMetricScore
    hybrid_mean: IRMetricScore
    queries: List[BenchmarkResultItem]

# ---------------- Ask Clario / Q&A ----------------

class AskRequest(BaseModel):
    query: str
    document_ids: Optional[List[str]] = None
    collection: Optional[str] = None
    top_k: Optional[int] = Field(default=None, ge=1, le=50)
    thinking_mode: Optional[bool] = False
    local_model: Optional[str] = None
    llm_provider: Optional[str] = None

class CitationItem(BaseModel):
    citation_id: int
    chunk_id: str
    document_id: str
    document_title: str
    page_number: int
    snippet: str
    relevance_score: float

class AskResponse(BaseModel):
    query: str
    answer: str
    mode: str
    citations: List[CitationItem]
    retrieval_latency_ms: float
    synthesis_latency_ms: float
    has_conflicting_evidence: bool = False
    conflict_notes: Optional[str] = None
    thinking_process: Optional[str] = None

# ---------------- Document Comparison ----------------

class CompareRequest(BaseModel):
    doc_a_id: str
    doc_b_id: str

class DiffToken(BaseModel):
    type: str
    text: str

class DiffBlock(BaseModel):
    type: str
    text_a: Optional[str] = None
    text_b: Optional[str] = None
    page_a: Optional[int] = None
    page_b: Optional[int] = None

class ContradictionCandidate(BaseModel):
    topic: str
    statement_a: str
    statement_b: str
    page_a: int
    page_b: int
    explanation: str
    confidence: str

class ComparisonResponse(BaseModel):
    id: str
    doc_a: DocumentResponse
    doc_b: DocumentResponse
    title: str
    similarity_score: float
    added_tokens_count: int
    removed_tokens_count: int
    changed_sections_count: int
    summary: str
    shared_topics: List[str]
    differences: List[str]
    contradiction_candidates: List[ContradictionCandidate]
    diff_blocks: List[DiffBlock]

# ---------------- Findings ----------------

class FindingCreate(BaseModel):
    category: str
    title: str
    description: str
    severity: str = "medium"
    status: str = "open"
    doc_a_id: Optional[str] = None
    doc_a_title: Optional[str] = None
    doc_a_page: Optional[int] = None
    doc_a_quote: Optional[str] = None
    doc_b_id: Optional[str] = None
    doc_b_title: Optional[str] = None
    doc_b_page: Optional[int] = None
    doc_b_quote: Optional[str] = None
    reviewer_notes: Optional[str] = None

class FindingUpdate(BaseModel):
    status: Optional[str] = None
    severity: Optional[str] = None
    reviewer_notes: Optional[str] = None

class FindingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    category: str
    title: str
    description: str
    severity: str
    status: str
    doc_a_id: Optional[str] = None
    doc_a_title: Optional[str] = None
    doc_a_page: Optional[int] = None
    doc_a_quote: Optional[str] = None
    doc_b_id: Optional[str] = None
    doc_b_title: Optional[str] = None
    doc_b_page: Optional[int] = None
    doc_b_quote: Optional[str] = None
    reviewer_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

# ---------------- Reports ----------------

class ReportCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    report_type: Literal["summary", "comparative", "search_benchmark", "contradictions", "research_dossier"]
    document_ids: List[str] = []
    include_methodology: bool = True
    custom_notes: Optional[str] = None

class ReportResponse(BaseModel):
    id: str
    title: str
    report_type: str
    executive_summary: str
    content: Dict[str, Any]
    document_ids: List[str]
    pdf_available: bool
    created_at: datetime

# ---------------- Dashboard ----------------

class DashboardStatsResponse(BaseModel):
    total_documents: int
    indexed_documents: int
    pending_documents: int
    total_searchable_passages: int
    recent_analyses_count: int
    potential_conflicts_count: int
    average_latency_ms: float
    recent_documents: List[DocumentResponse]
    recent_findings: List[FindingResponse]
    recent_activities: List[Dict[str, Any]]

# ---------------- Autonomous Clause Negotiation (P3) ----------------

class NegotiateRequest(BaseModel):
    finding_id: Optional[str] = None
    topic: Optional[str] = None
    statement_a: Optional[str] = None
    statement_b: Optional[str] = None
    doc_a_title: Optional[str] = None
    doc_b_title: Optional[str] = None
    page_a: Optional[int] = 1
    page_b: Optional[int] = 1
    stance: Literal["balanced", "customer_protective", "vendor_favorable", "strict_compliance"] = "balanced"
    custom_instructions: Optional[str] = None

class NegotiateResponse(BaseModel):
    topic: str
    stance: str
    original_a: Dict[str, Any]
    original_b: Dict[str, Any]
    proposed_clause: str
    rationale: str
    risk_level: str
    key_concessions: List[str]
    mode: str = "local_ai_autonomous_negotiation"

# ---------------- Interactive Knowledge Graph (P4) ----------------

class GraphNode(BaseModel):
    id: str
    label: str
    type: Literal["document", "topic", "finding", "chunk"]
    size: float
    color: str
    metadata: Dict[str, Any] = {}

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = None
    type: Literal["contains", "governs", "contradicts", "cites"]
    color: str = "#94A3B8"
    dashed: bool = False
    weight: float = 1.0

class GraphDataResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    stats: Dict[str, Any]
