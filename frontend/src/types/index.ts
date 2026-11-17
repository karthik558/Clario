export interface DocumentItem {
  id: string;
  title: string;
  filename: string;
  file_type: string;
  file_size: number;
  page_count: number;
  word_count: number;
  chunk_count: number;
  status: 'QUEUED' | 'PROCESSING' | 'READY' | 'ERROR';
  error_message?: string;
  tags: string[];
  collection: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: string;
  chunk_index: number;
  page_number: number;
  start_char: number;
  end_char: number;
  content: string;
  token_count: number;
}

export interface DocumentDetail extends DocumentItem {
  chunks: DocumentChunk[];
}

export interface SearchResultItem {
  chunk_id: string;
  document_id: string;
  document_title: string;
  page_number: number;
  snippet: string;
  score: number;
  rank: number;
  method: string;
}

export interface SearchMethodComparison {
  query: string;
  latency_bm25_ms: number;
  latency_vector_ms: number;
  latency_hybrid_ms: number;
  overlap_count: number;
  jaccard_similarity: number;
  bm25_results: SearchResultItem[];
  vector_results: SearchResultItem[];
  hybrid_results: SearchResultItem[];
}

export interface IRMetricScore {
  precision_at_3: number;
  precision_at_5: number;
  recall_at_5: number;
  mrr: number;
  ndcg_at_5: number;
}

export interface BenchmarkResultItem {
  query_id: string;
  query_text: string;
  relevant_doc_ids: string[];
  bm25_metrics: IRMetricScore;
  vector_metrics: IRMetricScore;
  hybrid_metrics: IRMetricScore;
}

export interface BenchmarkSummary {
  total_queries: number;
  bm25_mean: IRMetricScore;
  vector_mean: IRMetricScore;
  hybrid_mean: IRMetricScore;
  queries: BenchmarkResultItem[];
}

export interface CitationItem {
  citation_id: number;
  chunk_id: string;
  document_id: string;
  document_title: string;
  page_number: number;
  snippet: string;
  relevance_score: number;
}

export interface AskResponse {
  query: string;
  answer: string;
  mode: string;
  citations: CitationItem[];
  retrieval_latency_ms: number;
  synthesis_latency_ms: number;
  has_conflicting_evidence: boolean;
  conflict_notes?: string;
}

export interface DiffBlock {
  type: 'equal' | 'insert' | 'delete' | 'replace';
  text_a?: string;
  text_b?: string;
  page_a?: number;
  page_b?: number;
}

export interface ContradictionCandidate {
  topic: string;
  statement_a: string;
  statement_b: string;
  page_a: number;
  page_b: number;
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ComparisonResponse {
  id: string;
  doc_a: DocumentItem;
  doc_b: DocumentItem;
  title: string;
  similarity_score: number;
  added_tokens_count: number;
  removed_tokens_count: number;
  changed_sections_count: number;
  summary: string;
  shared_topics: string[];
  differences: string[];
  contradiction_candidates: ContradictionCandidate[];
  diff_blocks: DiffBlock[];
}

export interface FindingItem {
  id: string;
  category: 'possible_contradiction' | 'agreement' | 'missing_coverage' | 'outdated_statement' | 'changed_obligation' | 'needs_human_review';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'under_review' | 'confirmed' | 'dismissed' | 'resolved';
  doc_a_id?: string;
  doc_a_title?: string;
  doc_a_page?: number;
  doc_a_quote?: string;
  doc_b_id?: string;
  doc_b_title?: string;
  doc_b_page?: number;
  doc_b_quote?: string;
  reviewer_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ReportItem {
  id: string;
  title: string;
  report_type: string;
  executive_summary: string;
  content: Record<string, any>;
  document_ids: string[];
  pdf_available: boolean;
  created_at: string;
}

export interface DashboardStats {
  total_documents: number;
  indexed_documents: number;
  pending_documents: number;
  total_searchable_passages: number;
  recent_analyses_count: number;
  potential_conflicts_count: number;
  average_latency_ms: number;
  recent_documents: DocumentItem[];
  recent_findings: FindingItem[];
  recent_activities: Array<{
    type: string;
    title: string;
    timestamp: string;
    status: string;
  }>;
}

export interface SystemSettings {
  project_name: string;
  tagline: string;
  llm_provider: string;
  gemini_api_key?: string;
  openai_api_key?: string;
  gemini_api_key_configured: boolean;
  openai_api_key_configured: boolean;
  bm25_k1: number;
  bm25_b: number;
  rrf_k: number;
  default_top_k: number;
  chunk_size: number;
  chunk_overlap: number;
}
