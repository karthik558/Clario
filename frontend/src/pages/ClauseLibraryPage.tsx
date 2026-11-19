import { PageHeader } from '../components/layout/PageHeader';
import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Scale,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Search,
  Check,
  Send,
  Layers,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import { ClauseLibraryResponse, ClauseAnalysisResult, DocumentItem } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export const ClauseLibraryPage: React.FC = () => {
  const [data, setData] = useState<ClauseLibraryResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [clauseInput, setClauseInput] = useState('');
  const [analysisResult, setAnalysisResult] = useState<ClauseAnalysisResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Limitation of Liability');

  const fetchLibrary = async () => {
    try {
      setLoading(true);
      const [libRes, docs] = await Promise.all([
        api.getClauseBenchmarks().catch(() => null),
        api.getDocuments().catch(() => [])
      ]);
      if (libRes) setData(libRes);
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load clause library', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLibrary();
  }, []);

  const handleAnalyzeClause = async () => {
    if (!clauseInput.trim()) return;
    try {
      setAnalyzing(true);
      const res = await api.analyzeClause(clauseInput);
      setAnalysisResult(res);
    } catch (err) {
      console.error('Clause analysis failed', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const activeBenchmark =
    data?.benchmarks.find((b) => b.category === selectedCategory) ||
    data?.benchmarks[0];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader title="Clause library" description="Explore standard clauses and compare terms against market benchmarks." />

      {/* Non-Contract Scope Notice */}
      {documents.length > 0 && data && data.benchmarks.every(b => b.detected_count === 0) && (
        <Card className="p-4 bg-slate-50 border border-slate-200 shadow-xs flex items-start gap-3">
          <div className="w-8 h-8 rounded-md bg-slate-200 flex items-center justify-center text-slate-700 shrink-0 mt-0.5">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Document Scope: Non-Contractual Records
            </h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Active workspace document(s) (e.g. '{documents[0]?.title}') contain operational and financial data rather than commercial contract covenants. Standard market benchmarks below are provided for reference. You can test any clause in the benchmark sandbox below or upload contracts (MSAs, NDAs, SLAs) to extract active clauses.
            </p>
          </div>
        </Card>
      )}

      {/* KPI Stat Cards matching Overview and Documents */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Clause Categories
            </span>
            <div className="p-1.5 rounded bg-slate-100 text-slate-700">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {data ? data.total_categories : 5}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Standard taxonomies
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Indexed Documents
            </span>
            <div className="p-1.5 rounded bg-slate-100 text-slate-700">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {documents.length}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Contract repository
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Critical Standards
            </span>
            <div className="p-1.5 rounded bg-rose-50 text-rose-600">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-rose-600 font-mono">
            {data ? data.benchmarks.filter((b) => b.risk_weight === 'Critical').length : 2}
          </span>
          <span className="text-[10px] text-rose-500 font-medium mt-1">
            Liability & Privacy
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Market Norms
            </span>
            <div className="p-1.5 rounded bg-slate-100 text-slate-700">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            Fortune 500
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Standard commercial
          </span>
        </Card>
      </div>

      {/* Clause Analysis Sandbox */}
      <Card className="p-5 bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Interactive Clause Favorability Benchmarker
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Test any clause to evaluate deviation from market norms, favorability rating, and recommended redline strategy.
          </p>
        </div>

        <div className="space-y-3">
          <textarea
            rows={3}
            value={clauseInput}
            onChange={(e) => setClauseInput(e.target.value)}
            placeholder="Paste any clause to benchmark against market standards (e.g. 'Customer aggregate liability shall be capped at 100 USD...')"
            className="w-full text-xs font-mono p-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white text-slate-900"
          />

          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleAnalyzeClause}
              loading={analyzing}
              disabled={!clauseInput.trim()}
              className="flex items-center gap-1.5"
            >
              <Send className="w-3 h-3" />
              <span>Benchmark Against Market</span>
            </Button>
          </div>
        </div>

        {analysisResult && (
          <div className="p-4 rounded-md bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Favorability Rating:
                </span>
                <Badge
                  variant={
                    analysisResult.alignment_score >= 70
                      ? 'sage'
                      : analysisResult.alignment_score >= 50
                      ? 'gold'
                      : 'red'
                  }
                  size="sm"
                >
                  {analysisResult.favorability}
                </Badge>
              </div>
              <span className="text-xs font-mono font-bold text-slate-900">
                Alignment Score: {analysisResult.alignment_score}/100
              </span>
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 block mb-1">
                Recommendation:
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">
                {analysisResult.recommendation}
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Category Tabs */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
          Standard Market Benchmarks & Detected Provisions
        </h2>

        <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-1">
          {data?.benchmarks.map((b) => {
            const isActive = selectedCategory === b.category;
            return (
              <button
                key={b.category}
                onClick={() => setSelectedCategory(b.category)}
                className={`flex items-center gap-2 px-3 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 ${
                  isActive
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <span>{b.category}</span>
                <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                  {b.detected_count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Benchmark Detail */}
        {activeBenchmark && (
          <div className="space-y-4">
            <Card className="p-5 bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900">
                    {activeBenchmark.category}
                  </h3>
                  <Badge
                    variant={activeBenchmark.risk_weight === 'Critical' ? 'red' : 'gold'}
                    size="sm"
                  >
                    {activeBenchmark.risk_weight} Risk Weight
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 bg-slate-50 rounded-md border border-slate-200 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Market Standard Benchmark
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {activeBenchmark.market_standard}
                  </p>
                </div>

                <div className="p-3.5 bg-rose-50/60 rounded-md border border-rose-200 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    Common Counterparty Trap
                  </span>
                  <p className="text-xs text-rose-900 leading-relaxed">
                    {activeBenchmark.common_pitfall}
                  </p>
                </div>
              </div>
            </Card>

            {/* Detected Clauses in Corpus */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Clauses Extracted in Workspace ({activeBenchmark.clauses.length})
              </h4>

              {activeBenchmark.clauses.length === 0 ? (
                <Card className="p-6 text-center bg-white border border-slate-200">
                  <p className="text-xs text-slate-500">
                    No matching provisions discovered in current documents.
                  </p>
                </Card>
              ) : (
                activeBenchmark.clauses.map((clause, idx) => (
                  <Card key={idx} className="p-4 bg-white border border-slate-200 shadow-xs space-y-2">
                    <div className="flex flex-wrap gap-2 items-center justify-between text-xs pb-1.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-semibold text-slate-900 [overflow-wrap:anywhere]">{clause.document_title}</span>
                        <span className="text-slate-400 font-mono text-[11px]">
                          Page {clause.page_number}
                        </span>
                      </div>
                      <Badge
                        variant={clause.favorability === 'Vendor Favorable' ? 'gold' : 'sage'}
                        size="sm"
                      >
                        {clause.favorability}
                      </Badge>
                    </div>
                    <p className="text-xs font-mono text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-100 leading-relaxed whitespace-pre-wrap">
                      "{clause.text}"
                    </p>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
