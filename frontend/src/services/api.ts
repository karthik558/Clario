import {
  DocumentItem,
  DocumentDetail,
  DashboardStats,
  AskResponse,
  CitationItem,
  ComparisonResponse,
  FindingItem,
  ReportItem,
  SearchMethodComparison,
  BenchmarkSummary,
  SystemSettings,
  OllamaStatus,
  LocalAIStatus,
  DBTableInfo,
  NegotiateRequest,
  NegotiateResponse,
  GraphDataResponse,
  ComplianceAuditResponse,
  ObligationsResponse,
  CritiqueResponse,
  ClauseLibraryResponse,
  ClauseAnalysisResult,
  BriefResponse,
  AudioSummaryResponse,
  PolicyAuditResponse,
  WordAnalysisResponse
} from '../types';

const API_BASE = '/api';

export const api = {
  // Health
  getHealth: async () => {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Failed to fetch health');
    return res.json();
  },

  // Dashboard
  getDashboard: async (): Promise<DashboardStats> => {
    const res = await fetch(`${API_BASE}/dashboard`);
    if (!res.ok) throw new Error('Failed to fetch dashboard metrics');
    return res.json();
  },

  // Documents
  getDocuments: async (search?: string, status?: string, collection?: string): Promise<DocumentItem[]> => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (collection) params.append('collection', collection);
    const res = await fetch(`${API_BASE}/documents?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch documents');
    return res.json();
  },

  getDocument: async (id: string): Promise<DocumentDetail> => {
    const res = await fetch(`${API_BASE}/documents/${id}`);
    if (!res.ok) throw new Error('Failed to fetch document detail');
    return res.json();
  },

  uploadDocument: async (file: File, title?: string, tags?: string[], collection?: string): Promise<DocumentItem> => {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    if (tags && tags.length > 0) formData.append('tags', JSON.stringify(tags));
    if (collection) formData.append('collection', collection);

    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  },

  deleteDocument: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/documents/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete document');
  },

  clearAllDocuments: async (): Promise<{ message: string; cleared_count: number }> => {
    const res = await fetch(`${API_BASE}/documents/clear-all`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear documents');
    return res.json();
  },

  getDocumentFileUrl: (id: string) => `${API_BASE}/documents/${id}/file`,

  // Search & Lab
  search: async (query: string, mode: string = 'hybrid', top_k: number = 5, document_ids?: string[]) => {
    const res = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, mode, top_k, document_ids }),
    });
    if (!res.ok) throw new Error('Search failed');
    return res.json();
  },

  compareSearchMethods: async (query: string, top_k: number = 5): Promise<SearchMethodComparison> => {
    const res = await fetch(`${API_BASE}/search/compare-methods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k }),
    });
    if (!res.ok) throw new Error('Search comparison failed');
    return res.json();
  },

  runIRBenchmark: async (queries?: any[]): Promise<BenchmarkSummary> => {
    const res = await fetch(`${API_BASE}/search/benchmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries }),
    });
    if (!res.ok) throw new Error('Benchmark execution failed');
    return res.json();
  },

  // Ask Clario
  getAnswerHistory: async (): Promise<Array<{ id: string; query: string; response: AskResponse; document_ids: string[]; created_at: string }>> => {
    const res = await fetch(`${API_BASE}/ask/history`);
    if (!res.ok) throw new Error('Could not load saved answers');
    return res.json();
  },
  clearAnswerHistory: async (): Promise<{ status: string; message: string; deleted_count: number }> => {
    const res = await fetch(`${API_BASE}/ask/history`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear answer history');
    return res.json();
  },
  ask: async (
    query: string,
    document_ids?: string[],
    top_k?: number,
    thinking_mode?: boolean,
    local_model?: string,
    llm_provider?: string
  ): Promise<AskResponse> => {
    const res = await fetch(`${API_BASE}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, document_ids, top_k, thinking_mode, local_model, llm_provider, require_ai: true }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Ask Clario request failed');
    return res.json();
  },

  streamAsk: async (
    request: {
      query: string;
      document_ids?: string[];
      top_k?: number;
      thinking_mode?: boolean;
      local_model?: string;
      llm_provider?: string;
    },
    callbacks: {
      onToken: (token: string) => void;
      onThinking?: (text: string) => void;
      onCitations?: (citations: CitationItem[]) => void;
    }
  ): Promise<AskResponse> => {
    const res = await fetch(`${API_BASE}/ask/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, require_ai: true }),
    });

    if (!res.ok) throw new Error('Streaming failed');
    if (!res.body) throw new Error('Readable stream not supported');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let completed: AskResponse | undefined;
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        if (!block.trim()) continue;
        const eventMatch = block.match(/event:\s*(\w+)/);
        const dataMatch = block.match(/data:\s*(.+)/s);
        const event = eventMatch ? eventMatch[1] : 'token';
        const rawData = dataMatch ? dataMatch[1] : '';

        if (event === 'error') throw new Error(JSON.parse(rawData).detail);
        try {
          const parsed = JSON.parse(rawData);
          if (event === 'citations') {
            callbacks.onCitations?.(parsed);
          } else if (event === 'thinking') {
            callbacks.onThinking?.(parsed.text);
          } else if (event === 'token') {
            callbacks.onToken(parsed.text);
          } else if (event === 'done') {
            completed = parsed;
          }
        } catch {
          // non-JSON chunk
        }
      }
    }

    if (!completed) throw new Error("Answer stream ended before completion");
    return completed;
  },

  // Compare
  compareDocuments: async (doc_a_id: string, doc_b_id: string): Promise<ComparisonResponse> => {
    const res = await fetch(`${API_BASE}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_a_id, doc_b_id }),
    });
    if (!res.ok) throw new Error('Comparison failed');
    return res.json();
  },

  // Findings
  getFindings: async (category?: string, status?: string, severity?: string): Promise<FindingItem[]> => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (status) params.append('status', status);
    if (severity) params.append('severity', severity);
    const res = await fetch(`${API_BASE}/findings?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch findings');
    return res.json();
  },

  createFinding: async (data: Partial<FindingItem>): Promise<FindingItem> => {
    const res = await fetch(`${API_BASE}/findings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create finding');
    return res.json();
  },

  updateFinding: async (id: string, data: { status?: string; severity?: string; reviewer_notes?: string }): Promise<FindingItem> => {
    const res = await fetch(`${API_BASE}/findings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update finding');
    return res.json();
  },

  deleteFinding: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/findings/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete finding');
  },

  clearAllFindings: async (): Promise<{ message: string; cleared_count: number }> => {
    const res = await fetch(`${API_BASE}/findings`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear findings');
    return res.json();
  },

  scanContradictions: async () => {
    const res = await fetch(`${API_BASE}/findings/scan`, { method: 'POST' });
    if (!res.ok) throw new Error('Scan failed');
    return res.json();
  },

  // Reports
  getReports: async (): Promise<ReportItem[]> => {
    const res = await fetch(`${API_BASE}/reports`);
    if (!res.ok) throw new Error('Failed to fetch reports');
    return res.json();
  },

  createReport: async (data: { title: string; report_type: string; document_ids: string[]; custom_notes?: string; use_ai?: boolean }): Promise<ReportItem> => {
    const res = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) { const error = await res.json().catch(() => ({})); throw new Error(typeof error.detail === 'string' ? error.detail : 'Report generation failed. Check the title and document scope.'); }
    return res.json();
  },

  deleteReport: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/reports/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete report');
  },

  clearAllReports: async (): Promise<{ message: string; cleared_count: number }> => {
    const res = await fetch(`${API_BASE}/reports`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear reports');
    return res.json();
  },

  getReportDownloadUrl: (id: string) => `${API_BASE}/reports/${id}/download`,

  // Settings
  getSettings: async (): Promise<SystemSettings> => {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  updateSettings: async (settingsData: Partial<SystemSettings>): Promise<any> => {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsData),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
  },

  getOllamaStatus: async (): Promise<OllamaStatus> => {
    const res = await fetch(`${API_BASE}/settings/ollama/status`);
    if (!res.ok) throw new Error('Failed to check Ollama status');
    return res.json();
  },

  getDatabaseTables: async (): Promise<{ database_file: string; tables: DBTableInfo[] }> => {
    const res = await fetch(`${API_BASE}/settings/database/tables`);
    if (!res.ok) throw new Error('Failed to fetch tables');
    return res.json();
  },

  inspectDatabaseTable: async (tableName: string, limit: number = 25): Promise<{ table: string; columns: string[]; rows: any[] }> => {
    const res = await fetch(`${API_BASE}/settings/database/table/${tableName}?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to inspect table');
    return res.json();
  },

  reindexAll: async () => {
    const res = await fetch(`${API_BASE}/settings/reindex`, { method: 'POST' });
    if (!res.ok) throw new Error('Reindex failed');
    return res.json();
  },

  // Local AI Gateway & Status
  getLocalAIStatus: async (provider?: string): Promise<LocalAIStatus> => {
    const params = new URLSearchParams();
    if (provider) params.append('provider', provider);
    const res = await fetch(`${API_BASE}/settings/local-ai/status?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to check Local AI status');
    return res.json();
  },

  // Clause Negotiator
  negotiateClause: async (request: NegotiateRequest): Promise<NegotiateResponse> => {
    const res = await fetch(`${API_BASE}/negotiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Clause negotiation failed');
    }
    return res.json();
  },

  negotiateFinding: async (findingId: string, stance: string, customInstructions?: string): Promise<NegotiateResponse> => {
    const res = await fetch(`${API_BASE}/findings/${findingId}/negotiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stance, custom_instructions: customInstructions }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Finding clause negotiation failed');
    }
    return res.json();
  },

  // Knowledge & Citation Graph
  getKnowledgeGraph: async (documentIds?: string[]): Promise<GraphDataResponse> => {
    const params = new URLSearchParams();
    if (documentIds && documentIds.length > 0) {
      params.append('document_ids', documentIds.join(','));
    }
    const res = await fetch(`${API_BASE}/graph?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to load knowledge graph');
    return res.json();
  },

  // Compliance & Regulatory Audit
  getComplianceFrameworks: async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/compliance/frameworks`);
    if (!res.ok) throw new Error('Failed to load compliance frameworks');
    return res.json();
  },

  auditCompliance: async (documentIds?: string[], frameworkIds?: string[]): Promise<ComplianceAuditResponse> => {
    const res = await fetch(`${API_BASE}/compliance/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_ids: documentIds, framework_ids: frameworkIds }),
    });
    if (!res.ok) throw new Error('Compliance audit failed');
    return res.json();
  },

  // Obligations & Timeline
  getObligations: async (category?: string, risk?: string): Promise<ObligationsResponse> => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (risk) params.append('risk', risk);
    const res = await fetch(`${API_BASE}/obligations?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to load obligations');
    return res.json();
  },

  scanObligations: async (documentIds?: string[]): Promise<ObligationsResponse> => {
    const res = await fetch(`${API_BASE}/obligations/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_ids: documentIds }),
    });
    if (!res.ok) throw new Error('Obligations extraction failed');
    return res.json();
  },

  // Multi-Persona Critique
  evaluateCritique: async (documentIds?: string[], customClause?: string, useAi?: boolean): Promise<CritiqueResponse> => {
    const res = await fetch(`${API_BASE}/critique/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_ids: documentIds, custom_clause: customClause, use_ai: useAi }),
    });
    if (!res.ok) throw new Error('Critique evaluation failed');
    return res.json();
  },

  draftCounterClause: async (point: string, detail: string, personaId?: string, documentTitle?: string): Promise<{ point: string; counter_clause: string; rationale: string; mode: string }> => {
    const res = await fetch(`${API_BASE}/critique/draft-counter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ point, detail, persona_id: personaId, document_title: documentTitle }),
    });
    if (!res.ok) throw new Error('Counter clause drafting failed');
    return res.json();
  },

  // Clause Library & Benchmarks
  getClauseBenchmarks: async (): Promise<ClauseLibraryResponse> => {
    const res = await fetch(`${API_BASE}/clauses`);
    if (!res.ok) throw new Error('Failed to load clause library');
    return res.json();
  },

  benchmarkClauses: async (documentIds?: string[]): Promise<ClauseLibraryResponse> => {
    const res = await fetch(`${API_BASE}/clauses/benchmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_ids: documentIds }),
    });
    if (!res.ok) throw new Error('Failed to benchmark clauses');
    return res.json();
  },

  analyzeClause: async (clauseText: string): Promise<ClauseAnalysisResult> => {
    const res = await fetch(`${API_BASE}/clauses/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clause_text: clauseText }),
    });
    if (!res.ok) throw new Error('Clause analysis failed');
    return res.json();
  },

  // Executive Briefs
  getBriefTemplates: async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/briefs/templates`);
    if (!res.ok) throw new Error('Failed to load brief templates');
    return res.json();
  },

  generateBrief: async (templateId?: string, documentIds?: string[], customNotes?: string, useAi?: boolean): Promise<BriefResponse> => {
    const res = await fetch(`${API_BASE}/briefs/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: templateId || 'board_executive',
        document_ids: documentIds,
        custom_notes: customNotes,
        use_ai: useAi
      }),
    });
    if (!res.ok) throw new Error('Failed to generate executive brief');
    return res.json();
  },

  // Risk Scorecard & Benchmarking
  getRiskScorecard: async (documentId?: string) => {
    const params = documentId ? `?document_id=${encodeURIComponent(documentId)}` : '';
    const res = await fetch(`${API_BASE}/risk/scorecard${params}`);
    if (!res.ok) throw new Error('Failed to fetch risk scorecard');
    return res.json();
  },

  getRiskBenchmark: async (docAId: string, docBId: string) => {
    const res = await fetch(`${API_BASE}/risk/benchmark?doc_a=${encodeURIComponent(docAId)}&doc_b=${encodeURIComponent(docBId)}`);
    if (!res.ok) throw new Error('Failed to fetch risk benchmark');
    return res.json();
  },

  // Audio Intelligence & Narration
  getAudioSummary: async (documentIds?: string[], tone?: string): Promise<AudioSummaryResponse> => {
    const res = await fetch(`${API_BASE}/briefs/audio-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_ids: documentIds, tone: tone || 'executive' }),
    });
    if (!res.ok) throw new Error('Failed to generate audio summary');
    return res.json();
  },

  getAudioExportUrl: (documentIds?: string[], format: 'mp3' | 'mp4' = 'mp3'): string => {
    const params = new URLSearchParams();
    params.set('format', format);
    if (documentIds && documentIds.length > 0) {
      params.set('document_ids', documentIds.join(','));
    }
    return `${API_BASE}/briefs/audio-export?${params.toString()}`;
  },

  // Policy Checker & Audit Studio
  getPolicyRules: async () => {
    const res = await fetch(`${API_BASE}/policy-checker/rules`);
    if (!res.ok) throw new Error('Failed to load policy rules');
    return res.json();
  },

  auditPolicies: async (documentIds?: string[], category?: string): Promise<PolicyAuditResponse> => {
    const res = await fetch(`${API_BASE}/policy-checker/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_ids: documentIds, category_filter: category || 'all' }),
    });
    if (!res.ok) throw new Error('Failed to run policy audit');
    return res.json();
  },

  // Word & Lexical Analysis
  getWordAnalysis: async (documentIds?: string[]): Promise<WordAnalysisResponse> => {
    const params = new URLSearchParams();
    if (documentIds && documentIds.length > 0) {
      params.set('document_ids', documentIds.join(','));
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/reports/analysis/words${query}`);
    if (!res.ok) throw new Error('Failed to load word analysis');
    return res.json();
  }
};
