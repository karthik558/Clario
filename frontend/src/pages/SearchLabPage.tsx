import { PageHeader } from '../components/layout/PageHeader';
import { Select } from '../components/ui/Select';
import React, { useState, useEffect } from 'react';
import {
  Search,
  Clock,
  Layers,
  SearchCheck,
  CheckCircle2,
  BookOpen
} from 'lucide-react';
import { api } from '../services/api';
import { SearchMethodComparison, DocumentItem } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DocumentViewerModal } from '../components/documents/DocumentViewerModal';

export const SearchLabPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [query, setQuery] = useState('data retention zero data retention ZDR 30 days vs 60 days audit');
  const [topK, setTopK] = useState(5);
  const [comparison, setComparison] = useState<SearchMethodComparison | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [error, setError] = useState('');
  const [viewerChunk, setViewerChunk] = useState<{ docId: string; chunkId: string; page: number } | null>(null);

  const executeComparison = async (q: string, k: number, docIds: string[] = selectedDocIds) => {
    if (!q.trim()) return;
    setLoadingSearch(true);
    setError('');
    try {
      const data = await api.compareSearchMethods(q, k, docIds.length > 0 ? docIds : undefined);
      setComparison(data);
    } catch (err) {
      console.error(err);
      setError('Could not evaluate search retrieval. Check that documents are indexed and the backend is running.');
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleRunSearchComparison = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    executeComparison(query, topK, selectedDocIds);
  };

  useEffect(() => {
    api.getDocuments().then((docs) => setDocuments(docs.filter((d) => d.status === 'READY'))).catch(() => {});
    executeComparison(query, topK, []);
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Search lab"
        description="Compare keyword (BM25), semantic vector, and hybrid search results across your selected documents."
      />

      {error && (
        <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      <div className="space-y-6">
          {/* Document Scope Selector Bar */}
          {documents.length > 0 && (
            <Card className="p-3 bg-white border border-slate-200 shadow-xs">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label htmlFor="search-lab-doc-scope" className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider shrink-0">
                  Document Scope:
                </label>
                <Select
                  id="search-lab-doc-scope"
                  value={selectedDocIds[0] || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const next = val ? [val] : [];
                    setSelectedDocIds(next);
                    executeComparison(query, topK, next);
                  }}
                  className="text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1.5 min-w-[240px] max-w-md"
                >
                  <option value="">All Workspace Documents ({documents.length})</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title.replace(/_/g, ' ')}
                    </option>
                  ))}
                </Select>
              </div>
            </Card>
          )}

          {/* Query Input Card */}
          <Card className="p-5">
            <form onSubmit={handleRunSearchComparison} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-clario-text-secondary absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter query to evaluate across BM25, Vector, and Hybrid..."
                    className="w-full text-xs pl-10 pr-4 py-2.5 rounded-md border border-slate-200 bg-white focus:outline-none focus:border-slate-900 text-slate-900"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500 whitespace-nowrap">Top-K:</span>
                  <Select
                    aria-label="Number of search results" value={topK}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setTopK(next);
                      executeComparison(query, next);
                    }}
                    className="text-xs bg-white border border-slate-200 rounded-md px-2.5 py-2 text-slate-800"
                  >
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                    <option value={8}>8</option>
                  </Select>
                  <Button variant="primary" size="md" type="submit" loading={loadingSearch}>
                    Evaluate Retrieval
                  </Button>
                </div>
              </div>

              {/* Preset Query Selector */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs">
                <label htmlFor="search-lab-preset" className="text-slate-500 font-medium shrink-0">
                  Preset queries:
                </label>
                <Select
                  id="search-lab-preset"
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    setQuery(e.target.value);
                    executeComparison(e.target.value, topK);
                  }}
                  className="text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1.5 max-w-md text-slate-700"
                >
                  <option value="">Choose a sample benchmark query...</option>
                  {[
                    'data retention zero data retention ZDR 30 days vs 60 days audit',
                    'limitation of liability aggregate monetary damages $100 vs $250,000 USD',
                    'cybersecurity breach notification preliminary alert 72 hours forensic report 60 days',
                    'intellectual property Copyright Shield defense indemnification',
                    'HIPAA compliance Business Associate Agreement BAA protected health information',
                    'sovereign EU data boundary regional processing mesh GDPR'
                  ].map((sq, idx) => (
                    <option key={idx} value={sq}>
                      {sq}
                    </option>
                  ))}
                </Select>
              </div>
            </form>
          </Card>

          {/* Comparison Results */}
          {comparison && (
            <div className="space-y-6 animate-in fade-in">
              {/* Overlap & Performance Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
                  <div className="flex items-center justify-between text-clario-text-secondary mb-3">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider">BM25 Latency</span>
                    <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
                    {comparison.latency_bm25_ms} ms
                  </span>
                  <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Lexical Inverted Index</span>
                </Card>

                <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
                  <div className="flex items-center justify-between text-clario-text-secondary mb-3">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider">Vector Latency</span>
                    <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
                    {comparison.latency_vector_ms} ms
                  </span>
                  <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Dense Cosine Similarity</span>
                </Card>

                <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
                  <div className="flex items-center justify-between text-clario-text-secondary mb-3">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider">Hybrid RRF Latency</span>
                    <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
                      <SearchCheck className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
                    {comparison.latency_hybrid_ms} ms
                  </span>
                  <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Rank Fusion (k=60)</span>
                </Card>

                <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
                  <div className="flex items-center justify-between text-clario-text-secondary mb-3">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider">Method Overlap</span>
                    <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <span className="text-2xl font-semibold tracking-tight tabular-nums text-emerald-700 font-mono">
                    {(comparison.jaccard_similarity * 100).toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-emerald-600 font-medium mt-1">
                    {comparison.overlap_count} shared top-{topK} passages
                  </span>
                </Card>
              </div>

              {/* 3-Column Method Comparison Table */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Method A: BM25 */}
                <div className="bg-white rounded-md border border-slate-200 p-4 shadow-subtle flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <h3 className="font-semibold text-xs text-slate-900">A. BM25 Lexical</h3>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">k1=1.5, b=0.75</span>
                  </div>
                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px]">
                    {comparison.bm25_results.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        No passages retrieved via BM25 lexical index.
                      </div>
                    ) : (
                      comparison.bm25_results.map((r) => (
                        <div key={r.chunk_id} className="p-3 rounded-md border border-slate-200 bg-slate-50/70">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-semibold text-slate-900 truncate max-w-[140px]">{r.document_title}</span>
                            <span className="font-mono text-blue-700">Rank #{r.rank} &bull; {r.score}</span>
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                            {r.snippet}
                          </p>
                          <button
                            type="button"
                            onClick={() => setViewerChunk({ docId: r.document_id, chunkId: r.chunk_id, page: r.page_number })}
                            className="mt-2 text-[10px] text-slate-700 hover:text-slate-900 font-medium flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>Page {r.page_number} in Viewer</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Method B: Semantic Vector */}
                <div className="bg-white rounded-md border border-slate-200 p-4 shadow-subtle flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                      <h3 className="font-semibold text-xs text-slate-900">B. Dense Semantic Vector</h3>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Cosine Sim</span>
                  </div>
                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px]">
                    {comparison.vector_results.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        No passages retrieved via dense vector similarity.
                      </div>
                    ) : (
                      comparison.vector_results.map((r) => (
                        <div key={r.chunk_id} className="p-3 rounded-md border border-slate-200 bg-slate-50/70">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-semibold text-slate-900 truncate max-w-[140px]">{r.document_title}</span>
                            <span className="font-mono text-purple-700">Rank #{r.rank} &bull; {r.score}</span>
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                            {r.snippet}
                          </p>
                          <button
                            type="button"
                            onClick={() => setViewerChunk({ docId: r.document_id, chunkId: r.chunk_id, page: r.page_number })}
                            className="mt-2 text-[10px] text-slate-700 hover:text-slate-900 font-medium flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>Page {r.page_number} in Viewer</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Method C: Hybrid RRF */}
                <div className="bg-white rounded-md border-2 border-slate-900 p-4 shadow-subtle flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                    <div className="flex items-center space-x-2">
                      <SearchCheck className="w-4 h-4 text-slate-900" />
                      <h3 className="font-semibold text-xs text-slate-900">C. Hybrid Reciprocal Fusion</h3>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">RRF (k=60)</span>
                  </div>
                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px]">
                    {comparison.hybrid_results.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        No passages retrieved via hybrid reciprocal fusion.
                      </div>
                    ) : (
                      comparison.hybrid_results.map((r) => (
                        <div key={r.chunk_id} className="p-3 rounded-md border border-slate-200 bg-slate-50/70">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-semibold text-slate-900 truncate max-w-[140px]">{r.document_title}</span>
                            <span className="font-mono text-slate-900 font-bold">Rank #{r.rank} &bull; {r.score}</span>
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                            {r.snippet}
                          </p>
                          <button
                            type="button"
                            onClick={() => setViewerChunk({ docId: r.document_id, chunkId: r.chunk_id, page: r.page_number })}
                            className="mt-2 text-[10px] text-slate-700 hover:text-slate-900 font-medium flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>Page {r.page_number} in Viewer</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
      </div>

      {viewerChunk && (
        <DocumentViewerModal
          documentId={viewerChunk.docId}
          highlightChunkId={viewerChunk.chunkId}
          highlightPage={viewerChunk.page}
          onClose={() => setViewerChunk(null)}
        />
      )}
    </div>
  );
};
