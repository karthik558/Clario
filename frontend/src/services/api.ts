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
  GraphDataResponse
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
      body: JSON.stringify({ query, document_ids, top_k, thinking_mode, local_model, llm_provider }),
    });
    if (!res.ok) throw new Error('Ask Clario request failed');
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
  ): Promise<{ answer: string; mode: string; citations: CitationItem[]; thinking?: string }> => {
    const res = await fetch(`${API_BASE}/ask/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!res.ok) throw new Error('Streaming failed');
    if (!res.body) throw new Error('Readable stream not supported');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let answer = '';
    let thinking = '';
    let citations: CitationItem[] = [];
    let mode = '';
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

        try {
          const parsed = JSON.parse(rawData);
          if (event === 'citations') {
            citations = parsed;
            callbacks.onCitations?.(parsed);
          } else if (event === 'thinking') {
            thinking += parsed.text;
            callbacks.onThinking?.(parsed.text);
          } else if (event === 'token') {
            answer += parsed.text;
            callbacks.onToken(parsed.text);
          } else if (event === 'done') {
            mode = parsed.mode;
            if (parsed.answer) answer = parsed.answer;
          }
        } catch {
          // non-JSON chunk
        }
      }
    }

    return { answer, mode, citations, thinking };
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

  createReport: async (data: { title: string; report_type: string; document_ids: string[]; custom_notes?: string }): Promise<ReportItem> => {
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
  }
};
