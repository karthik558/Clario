import { PageHeader } from '../components/layout/PageHeader';
import { Select } from '../components/ui/Select';
import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  BookmarkPlus,
  Layers,
  SearchCheck,
  Info,
  ChevronDown,
  Scale,
  FileText
} from 'lucide-react';
import { api } from '../services/api';
import { ComparisonResponse, DocumentItem, ContradictionCandidate } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ClauseNegotiatorModal } from '../components/negotiate/ClauseNegotiatorModal';

const getSearchParam = (key: string): string => {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(key) || '';
};

export const ComparePage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docAId, setDocAId] = useState<string>('');
  const [docBId, setDocBId] = useState<string>('');
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [promotedIndices, setPromotedIndices] = useState<number[]>([]);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState('');
  const [negotiateCandidate, setNegotiateCandidate] = useState<ContradictionCandidate | null>(null);

  const changeDocument = (side: 'a' | 'b', value: string) => {
    (side === 'a' ? setDocAId : setDocBId)(value);
    setComparison(null);
    setPromotedIndices([]);
    setError('');
  };

  useEffect(() => {
    const loadDocs = async () => {
      try {
        const docs = await api.getDocuments();
        setDocuments(docs);
        if (docs.length >= 2) {
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

          if (!aId || !bId || aId === bId) {
            const ret1 = docs.find((d) => d.title.includes('2023') || d.title.includes('v1.0'));
            const ret2 = docs.find((d) => d.title.includes('2024') || d.title.includes('v2.0'));
            aId = ret1 ? ret1.id : docs[0].id;
            bId = ret2 && ret2.id !== aId ? ret2.id : (docs[1]?.id || '');
          }

          setDocAId(aId);
          setDocBId(bId);

          // Automatically trigger compare for immediate feedback
          if (aId && bId && aId !== bId) {
            setLoading(true);
            try {
              const data = await api.compareDocuments(aId, bId);
              setComparison(data);
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
    setPromotedIndices([]);
    setError('');
    try {
      const data = await api.compareDocuments(docAId, docBId);
      setComparison(data);
    } catch (err) {
      setError('The comparison could not be completed. Please try again.');
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
      setPromotedIndices(previous => [...previous, index]);
    } catch (err) {
      setError('The finding could not be saved. Please try again.');
    } finally {
      setPromoting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title="Compare versions" description="Choose two documents to review changes, additions, and potential contradictions." />

      {/* Document Selector Card */}
      <Card className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          {/* Doc A Selector */}
          <div className="md:col-span-2">
            <label htmlFor="docAId" className="block text-[11px] font-semibold text-slate-800 uppercase tracking-wider mb-1.5">
              Document A (Base / Prior Version)
            </label>
            <Select id="docAId" value={docAId}
              disabled={loading || promoting}
              onChange={(e) => changeDocument('a', e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-md px-3 py-2.5 focus:outline-none focus:border-slate-900 font-medium text-slate-900 h-[42px]"
            >
              <option value="">Select Document A</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.file_type.toUpperCase()})
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
            <label htmlFor="docBId" className="block text-[11px] font-semibold text-slate-800 uppercase tracking-wider mb-1.5">
              Document B (Target / Revised Version)
            </label>
            <Select id="docBId" value={docBId}
              disabled={loading || promoting}
              onChange={(e) => changeDocument('b', e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-md px-3 py-2.5 focus:outline-none focus:border-slate-900 font-medium text-slate-900 h-[42px]"
            >
              <option value="">Select Document B</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.file_type.toUpperCase()})
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

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {/* Empty State when fewer than 2 documents */}
      {!loading && !comparison && documents.length < 2 && (
        <Card className="p-10 text-center bg-white border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mx-auto mb-3">
            <GitCompare className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 mb-1">
            {documents.length === 0 ? 'No Documents in Workspace' : 'Second Document Required for Comparison'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
            {documents.length === 0
              ? 'Upload at least two document versions or counterparty agreements in the Document Library to perform side-by-side diffing, clause revisions, and contradiction detection.'
              : 'You currently have 1 document indexed. Upload a revised version or counterparty agreement to run comparative difference analysis.'}
          </p>
          <Button variant="secondary" size="sm" onClick={() => { window.location.href = '/documents'; }}>
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Go to Document Library
          </Button>
        </Card>
      )}

      {/* Placeholder prompt when documents >= 2 but comparison not yet run */}
      {!loading && !comparison && documents.length >= 2 && (
        <Card className="p-8 text-center bg-white border border-slate-200">
          <GitCompare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-xs font-semibold text-slate-700 mb-1">Ready for Comparative Diff</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Select Document A and Document B in the selector above and click "Compare" to scan for semantic contradictions, revisions, and clause amendments.
          </p>
        </Card>
      )}

      {/* Comparison Analysis Results */}
      {comparison && (
        <div className="space-y-6 animate-in fade-in">
          {/* Summary Metric Ribbon */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-3 text-center">
              <span className="text-[10px] text-clario-text-muted uppercase tracking-wider block">Similarity Ratio</span>
              <span className="text-xl font-bold text-slate-900 font-mono">
                {(comparison.similarity_score * 100).toFixed(1)}%
              </span>
            </Card>

            <Card className="p-3 text-center bg-emerald-50/50 border-emerald-200">
              <span className="text-[10px] text-emerald-800 uppercase tracking-wider block">Added Segments</span>
              <span className="text-xl font-bold text-emerald-700 font-mono">
                +{comparison.added_tokens_count}
              </span>
            </Card>

            <Card className="p-3 text-center bg-rose-50/50 border-rose-200">
              <span className="text-[10px] text-rose-800 uppercase tracking-wider block">Removed Segments</span>
              <span className="text-xl font-bold text-rose-700 font-mono">
                -{comparison.removed_tokens_count}
              </span>
            </Card>

            <Card className="p-3 text-center bg-amber-50/50 border-amber-200">
              <span className="text-[10px] text-amber-800 uppercase tracking-wider block">Modified Passages</span>
              <span className="text-xl font-bold text-amber-700 font-mono">
                {comparison.changed_sections_count}
              </span>
            </Card>

            <Card className="p-3 text-center border-amber-200 bg-amber-50/30">
              <span className="text-[10px] text-amber-800 uppercase tracking-wider block">Contradictions Flagged</span>
              <span className="text-xl font-bold text-amber-800 font-mono">
                {comparison.contradiction_candidates.length}
              </span>
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
                <p className="text-xs text-clario-text leading-relaxed">
                  {comparison.summary}
                </p>
              </div>
            </div>
          </Card>

          {/* Contradiction Candidates Section */}
          {comparison.contradiction_candidates.length > 0 && (
            <Card className="p-5 border-amber-200 bg-amber-50/15">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-amber-200">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-clario-navy" />
                  <h3 className="font-semibold text-sm text-clario-navy">
                    Substantive Discrepancy Candidates ({comparison.contradiction_candidates.length})
                  </h3>
                </div>
                <span className="text-[11px] text-clario-text-secondary">
                  Subject to human review & confirmation
                </span>
              </div>

              <div className="space-y-4">
                {comparison.contradiction_candidates.map((cand, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-md bg-white border border-amber-200 shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-xs text-clario-navy">{cand.topic}</span>
                        <Badge variant="gold" size="sm">Confidence: {cand.confidence}</Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setNegotiateCandidate(cand)}
                          className="text-xs"
                        >
                          <Scale className="w-3.5 h-3.5 mr-1" />
                          <span>Draft Redline</span>
                        </Button>
                        <Button
                          variant={promotedIndices.includes(idx) ? 'outline' : 'secondary'}
                          size="sm"
                          disabled={promoting || promotedIndices.includes(idx)}
                          onClick={() => handlePromoteFinding(cand, idx)}
                        >
                          {promotedIndices.includes(idx) ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-clario-navy mr-1" />
                              <span>Promoted to Findings</span>
                            </>
                          ) : (
                            <>
                              <BookmarkPlus className="w-3.5 h-3.5 mr-1" />
                              <span>Promote to Finding</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <p className="text-xs text-clario-text leading-relaxed">
                      {cand.explanation}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-md bg-rose-50/60 border border-rose-200">
                        <span className="text-[10px] font-semibold text-rose-800 uppercase block mb-1">
                          {comparison.doc_a.title} (Page {cand.page_a})
                        </span>
                        <p className="text-[11px] text-rose-950 italic">
                          "{cand.statement_a}"
                        </p>
                      </div>

                      <div className="p-3 rounded-md bg-emerald-50/60 border border-emerald-200">
                        <span className="text-[10px] font-semibold text-emerald-800 uppercase block mb-1">
                          {comparison.doc_b.title} (Page {cand.page_b})
                        </span>
                        <p className="text-[11px] text-emerald-950 italic">
                          "{cand.statement_b}"
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Split-Screen Diff View */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-clario-navy">
                Side-by-Side Textual Diff View
              </h3>
              <div className="flex items-center space-x-3 text-[11px] text-clario-text-secondary">
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-400 inline-block" />
                  <span>Added Text</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded bg-rose-400 inline-block" />
                  <span>Removed Text</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded bg-amber-300 inline-block" />
                  <span>Modified Text</span>
                </span>
              </div>
            </div>

            {/* Split Screen Container */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Doc A */}
              <div className="border border-clario-border rounded-md bg-white overflow-hidden shadow-subtle flex flex-col">
                <div className="p-3 bg-clario-navy text-white text-xs font-semibold flex items-center justify-between">
                  <span className="truncate max-w-xs">{comparison.doc_a.title}</span>
                  <Badge variant="sage" size="sm">{comparison.doc_a.file_type.toUpperCase()}</Badge>
                </div>
                <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto text-xs leading-relaxed font-sans text-clario-text">
                  {comparison.diff_blocks.map((block, idx) => {
                    if (block.type === 'delete') {
                      return (
                        <div key={idx} className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-900">
                          <span className="text-[10px] text-rose-600 font-mono block mb-0.5">Removed in Doc B:</span>
                          {block.text_a}
                        </div>
                      );
                    }
                    if (block.type === 'replace') {
                      return (
                        <div key={idx} className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-900">
                          <span className="text-[10px] text-amber-600 font-mono block mb-0.5">Modified:</span>
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
                  <span className="truncate max-w-xs">{comparison.doc_b.title}</span>
                  <Badge variant="navy" size="sm">{comparison.doc_b.file_type.toUpperCase()}</Badge>
                </div>
                <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto text-xs leading-relaxed font-sans text-clario-text">
                  {comparison.diff_blocks.map((block, idx) => {
                    if (block.type === 'insert') {
                      return (
                        <div key={idx} className="p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-900">
                          <span className="text-[10px] text-emerald-600 font-mono block mb-0.5">Added in Doc B:</span>
                          {block.text_b}
                        </div>
                      );
                    }
                    if (block.type === 'replace') {
                      return (
                        <div key={idx} className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-900">
                          <span className="text-[10px] text-amber-600 font-mono block mb-0.5">Modified (New Version):</span>
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
