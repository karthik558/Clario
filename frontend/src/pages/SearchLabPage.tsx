import { PageHeader } from '../components/layout/PageHeader';
import { Select } from '../components/ui/Select';
import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Search,
  Clock,
  Layers,
  SearchCheck,
  BarChart3,
  Award,
  CheckCircle2,
  HelpCircle,
  Play,
  ArrowRight,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import { api } from '../services/api';
import { SearchMethodComparison, BenchmarkSummary } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DocumentViewerModal } from '../components/documents/DocumentViewerModal';

export const SearchLabPage: React.FC = () => {
  const [query, setQuery] = useState('data retention zero data retention ZDR 30 days vs 60 days audit');
  const [topK, setTopK] = useState(5);
  const [comparison, setComparison] = useState<SearchMethodComparison | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkSummary | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingBenchmark, setLoadingBenchmark] = useState(false);
  const [activeTab, setActiveTab] = useState<'methods' | 'benchmark'>('methods');
  const [viewerChunk, setViewerChunk] = useState<{ docId: string; chunkId: string; page: number } | null>(null);

  const executeComparison = async (q: string, k: number) => {
    if (!q.trim()) return;
    setLoadingSearch(true);
    try {
      const data = await api.compareSearchMethods(q, k);
      setComparison(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleRunSearchComparison = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    executeComparison(query, topK);
  };

  useEffect(() => {
    executeComparison(query, topK);
  }, []);

  const handleRunAcademicBenchmark = async () => {
    setLoadingBenchmark(true);
    try {
      const data = await api.runIRBenchmark();
      setBenchmark(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBenchmark(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader title="Search lab" description="Compare keyword, vector, and hybrid search results for the same query.">
        {/* View Switcher Tabs */}
        <div className="flex bg-white rounded-md p-1 border border-clario-border text-xs">
          <button
            aria-pressed={activeTab === 'methods'} onClick={() => setActiveTab('methods')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'methods'
                ? 'bg-clario-navy text-white shadow-xs'
                : 'text-clario-text-secondary hover:text-clario-text'
            }`}
          >
            Live Method Comparison
          </button>
          <button
            onClick={() => {
              setActiveTab('benchmark');
              if (!benchmark) handleRunAcademicBenchmark();
            }}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'benchmark'
                ? 'bg-clario-navy text-white shadow-xs'
                : 'text-clario-text-secondary hover:text-clario-text'
            }`}
          >
            Academic IR Evaluation Suite
          </button>
        </div>
      </PageHeader>

      {activeTab === 'methods' ? (
        <div className="space-y-6">
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
                    onChange={(e) => setTopK(Number(e.target.value))}
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

              {/* Sample Queries */}
              <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] text-slate-500">
                <span className="font-medium">Test queries:</span>
                {[
                  'data retention zero data retention ZDR 30 days vs 60 days audit',
                  'limitation of liability aggregate monetary damages $100 vs $250,000 USD',
                  'cybersecurity breach notification preliminary alert 72 hours forensic report 60 days',
                  'intellectual property Copyright Shield defense indemnification',
                  'HIPAA compliance Business Associate Agreement BAA protected health information',
                  'sovereign EU data boundary regional processing mesh GDPR'
                ].map((sq, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setQuery(sq);
                      executeComparison(sq, topK);
                    }}
                    className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-200 text-slate-700 text-[11px] truncate max-w-[260px] cursor-pointer outline-none focus:outline-none focus:ring-1 focus:ring-slate-300 transition-colors"
                  >
                    "{sq}"
                  </button>
                ))}
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
                    <Badge variant="navy" size="sm">k1=1.5, b=0.75</Badge>
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
                    <Badge variant="gray" size="sm">Cosine Sim</Badge>
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
                    <Badge variant="navy" size="sm">RRF (k=60)</Badge>
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
      ) : (
        /* Academic IR Benchmark View */
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-clario-border">
              <div>
                <h3 className="font-semibold text-sm text-clario-navy">
                  Academic Information Retrieval Evaluation Suite
                </h3>
                <p className="text-xs text-clario-text-secondary mt-0.5">
                  Calculated against verified relevance judgments (qrels) across test queries.
                  Standard IR mathematical definitions (Precision@K, Recall@K, MRR, nDCG@K).
                </p>
              </div>

              <Button
                variant="primary"
                size="md"
                onClick={handleRunAcademicBenchmark}
                loading={loadingBenchmark}
              >
                <Play className="w-4 h-4 mr-1.5" />
                Run Benchmark Suite
              </Button>
            </div>

            {benchmark && (
              <div className="space-y-6">
                {/* Aggregate Mean Scores Comparison */}
                <div>
                  <h4 className="font-semibold text-xs text-clario-navy uppercase tracking-wider mb-3">
                    Aggregate Mean Performance Across Test Suite ({benchmark.total_queries} Test Queries)
                  </h4>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border border-slate-200 rounded-md overflow-hidden">
                      <thead className="bg-slate-50 text-slate-900 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-3">Retrieval Engine</th>
                          <th className="p-3">Precision@3</th>
                          <th className="p-3">Precision@5</th>
                          <th className="p-3">Recall@5</th>
                          <th className="p-3">MRR (Mean Reciprocal Rank)</th>
                          <th className="p-3">nDCG@5</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        <tr className="hover:bg-slate-50">
                          <td className="p-3 font-medium text-slate-900 flex items-center space-x-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <span>BM25 Lexical</span>
                          </td>
                          <td className="p-3 font-mono font-bold text-blue-700">
                            {(benchmark.bm25_mean.precision_at_3 * 100).toFixed(1)}%
                          </td>
                          <td className="p-3 font-mono font-bold text-blue-700">
                            {(benchmark.bm25_mean.precision_at_5 * 100).toFixed(1)}%
                          </td>
                          <td className="p-3 font-mono font-bold text-blue-700">
                            {(benchmark.bm25_mean.recall_at_5 * 100).toFixed(1)}%
                          </td>
                          <td className="p-3 font-mono font-bold text-blue-700">
                            {benchmark.bm25_mean.mrr.toFixed(3)}
                          </td>
                          <td className="p-3 font-mono font-bold text-blue-700">
                            {benchmark.bm25_mean.ndcg_at_5.toFixed(3)}
                          </td>
                        </tr>

                        <tr className="hover:bg-slate-50">
                          <td className="p-3 font-medium text-clario-navy flex items-center space-x-1.5">
                            <span className="w-2 h-2 rounded-full bg-purple-500" />
                            <span>Dense Semantic Vector</span>
                          </td>
                          <td className="p-3 font-mono font-bold text-purple-700">
                            {(benchmark.vector_mean.precision_at_3 * 100).toFixed(1)}%
                          </td>
                          <td className="p-3 font-mono font-bold text-purple-700">
                            {(benchmark.vector_mean.precision_at_5 * 100).toFixed(1)}%
                          </td>
                          <td className="p-3 font-mono font-bold text-purple-700">
                            {(benchmark.vector_mean.recall_at_5 * 100).toFixed(1)}%
                          </td>
                          <td className="p-3 font-mono font-bold text-purple-700">
                            {benchmark.vector_mean.mrr.toFixed(3)}
                          </td>
                          <td className="p-3 font-mono font-bold text-purple-700">
                            {benchmark.vector_mean.ndcg_at_5.toFixed(3)}
                          </td>
                        </tr>

                        <tr className="bg-slate-100 font-semibold border-t-2 border-slate-900">
                          <td className="p-3 text-slate-900 flex items-center space-x-1.5">
                            <SearchCheck className="w-3.5 h-3.5 text-slate-900" />
                            <span>Hybrid RRF (Combined)</span>
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-900">
                            {(benchmark.hybrid_mean.precision_at_3 * 100).toFixed(1)}%
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-900">
                            {(benchmark.hybrid_mean.precision_at_5 * 100).toFixed(1)}%
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-900">
                            {(benchmark.hybrid_mean.recall_at_5 * 100).toFixed(1)}%
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-900">
                            {benchmark.hybrid_mean.mrr.toFixed(3)}
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-900">
                            {benchmark.hybrid_mean.ndcg_at_5.toFixed(3)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Per-Query Breakdown */}
                <div>
                  <h4 className="font-semibold text-xs text-clario-navy uppercase tracking-wider mb-3">
                    Per-Query Rigorous Breakdown
                  </h4>
                  <div className="space-y-3">
                    {benchmark.queries.map((q) => (
                      <div key={q.query_id} className="p-3.5 rounded-md border border-clario-border bg-white text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-clario-navy">
                            Query [{q.query_id}]: "{q.query_text}"
                          </span>
                          <span className="text-[10px] text-clario-text-secondary">
                            {q.relevant_doc_ids.length} ground-truth document(s)
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                          <div className="p-2 rounded-md bg-blue-50/50 border border-blue-200">
                            <span className="font-semibold text-blue-900 block mb-0.5">BM25</span>
                            <span className="font-mono text-blue-800">
                              P@3: {(q.bm25_metrics.precision_at_3 * 100).toFixed(0)}% &bull; MRR: {q.bm25_metrics.mrr.toFixed(2)} &bull; nDCG: {q.bm25_metrics.ndcg_at_5.toFixed(2)}
                            </span>
                          </div>

                          <div className="p-2 rounded-md bg-purple-50/50 border border-purple-200">
                            <span className="font-semibold text-purple-900 block mb-0.5">Vector</span>
                            <span className="font-mono text-purple-800">
                              P@3: {(q.vector_metrics.precision_at_3 * 100).toFixed(0)}% &bull; MRR: {q.vector_metrics.mrr.toFixed(2)} &bull; nDCG: {q.vector_metrics.ndcg_at_5.toFixed(2)}
                            </span>
                          </div>

                          <div className="p-2 rounded-md bg-emerald-50/50 border border-emerald-200">
                            <span className="font-semibold text-emerald-900 block mb-0.5">Hybrid RRF</span>
                            <span className="font-mono text-emerald-800">
                              P@3: {(q.hybrid_metrics.precision_at_3 * 100).toFixed(0)}% &bull; MRR: {q.hybrid_metrics.mrr.toFixed(2)} &bull; nDCG: {q.hybrid_metrics.ndcg_at_5.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

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
