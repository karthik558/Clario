import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Select } from '../components/ui/Select';
import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  ArrowRight,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  BookmarkPlus,
  Layers,
  SearchCheck,
  Info,
  ChevronDown,
  Scale,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Award,
  TrendingUp,
  BarChart3,
  CheckSquare,
  Square,
  Check,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { api } from '../services/api';
import { useBackgroundTasks } from '../context/BackgroundTaskContext';
import {
  ComparisonResponse,
  DocumentItem,
  ContradictionCandidate,
  MultiComparisonResponse
} from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ClauseNegotiatorModal } from '../components/negotiate/ClauseNegotiatorModal';
import { RiskRadarWidget } from '../components/analytics/RiskRadarWidget';

const getSearchParam = (key: string): string => {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(key) || '';
};

export const ComparePage: React.FC = () => {
  const { startTask } = useBackgroundTasks();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [compareMode, setCompareMode] = useState<'pairwise' | 'multi'>('pairwise');

  // Pairwise State
  const [docAId, setDocAId] = useState<string>('');
  const [docBId, setDocBId] = useState<string>('');
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [promotedIndices, setPromotedIndices] = useState<number[]>([]);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState('');
  const [negotiateCandidate, setNegotiateCandidate] = useState<ContradictionCandidate | null>(null);
  const [riskBenchmark, setRiskBenchmark] = useState<any | null>(null);

  // Multi-Document Comparison State
  const [selectedMultiDocIds, setSelectedMultiDocIds] = useState<string[]>([]);
  const [multiComparison, setMultiComparison] = useState<MultiComparisonResponse | null>(null);
  const [multiLoading, setMultiLoading] = useState(false);
  const [spotlightRiskDocIndex, setSpotlightRiskDocIndex] = useState<number>(0);
  const [spotlightCompareDocIndex, setSpotlightCompareDocIndex] = useState<number>(-1);

  const changeDocument = (side: 'a' | 'b', value: string) => {
    (side === 'a' ? setDocAId : setDocBId)(value);
    setComparison(null);
    setRiskBenchmark(null);
    setPromotedIndices([]);
    setError('');
  };

  useEffect(() => {
    const loadDocs = async () => {
      try {
        const docs = await api.getDocuments();
        setDocuments(docs);
        if (docs.length >= 2) {
          // Pre-populate multi-document selection with all available docs
          setSelectedMultiDocIds(docs.map((d) => d.id));

          const urlDocA = getSearchParam('doc_a');
          const urlDocB = getSearchParam('doc_b');

          let aId = '';
          let bId = '';

          if (urlDocA && docs.some((d) => d.id === urlDocA)) {
            aId = urlDocA;
          }
          if (urlDocB && docs.some((d) => d.id === urlDocB)) {
            bId = urlDocB;
          }

          if (!aId) aId = docs.find((doc) => doc.id !== bId)!.id;
          if (!bId || bId === aId) bId = docs.find((doc) => doc.id !== aId)!.id;

          setDocAId(aId);
          setDocBId(bId);

          // Automatically trigger compare for immediate feedback
          if (aId && bId && aId !== bId) {
            setLoading(true);
            try {
              const [data, bench] = await Promise.all([
                api.compareDocuments(aId, bId),
                api.getRiskBenchmark(aId, bId).catch(() => null)
              ]);
              setComparison(data);
              setRiskBenchmark(bench);
            } catch (compareErr) {
              // Ignore initial auto-compare failure
            } finally {
              setLoading(false);
            }
          }
        }
      } catch (err) {
        setError('Documents could not be loaded. Please try again.');
      }
    };
    loadDocs();
  }, []);

  const handleCompare = async () => {
    if (!docAId || !docBId || docAId === docBId) return;
    setLoading(true);
    setComparison(null);
    setRiskBenchmark(null);
    setPromotedIndices([]);
    setError('');
    try {
      const docAName = documents.find((d) => d.id === docAId)?.title || 'Document A';
      const docBName = documents.find((d) => d.id === docBId)?.title || 'Document B';
      const [data, bench] = await startTask<[ComparisonResponse, any]>({
        title: `Compare: ${docAName} vs ${docBName}`,
        category: 'scan',
        targetScope: `${docAName} vs ${docBName}`,
        route: `/compare?doc_a=${docAId}&doc_b=${docBId}`,
        initialStage: 'Aligning passages and vector chunks...',
        executor: async (updateProgress) => {
          updateProgress(30, 'Computing semantic diffs and discrepancies...', 'Matching clauses');
          await new Promise((r) => setTimeout(r, 250));
          const [resData, resBench] = await Promise.all([
            api.compareDocuments(docAId, docBId),
            api.getRiskBenchmark(docAId, docBId).catch(() => null)
          ]);
          updateProgress(100, 'Comparison completed', 'Diffs and risk benchmark aligned');
          return [resData, resBench];
        },
      });
      setComparison(data);
      setRiskBenchmark(bench);
    } catch (err) {
      setError('The comparison could not be completed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMultiCompare = async (targetDocIds?: string[]) => {
    const idsToRun = targetDocIds || selectedMultiDocIds;
    if (idsToRun.length < 2) {
      setError('Please select at least 2 documents to compare.');
      return;
    }
    setMultiLoading(true);
    setError('');
    try {
      const data = await startTask<MultiComparisonResponse>({
        title: `Multi-Policy Benchmark: ${idsToRun.length} Documents`,
        category: 'scan',
        targetScope: `${idsToRun.length} Policies`,
        route: '/compare',
        initialStage: 'Compiling cross-policy comparative matrix...',
        executor: async (updateProgress) => {
          updateProgress(35, 'Analyzing 6-pillar risk profiles and cross-similarities...', 'Synthesizing');
          await new Promise((r) => setTimeout(r, 250));
          const res = await api.compareMultipleDocuments(idsToRun);
          updateProgress(100, 'Multi-policy benchmark completed', 'Cross-comparison matrix generated');
          return res;
        }
      });
      setMultiComparison(data);
      setSpotlightRiskDocIndex(0);
      setSpotlightCompareDocIndex(-1);
    } catch (err) {
      setError('Multi-document comparison failed. Please try again.');
    } finally {
      setMultiLoading(false);
    }
  };

  const toggleMultiDoc = (id: string) => {
    setSelectedMultiDocIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((d) => d !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const selectAllMultiDocs = () => {
    setSelectedMultiDocIds(documents.map((d) => d.id));
  };

  const clearMultiDocs = () => {
    setSelectedMultiDocIds([]);
  };

  const handleOpenPairwiseRedline = async (aId: string, bId: string) => {
    setDocAId(aId);
    setDocBId(bId);
    setCompareMode('pairwise');
    setComparison(null);
    setRiskBenchmark(null);
    setLoading(true);
    try {
      const [resData, resBench] = await Promise.all([
        api.compareDocuments(aId, bId),
        api.getRiskBenchmark(aId, bId).catch(() => null)
      ]);
      setComparison(resData);
      setRiskBenchmark(resBench);
    } catch {
      setError('Failed to load bilateral comparison.');
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteFinding = async (cand: ContradictionCandidate, index: number) => {
    if (!comparison || promoting || promotedIndices.includes(index)) return;
    setPromoting(true);
    setError('');
    try {
      await api.createFinding({
        category: 'possible_contradiction',
        title: cand.topic,
        description: cand.explanation,
        severity: cand.confidence === 'high' ? 'high' : 'medium',
        status: 'open',
        doc_a_id: comparison.doc_a.id,
        doc_a_title: comparison?.doc_a.title,
        doc_a_page: cand.page_a,
        doc_a_quote: cand.statement_a,
        doc_b_id: comparison.doc_b.id,
        doc_b_title: comparison?.doc_b.title,
        doc_b_page: cand.page_b,
        doc_b_quote: cand.statement_b,
        reviewer_notes: 'Promoted directly from Comparative Diff Workbench.'
      });
      setPromotedIndices((previous) => [...previous, index]);
    } catch (err) {
      setError('The finding could not be saved. Please try again.');
    } finally {
      setPromoting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Compare versions"
        description="Benchmark and compare two or multiple enterprise policies to review changes, risk differentials, and contradictions."
      >
        {docAId && docBId && docAId !== docBId && (
          <Link
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
            to={{
              pathname: '/ask',
              search: new URLSearchParams([
                ['document', docAId],
                ['document', docBId]
              ]).toString()
            }}
          >
            Ask AI about these files
          </Link>
        )}
      </PageHeader>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCompareMode('pairwise')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              compareMode === 'pairwise'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Pairwise Redline (2 Files)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCompareMode('multi');
              if (!multiComparison && selectedMultiDocIds.length >= 2 && !multiLoading) {
                handleMultiCompare();
              }
            }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              compareMode === 'multi'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Multi-Document Matrix (3+ Files)</span>
            <span className={`ml-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
              compareMode === 'multi' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-800'
            }`}>
              {documents.length} Available
            </span>
          </button>
        </div>
      </div>

      {/* Mode 1: Pairwise Document Selector */}
      {compareMode === 'pairwise' && (
        <Card className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            {/* Doc A Selector */}
            <div className="md:col-span-2">
              <label
                htmlFor="docAId"
                className="block text-[11px] font-semibold text-slate-800 uppercase tracking-wider mb-1.5"
              >
                Document A (Base / Prior Version)
              </label>
              <Select
                id="docAId"
                aria-label="Document A (Base / Prior Version)"
                value={docAId}
                disabled={loading || promoting}
                onChange={(e) => changeDocument('a', e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-md px-3 py-2.5 focus:outline-none focus:border-slate-900 font-medium text-slate-900 h-[42px]"
              >
                <option value="">Select Document A</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title.replace(/_/g, ' ')} ({d.file_type.toUpperCase()})
                  </option>
                ))}
              </Select>
            </div>

            {/* Compare Action Button in Middle */}
            <div className="flex flex-col justify-end">
              <Button
                variant="secondary"
                size="md"
                disabled={!docAId || !docBId || docAId === docBId || loading || promoting}
                loading={loading}
                onClick={handleCompare}
                className="w-full h-[42px] flex items-center justify-center font-medium"
              >
                <GitCompare className="w-4 h-4 mr-1.5 shrink-0" />
                <span>Compare</span>
              </Button>
            </div>

            {/* Doc B Selector */}
            <div className="md:col-span-2">
              <label
                htmlFor="docBId"
                className="block text-[11px] font-semibold text-slate-800 uppercase tracking-wider mb-1.5"
              >
                Document B (Target / Revised Version)
              </label>
              <Select
                id="docBId"
                aria-label="Document B (Target / Revised Version)"
                value={docBId}
                disabled={loading || promoting}
                onChange={(e) => changeDocument('b', e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-md px-3 py-2.5 focus:outline-none focus:border-slate-900 font-medium text-slate-900 h-[42px]"
              >
                <option value="">Select Document B</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title.replace(/_/g, ' ')} ({d.file_type.toUpperCase()})
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {docAId === docBId && docAId !== '' && (
            <p className="text-[11px] text-amber-600 mt-2 font-medium">
              Please choose two distinct documents to perform a comparative difference analysis.
            </p>
          )}
        </Card>
      )}

      {/* Mode 2: Multi-Document Multi-Selector */}
      {compareMode === 'multi' && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Select 3 or More Documents for Cross-Benchmark
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Simultaneously benchmark risk indicators, contract posture, and pairwise cross-similarity across multiple agreements.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllMultiDocs}
                className="text-xs text-slate-600 hover:text-slate-900"
              >
                Select All ({documents.length})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearMultiDocs}
                className="text-xs text-slate-600 hover:text-slate-900"
              >
                Clear
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={selectedMultiDocIds.length < 2 || multiLoading}
                loading={multiLoading}
                onClick={() => handleMultiCompare()}
                className="flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Benchmark {selectedMultiDocIds.length} Documents</span>
              </Button>
            </div>
          </div>

          {/* Multi-Document Selection Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {documents.map((doc) => {
              const isChecked = selectedMultiDocIds.includes(doc.id);
              return (
                <div
                  key={doc.id}
                  onClick={() => toggleMultiDoc(doc.id)}
                  className={`p-3 rounded-md border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                    isChecked
                      ? 'border-slate-900 bg-slate-50/80 shadow-xs ring-1 ring-slate-900'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="mt-0.5 shrink-0 text-slate-700">
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-slate-900" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-slate-900 block truncate" title={doc.title.replace(/_/g, ' ')}>
                      {doc.title.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                      {doc.file_type.toUpperCase()} &bull; {doc.chunk_count} chunks
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedMultiDocIds.length < 2 && (
            <p className="text-[11px] text-amber-600 font-medium">
              Select at least 2 documents (or 3+ for comprehensive portfolio cross-analysis).
            </p>
          )}
        </Card>
      )}

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {/* Empty State when fewer than 2 documents */}
      {!loading && !multiLoading && !comparison && !multiComparison && documents.length < 2 && (
        <Card className="p-10 text-center bg-white border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mx-auto mb-3">
            <GitCompare className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 mb-1">
            {documents.length === 0 ? 'No Documents in Workspace' : 'Second Document Required for Comparison'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
            Upload at least two documents in the Document Library to perform side-by-side diffing and multi-document benchmark analysis.
          </p>
          <Button variant="secondary" size="sm" onClick={() => { window.location.href = '/documents'; }}>
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Go to Document Library
          </Button>
        </Card>
      )}

      {/* Pairwise Placeholder Prompt */}
      {compareMode === 'pairwise' && !loading && !comparison && documents.length >= 2 && (
        <Card className="p-8 text-center bg-white border border-slate-200">
          <GitCompare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-xs font-semibold text-slate-700 mb-1">Ready for Comparative Diff</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Select Document A and Document B above and click "Compare" to scan for semantic contradictions, revisions, and clause amendments.
          </p>
        </Card>
      )}

      {/* ======================================================== */}
      {/* MULTI-DOCUMENT COMPARISON RESULTS                        */}
      {/* ======================================================== */}
      {compareMode === 'multi' && multiComparison && (
        <div className="space-y-6 animate-in fade-in">
          {/* Executive Stats Ribbon */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 flex flex-col justify-between hover:border-slate-300 transition-all shadow-subtle rounded-md">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[10.5px] font-bold uppercase tracking-wider">Agreements Analyzed</span>
                <Layers className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <span className="text-2xl font-semibold tracking-tight tabular-nums text-slate-900 font-mono">
                {multiComparison.total_documents}
              </span>
              <span className="text-[10px] text-slate-500 font-medium mt-1">Simultaneous multi-policy review</span>
            </Card>

            <Card className="p-4 flex flex-col justify-between hover:border-slate-300 transition-all shadow-subtle rounded-md">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[10.5px] font-bold uppercase tracking-wider">Market Protective Leader</span>
                <Award className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-900 truncate" title={multiComparison.documents[0]?.document_title.replace(/_/g, ' ')}>
                {multiComparison.documents[0]?.document_title.replace(/_/g, ' ')}
              </span>
              <span className="text-[10px] text-emerald-600 font-medium mt-1 font-mono">
                Score: {multiComparison.documents[0]?.composite_score}/100 &bull; Grade {multiComparison.documents[0]?.composite_grade.split(' ')[0]}
              </span>
            </Card>

            <Card className="p-4 flex flex-col justify-between hover:border-slate-300 transition-all shadow-subtle rounded-md">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[10.5px] font-bold uppercase tracking-wider">Portfolio Average Score</span>
                <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <span className="text-2xl font-semibold tracking-tight tabular-nums text-slate-900 font-mono">
                {(
                  multiComparison.documents.reduce((acc, d) => acc + d.composite_score, 0) /
                  multiComparison.documents.length
                ).toFixed(1)} <span className="text-xs text-slate-400 font-normal">/ 100</span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium mt-1">Cross-vendor commercial baseline</span>
            </Card>

            <Card className="p-4 flex flex-col justify-between hover:border-slate-300 transition-all shadow-subtle rounded-md">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[10.5px] font-bold uppercase tracking-wider">Pairwise Combinations</span>
                <GitCompare className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <span className="text-2xl font-semibold tracking-tight tabular-nums text-slate-900 font-mono">
                {multiComparison.pairwise_matrix.length}
              </span>
              <span className="text-[10px] text-slate-500 font-medium mt-1">Diff & contradiction vectors</span>
            </Card>
          </div>

          {/* Automated Multi-Policy Executive Synthesis */}
          <Card className="p-4 bg-white border border-slate-200">
            <div className="flex items-start space-x-3">
              <SearchCheck className="w-5 h-5 text-slate-900 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-xs text-slate-900 uppercase tracking-wider mb-1">
                  Automated Multi-Document Comparative Synthesis
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed font-sans">
                  {multiComparison.executive_synthesis}
                </p>
              </div>
            </div>
          </Card>

          {/* 6-Pillar Key Market Leaders & Exposure Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {multiComparison.pillar_leaders.map((pl) => (
              <Card key={pl.pillar_id} className="p-3.5 border border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-900 truncate">{pl.pillar_name}</span>
                  <Badge variant="navy" size="sm">Pillar Leader</Badge>
                </div>
                <div className="space-y-1 text-[11px] text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Strongest Protection:</span>
                    <span className="font-semibold text-slate-900 truncate max-w-[150px]">
                      {pl.leader_doc_title.replace(/_/g, ' ')} ({pl.highest_score}/100)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Highest Exposure:</span>
                    <span className="font-semibold text-slate-900 truncate max-w-[150px]">
                      {pl.exposure_doc_title.replace(/_/g, ' ')} ({pl.lowest_score}/100)
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* 6-Pillar Risk Benchmark Matrix Table */}
          <Card className="p-5 border border-slate-200 bg-white space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-slate-800" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                  Side-by-Side 6-Pillar Risk Benchmark Table
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Pillars scored 0-100 (Higher = Stronger Customer Protection)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider bg-slate-50">
                    <th className="py-2.5 px-3 min-w-[200px]">Risk Dimension</th>
                    {multiComparison.documents.map((doc) => (
                      <th key={doc.document_id} className="py-2.5 px-3 min-w-[160px]">
                        <div className="truncate max-w-[180px] font-bold text-slate-900" title={doc.document_title.replace(/_/g, ' ')}>
                          {doc.document_title.replace(/_/g, ' ')}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[11px] font-bold text-slate-800">{doc.composite_score}/100</span>
                          <span className="text-[10px] text-slate-500 font-normal">Grade {doc.composite_grade.split(' ')[0]}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {/* Rows for each pillar */}
                  {multiComparison.documents[0]?.pillars.map((pillarSample) => {
                    const pid = pillarSample.id;
                    const pname = pillarSample.name;
                    // Find max score for this pillar to highlight best in class
                    const maxScore = Math.max(
                      ...multiComparison.documents.map(
                        (d) => d.pillars.find((p) => p.id === pid)?.score || 0
                      )
                    );

                    return (
                      <tr key={pid} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-900 bg-slate-50/40">
                          {pname}
                        </td>
                        {multiComparison.documents.map((doc) => {
                          const p = doc.pillars.find((item) => item.id === pid);
                          if (!p) return <td key={doc.document_id} className="py-3 px-3">-</td>;
                          const isBest = p.score === maxScore && maxScore > 0;
                          return (
                            <td key={doc.document_id} className={`py-3 px-3 ${isBest ? 'bg-slate-50/60 font-semibold' : ''}`}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="font-mono font-bold text-slate-900">{p.score}</span>
                                <span className="text-[10px] text-slate-400">/100</span>
                                {isBest && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-900 text-white">
                                    Best
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                {typeof p.findings?.[0] === 'string'
                                  ? p.findings[0]
                                  : (p.findings?.[0] as any)?.text || p.recommendation}
                              </p>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {/* Summary Rows */}
                  <tr className="bg-slate-50/60 font-medium">
                    <td className="py-3 px-3 font-semibold text-slate-900">Strongest Protection</td>
                    {multiComparison.documents.map((doc) => (
                      <td key={doc.document_id} className="py-3 px-3 text-slate-800 text-[11px]">
                        {doc.strongest_protection?.name || 'Standard'}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-slate-50/60 font-medium">
                    <td className="py-3 px-3 font-semibold text-slate-900">Primary Exposure Flag</td>
                    {multiComparison.documents.map((doc) => (
                      <td key={doc.document_id} className="py-3 px-3 text-slate-800 text-[11px]">
                        {doc.highest_risk_area?.name || 'Standard'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pairwise Cross-Similarity & Discrepancy Matrix */}
          <Card className="p-5 border border-slate-200 bg-white space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <GitCompare className="w-4 h-4 text-slate-800" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                  Pairwise Cross-Similarity & Discrepancy Matrix
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Click any cell or "Redline" to open direct bilateral diff
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {multiComparison.pairwise_matrix.map((pm, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-md border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-between bg-white shadow-2xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5 text-xs font-semibold text-slate-900">
                      <span className="truncate max-w-[120px]" title={pm.doc_a_title.replace(/_/g, ' ')}>
                        {pm.doc_a_title.replace(/_/g, ' ')}
                      </span>
                      <span className="text-slate-400 text-[10px]">vs</span>
                      <span className="truncate max-w-[120px]" title={pm.doc_b_title.replace(/_/g, ' ')}>
                        {pm.doc_b_title.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 my-2 py-1.5 border-y border-slate-100 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Similarity</span>
                        <span className="font-mono font-bold text-slate-900">
                          {(pm.similarity_score * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Contradictions</span>
                        <span className="font-mono font-bold text-slate-900">
                          {pm.contradiction_count} flagged
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenPairwiseRedline(pm.doc_a_id, pm.doc_b_id)}
                    className="w-full text-xs flex items-center justify-center gap-1.5 mt-2"
                  >
                    <span>Open Bilateral Redline</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          {/* Interactive Radar Topology Spotlight */}
          <Card className="p-5 border border-slate-200 bg-white space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-slate-800" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                  Interactive 6-Pillar Radar Topology Spotlight
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 font-medium">Spotlight:</span>
                  <Select
                    aria-label="Spotlight document"
                    value={String(spotlightRiskDocIndex)}
                    onChange={(e) => setSpotlightRiskDocIndex(Number(e.target.value))}
                    className="text-xs h-8 min-w-[200px] py-1 px-2.5 bg-white border border-slate-200 rounded-md font-medium text-slate-800"
                  >
                    {multiComparison.documents.map((d, idx) => (
                      <option key={d.document_id} value={String(idx)}>
                        {d.document_title.replace(/_/g, ' ')} ({d.composite_score}/100)
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 font-medium">Benchmark vs:</span>
                  <Select
                    aria-label="Benchmark document vs"
                    value={String(spotlightCompareDocIndex)}
                    onChange={(e) => setSpotlightCompareDocIndex(Number(e.target.value))}
                    className="text-xs h-8 min-w-[180px] py-1 px-2.5 bg-white border border-slate-200 rounded-md font-medium text-slate-800"
                  >
                    <option value="-1">None (Standalone)</option>
                    {multiComparison.documents.map((d, idx) => {
                      if (idx === spotlightRiskDocIndex) return null;
                      return (
                        <option key={d.document_id} value={String(idx)}>
                          {d.document_title.replace(/_/g, ' ')} ({d.composite_score}/100)
                        </option>
                      );
                    })}
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-center py-4 bg-slate-50/50 rounded-md border border-slate-100">
              <RiskRadarWidget
                size={340}
                primarySeries={{
                  label: multiComparison.documents[spotlightRiskDocIndex]?.document_title.replace(/_/g, ' '),
                  pillars: multiComparison.documents[spotlightRiskDocIndex]?.pillars || [],
                }}
                comparisonSeries={
                  spotlightCompareDocIndex >= 0 && multiComparison.documents[spotlightCompareDocIndex]
                    ? {
                        label: multiComparison.documents[spotlightCompareDocIndex]?.document_title.replace(/_/g, ' '),
                        pillars: multiComparison.documents[spotlightCompareDocIndex]?.pillars || [],
                      }
                    : undefined
                }
              />
            </div>
          </Card>
        </div>
      )}

      {/* ======================================================== */}
      {/* PAIRWISE COMPARISON RESULTS (2 Documents)                */}
      {/* ======================================================== */}
      {compareMode === 'pairwise' && comparison && (
        <div className="space-y-6 animate-in fade-in">
          {/* Summary Metric Ribbon matching Overview and Documents */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
              <div className="flex items-center justify-between text-clario-text-secondary mb-3">
                <span className="text-[10.5px] font-bold uppercase tracking-wider">Similarity Ratio</span>
                <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
                  <GitCompare className="w-3.5 h-3.5" />
                </div>
              </div>
              <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
                {(comparison.similarity_score * 100).toFixed(1)}%
              </span>
              <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Cross-clause match</span>
            </Card>

            <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
              <div className="flex items-center justify-between text-clario-text-secondary mb-3">
                <span className="text-[10.5px] font-bold uppercase tracking-wider">Added Segments</span>
                <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <span className="text-2xl font-semibold tracking-tight tabular-nums text-emerald-700 font-mono">
                +{comparison.added_tokens_count}
              </span>
              <span className="text-[10px] text-emerald-600 font-medium mt-1">New provisions in Doc B</span>
            </Card>

            <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
              <div className="flex items-center justify-between text-clario-text-secondary mb-3">
                <span className="text-[10.5px] font-bold uppercase tracking-wider">Removed Segments</span>
                <div className="p-1.5 rounded-md bg-rose-50 text-rose-700">
                  <AlertCircle className="w-3.5 h-3.5" />
                </div>
              </div>
              <span className="text-2xl font-semibold tracking-tight tabular-nums text-rose-700 font-mono">
                -{comparison.removed_tokens_count}
              </span>
              <span className="text-[10px] text-rose-600 font-medium mt-1">Omitted in revised version</span>
            </Card>

            <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
              <div className="flex items-center justify-between text-clario-text-secondary mb-3">
                <span className="text-[10.5px] font-bold uppercase tracking-wider">Modified Passages</span>
                <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
                  <FileText className="w-3.5 h-3.5" />
                </div>
              </div>
              <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
                {comparison.changed_sections_count}
              </span>
              <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Edited paragraphs</span>
            </Card>

            <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
              <div className="flex items-center justify-between text-clario-text-secondary mb-3">
                <span className="text-[10.5px] font-bold uppercase tracking-wider">Contradictions</span>
                <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
              </div>
              <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
                {comparison.contradiction_candidates.length}
              </span>
              <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Flagged for review</span>
            </Card>
          </div>

          {/* Executive Comparative Summary */}
          <Card className="p-4 bg-white border border-slate-200">
            <div className="flex items-start space-x-3">
              <SearchCheck className="w-5 h-5 text-clario-navy shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-xs text-clario-navy uppercase tracking-wider mb-1">
                  Automated Comparative Synthesis
                </h4>
                <p className="text-xs text-clario-text-secondary leading-relaxed font-sans">
                  {comparison.summary}
                </p>
              </div>
            </div>
          </Card>

          {/* 6-Pillar Risk Benchmark & Protection Index */}
          {riskBenchmark && !riskBenchmark.error && (
            <Card className="p-6 bg-white border border-slate-200 shadow-subtle space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-clario-border">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 rounded-md bg-clario-navy/5 text-clario-navy">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-clario-navy tracking-tight">
                      Contract Risk Benchmark & Protection Index
                    </h3>
                    <p className="text-xs text-clario-text-secondary mt-0.5">
                      Autonomous 6-pillar comparison analyzing customer risk exposure and commercial advantage.
                    </p>
                  </div>
                </div>

                {/* Overall Advantage Banner */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Protective Stance Advantage:
                  </span>
                  <Badge variant="navy" size="md">
                    {riskBenchmark.overall_winner}
                  </Badge>
                </div>
              </div>

              {/* Top Score Comparison Ribbon */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">
                      Doc A Protection Score
                    </span>
                    <span className="text-xs font-bold text-slate-900 truncate block max-w-[200px]" title={riskBenchmark.doc_a.document_title}>
                      {riskBenchmark.doc_a.document_title.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold font-mono text-slate-900">
                      {riskBenchmark.doc_a.composite_score}
                    </span>
                    <span className="text-xs text-slate-400 font-mono"> / 100</span>
                    <Badge variant={riskBenchmark.doc_a.composite_score >= 80 ? 'navy' : 'gray'} size="sm" className="block mt-1">
                      {riskBenchmark.doc_a.composite_grade.split(' ')[0]}
                    </Badge>
                  </div>
                </div>

                <div className="p-4 rounded-md bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center">
                  <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                    Score Differential
                  </span>
                  <span className="text-2xl font-bold font-mono text-slate-900 my-1">
                    {riskBenchmark.score_differential} pts
                  </span>
                  <span className="text-[11px] text-slate-600 font-medium">
                    {riskBenchmark.score_differential <= 5
                      ? 'Equivalent Protective Baseline'
                      : `Significant Legal Divergence`}
                  </span>
                </div>

                <div className="p-4 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">
                      Doc B Protection Score
                    </span>
                    <span className="text-xs font-bold text-slate-900 truncate block max-w-[200px]" title={riskBenchmark.doc_b.document_title}>
                      {riskBenchmark.doc_b.document_title.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold font-mono text-slate-900">
                      {riskBenchmark.doc_b.composite_score}
                    </span>
                    <span className="text-xs text-slate-400 font-mono"> / 100</span>
                    <Badge variant={riskBenchmark.doc_b.composite_score >= 80 ? 'navy' : 'gray'} size="sm" className="block mt-1">
                      {riskBenchmark.doc_b.composite_grade.split(' ')[0]}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Radar Topology & Pillar Discrepancy Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch pt-2">
                {/* 6-Pillar Radar Overlay */}
                <div className="lg:col-span-5 flex flex-col items-center justify-between p-4 rounded-md border border-slate-200 bg-slate-50/60 shadow-2xs">
                  <div className="w-full flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Comparative Risk Topology
                    </span>
                    <Badge variant="gray" size="sm">
                      Overlay Benchmark
                    </Badge>
                  </div>
                  <div className="flex-1 flex items-center justify-center my-auto">
                    <RiskRadarWidget
                      size={280}
                      primarySeries={{
                        label: riskBenchmark.doc_a.document_title.replace(/_/g, ' '),
                        pillars: riskBenchmark.doc_a.pillars,
                      }}
                      comparisonSeries={{
                        label: riskBenchmark.doc_b.document_title.replace(/_/g, ' '),
                        pillars: riskBenchmark.doc_b.pillars,
                      }}
                    />
                  </div>
                </div>

                {/* Granular Pillar Score Differences */}
                <div className="lg:col-span-7 flex flex-col justify-between space-y-2">
                  {riskBenchmark.pillar_comparisons.map((pc: any) => {
                    const scoreDiff = pc.doc_a_score - pc.doc_b_score;
                    return (
                      <div
                        key={pc.pillar_id}
                        className="p-3 rounded-md border border-slate-200 bg-white hover:border-slate-300 transition-all"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {pc.pillar_name}
                          </span>
                          <Badge
                            variant={
                              pc.winner === 'Parity / Equivalent'
                                ? 'gray'
                                : 'navy'
                            }
                            size="sm"
                          >
                            {pc.winner === 'Parity / Equivalent' ? 'Parity' : pc.winner.replace(/_/g, ' ')}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between text-xs my-1">
                          <span className="text-slate-600 truncate max-w-[180px]">
                            {riskBenchmark.doc_a.document_title.replace(/_/g, ' ')}:{' '}
                            <strong className="font-mono text-slate-900">{pc.doc_a_score}/100</strong>
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {scoreDiff > 0 ? `+${scoreDiff} (Doc A)` : scoreDiff < 0 ? `+${Math.abs(scoreDiff)} (Doc B)` : '0 diff'}
                          </span>
                          <span className="text-slate-600 truncate max-w-[180px] text-right">
                            {riskBenchmark.doc_b.document_title.replace(/_/g, ' ')}:{' '}
                            <strong className="font-mono text-slate-900">{pc.doc_b_score}/100</strong>
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          {pc.advantage}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}

          {/* Substantive Discrepancies & Contradiction Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-xs text-clario-navy uppercase tracking-wider flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-slate-700" />
                <span>Detected Divergences & Clause Amendments ({comparison.contradiction_candidates.length})</span>
              </h3>
              <span className="text-[11px] text-clario-text-secondary">
                Cross-version contradictions detected across SLA, retention, liability, and governance.
              </span>
            </div>

            {comparison.contradiction_candidates.length === 0 ? (
              <Card className="p-6 text-center text-clario-text-secondary text-xs">
                No major semantic contradictions or numerical divergences detected between these two versions.
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {comparison.contradiction_candidates.map((cand, idx) => {
                  const isPromoted = promotedIndices.includes(idx);
                  return (
                    <Card key={idx} className="p-4 border border-clario-border hover:border-clario-navy/20 transition-all">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-clario-navy">{cand.topic}</span>
                            <Badge
                              variant={cand.confidence === 'high' ? 'red' : 'gold'}
                              size="sm"
                            >
                              {cand.confidence.toUpperCase()} CONFIDENCE
                            </Badge>
                          </div>
                          <p className="text-xs text-clario-text-secondary">{cand.explanation}</p>

                          {/* Side-by-Side Comparison Quotes */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
                            <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                {comparison.doc_a.title.replace(/_/g, ' ')} (Page {cand.page_a})
                              </span>
                              <p className="text-slate-800 italic">"{cand.statement_a}"</p>
                            </div>
                            <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                {comparison.doc_b.title.replace(/_/g, ' ')} (Page {cand.page_b})
                              </span>
                              <p className="text-slate-800 italic">"{cand.statement_b}"</p>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons: Redline Negotiation & Save to Findings */}
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setNegotiateCandidate(cand)}
                            className="text-xs flex items-center justify-center font-medium"
                          >
                            <Scale className="w-3.5 h-3.5 mr-1" />
                            <span>Redline</span>
                          </Button>

                          <Button
                            variant={isPromoted ? 'ghost' : 'outline'}
                            size="sm"
                            disabled={isPromoted || promoting}
                            onClick={() => handlePromoteFinding(cand, idx)}
                            className="text-xs flex items-center justify-center"
                          >
                            <BookmarkPlus className="w-3.5 h-3.5 mr-1" />
                            <span>{isPromoted ? 'Logged' : 'Save to Findings'}</span>
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Visual Redline Split Screen Diff */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-xs text-clario-navy uppercase tracking-wider flex items-center space-x-2">
                <FileText className="w-4 h-4 text-slate-700" />
                <span>Side-by-Side Visual Redline Diff</span>
              </h3>
              <div className="flex items-center space-x-4 text-[11px] text-clario-text-secondary">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                  <span className="font-medium text-emerald-800">Added to Doc B</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
                  <span className="font-medium text-rose-800">Removed from Doc A</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                  <span className="font-medium text-amber-800">Modified Text</span>
                </span>
              </div>
            </div>

            {/* Split Screen Container */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Doc A */}
              <div className="border border-clario-border rounded-md bg-white overflow-hidden shadow-subtle flex flex-col">
                <div className="p-3 bg-clario-navy text-white text-xs font-semibold flex items-center justify-between">
                  <span className="truncate max-w-xs">{comparison.doc_a.title.replace(/_/g, ' ')}</span>
                  <Badge variant="navy" size="sm">{comparison.doc_a.file_type.toUpperCase()}</Badge>
                </div>
                <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto text-xs leading-relaxed font-sans text-clario-text">
                  {comparison.diff_blocks.map((block, idx) => {
                    if (block.type === 'delete') {
                      return (
                        <div key={idx} className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-950">
                          <span className="text-[10px] text-rose-700 font-mono block mb-0.5 font-bold">Removed in Doc B:</span>
                          {block.text_a}
                        </div>
                      );
                    }
                    if (block.type === 'replace') {
                      return (
                        <div key={idx} className="p-2.5 rounded-md bg-amber-50 border border-amber-200 text-amber-950">
                          <span className="text-[10px] text-amber-700 font-mono block mb-0.5 font-bold">Modified:</span>
                          {block.text_a}
                        </div>
                      );
                    }
                    if (block.type === 'equal') {
                      return (
                        <div key={idx} className="p-1 text-clario-text/90 whitespace-pre-line">
                          {block.text_a}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>

              {/* Right Column: Doc B */}
              <div className="border border-clario-border rounded-md bg-white overflow-hidden shadow-subtle flex flex-col">
                <div className="p-3 bg-slate-900 text-white text-xs font-semibold flex items-center justify-between">
                  <span className="truncate max-w-xs">{comparison.doc_b.title.replace(/_/g, ' ')}</span>
                  <Badge variant="navy" size="sm">{comparison.doc_b.file_type.toUpperCase()}</Badge>
                </div>
                <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto text-xs leading-relaxed font-sans text-clario-text">
                  {comparison.diff_blocks.map((block, idx) => {
                    if (block.type === 'insert') {
                      return (
                        <div key={idx} className="p-2.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-950">
                          <span className="text-[10px] text-emerald-700 font-mono block mb-0.5 font-bold">Added in Doc B:</span>
                          {block.text_b}
                        </div>
                      );
                    }
                    if (block.type === 'replace') {
                      return (
                        <div key={idx} className="p-2.5 rounded-md bg-amber-50 border border-amber-200 text-amber-950">
                          <span className="text-[10px] text-amber-700 font-mono block mb-0.5 font-bold">Modified (New Version):</span>
                          {block.text_b}
                        </div>
                      );
                    }
                    if (block.type === 'equal') {
                      return (
                        <div key={idx} className="p-1 text-clario-text/90 whitespace-pre-line">
                          {block.text_b}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {negotiateCandidate && (
        <ClauseNegotiatorModal
          isOpen={!!negotiateCandidate}
          onClose={() => setNegotiateCandidate(null)}
          topic={negotiateCandidate.topic}
          statementA={negotiateCandidate.statement_a}
          statementB={negotiateCandidate.statement_b}
          docATitle={comparison?.doc_a.title}
          docBTitle={comparison?.doc_b.title}
          pageA={negotiateCandidate.page_a}
          pageB={negotiateCandidate.page_b}
        />
      )}
    </div>
  );
};
