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
  thinking_process?: string;
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
  severity: 'low' | 'medium' | 'high' | 'critical';
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
  average_latency_ms: number | null;
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
  ollama_base_url?: string;
  ollama_model?: string;
  local_ai_base_url?: string;
  local_ai_model?: string;
  local_ai_provider?: string;
  thinking_mode?: boolean;
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
  storage_dir?: string;
  database_url?: string;
}

export interface OllamaStatus {
  running: boolean;
  url: string;
  models: string[];
  active_model: string;
  message: string;
}

export interface LocalAIStatus {
  running: boolean;
  provider: string;
  url: string;
  models: string[];
  active_model: string;
  message: string;
}

export interface DBTableInfo {
  name: string;
  row_count: number;
}

export interface NegotiateRequest {
  finding_id?: string;
  topic?: string;
  statement_a?: string;
  statement_b?: string;
  doc_a_title?: string;
  doc_b_title?: string;
  page_a?: number;
  page_b?: number;
  stance: 'balanced' | 'customer_protective' | 'vendor_favorable' | 'strict_compliance';
  custom_instructions?: string;
  use_ai?: boolean;
}

export interface NegotiateResponse {
  topic: string;
  stance: string;
  original_a: { doc_title: string; page: number; quote: string };
  original_b: { doc_title: string; page: number; quote: string };
  proposed_clause: string;
  rationale: string;
  risk_level: string;
  key_concessions: string[];
  mode: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'document' | 'topic' | 'finding' | 'chunk';
  size: number;
  color: string;
  metadata?: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: 'contains' | 'governs' | 'contradicts' | 'cites';
  color: string;
  dashed?: boolean;
  weight: number;
}

export interface GraphDataResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    total_documents: number;
    total_findings: number;
    total_topics: number;
    total_nodes: number;
    total_edges: number;
  };
}

// --- Compliance Types ---
export interface FrameworkCriterion {
  id: string;
  title: string;
  clause_target: string;
  status: 'compliant' | 'gap_identified' | 'advisory_warning';
  description: string;
  evidence_quote: string;
}

export interface FrameworkReport {
  framework_id: string;
  framework_name: string;
  jurisdiction: string;
  category: string;
  readiness_score: number;
  status: string;
  passed_count: number;
  total_count: number;
  criteria: FrameworkCriterion[];
}

export interface ComplianceGap {
  id: string;
  framework_id: string;
  framework_name: string;
  criterion_id: string;
  criterion_title: string;
  severity: 'critical' | 'high' | 'medium';
  clause_target: string;
  gap_summary: string;
  remediation_clause: string;
}

export interface ComplianceAuditResponse {
  overall_score: number;
  audited_documents: number;
  total_checks: number;
  passed_checks: number;
  gaps_count: number;
  frameworks: FrameworkReport[];
  gaps: ComplianceGap[];
}

// --- Obligations Types ---
export interface ObligationItem {
  id: string;
  document_id: string;
  document_title: string;
  page_number: number;
  category: string;
  title: string;
  clause_quote: string;
  obligated_party: string;
  due_date_or_window: string;
  trigger_condition: string;
  risk_level: 'Critical' | 'High' | 'Medium' | 'Low';
  status: string;
  fulfillment_verified: boolean;
}

export interface ObligationsResponse {
  total: number;
  items: ObligationItem[];
}

// --- Critique Types ---
export interface CritiqueRedFlag {
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  point: string;
  detail: string;
  counter_clause: string;
}

export interface CritiquePersona {
  persona_id: string;
  role_title: string;
  avatar_color: string;
  verdict: string;
  risk_score: number;
  focus: string;
  red_flags: CritiqueRedFlag[];
}

export interface CritiqueResponse {
  evaluated_documents: number;
  findings_referenced: number;
  composite_risk_score: number;
  overall_assessment: string;
  leverage_summary: string;
  mode?: string;
  personas: CritiquePersona[];
}

// --- Clause Library Types ---
export interface ClauseItem {
  id: string;
  document_title: string;
  page_number: number;
  text: string;
  favorability: string;
  deviation_from_market: string;
}

export interface ClauseBenchmark {
  category: string;
  market_standard: string;
  common_pitfall: string;
  risk_weight: string;
  detected_count: number;
  clauses: ClauseItem[];
}

export interface ClauseLibraryResponse {
  total_documents: number;
  total_categories: number;
  benchmarks: ClauseBenchmark[];
}

export interface ClauseAnalysisResult {
  favorability: string;
  alignment_score: number;
  recommendation: string;
  word_count: number;
  key_phrases: string[];
}

// --- Executive Brief Types ---
export interface BriefFinancialExposure {
  label: string;
  detail: string;
}

export interface BriefLegalRisk {
  item: string;
  status: string;
  assessment: string;
}

export interface BriefResponse {
  title: string;
  generated_date: string;
  template_id: string;
  audited_documents: string[];
  executive_summary: string;
  financial_exposure: BriefFinancialExposure[];
  legal_risks: BriefLegalRisk[];
  critical_findings_count: number;
  key_recommendation: string;
  action_items: string[];
  custom_notes: string;
  mode?: string;
}

// --- Audio Briefing Types ---
export interface AudioSection {
  id: string;
  speaker: string;
  title: string;
  text: string;
  estimated_seconds: number;
}

export interface AudioSummaryResponse {
  title: string;
  generated_date: string;
  duration_seconds: number;
  duration_formatted: string;
  word_count: number;
  audited_documents: string[];
  sections: AudioSection[];
  full_audio_text: string;
}

// --- Policy Checker Types ---
export interface PolicyRuleAudit {
  id: string;
  title: string;
  category: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Informational';
  benchmark: string;
  status: 'COMPLIANT' | 'NEEDS_REVIEW' | 'VIOLATION';
  evidence_quote: string;
  evidence_source: string;
  violation_notes: string;
  remediation_clause: string;
}

export interface PolicyAuditResponse {
  audit_date: string;
  overall_score: number;
  overall_grade: string;
  total_rules: number;
  passed_count: number;
  warning_count: number;
  violation_count: number;
  audited_documents: string[];
  rules: PolicyRuleAudit[];
  summary: string;
}

// --- Word Analysis & Visual Analytics Types ---
export interface KeywordAnalysisItem {
  word: string;
  count: number;
  density_pct: number;
  category: string;
  relative_pct: number;
}

export interface CategoryDistributionItem {
  category: string;
  count: number;
  pct: number;
  color: string;
}

export interface SentimentBreakdownItem {
  count: number;
  pct: number;
  label: string;
}

export interface DocumentBreakdownItem {
  id: string;
  title: string;
  word_count: number;
  unique_words: number;
  lexical_density_pct: number;
  reading_ease: number;
  top_keyword: string;
}

export interface WordAnalysisResponse {
  total_words: number;
  unique_words: number;
  total_characters: number;
  lexical_density_pct: number;
  avg_word_length: number;
  avg_sentence_length: number;
  flesch_reading_ease: number;
  reading_level: string;
  audited_documents_count: number;
  top_keywords: KeywordAnalysisItem[];
  category_distribution: CategoryDistributionItem[];
  sentiment_breakdown: {
    protective: SentimentBreakdownItem;
    obligations: SentimentBreakdownItem;
    exposure: SentimentBreakdownItem;
  };
  document_breakdowns: DocumentBreakdownItem[];
}
