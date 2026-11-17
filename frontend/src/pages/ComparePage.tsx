import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  BookmarkPlus,
  Layers,
  Sparkles,
  Info,
  ChevronDown
} from 'lucide-react';
import { api } from '../services/api';
import { ComparisonResponse, DocumentItem, ContradictionCandidate } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export const ComparePage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docAId, setDocAId] = useState<string>('');
  const [docBId, setDocBId] = useState<string>('');
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [promotedIndex, setPromotedIndex] = useState<number | null>(null);

  useEffect(() => {
    const loadDocs = async () => {
      try {
        const docs = await api.getDocuments();
        setDocuments(docs);
        if (docs.length >= 2) {
          // Pre-select policies or contracts if available
          const ret1 = docs.find((d) => d.title.includes('2023') || d.title.includes('v1.0'));
          const ret2 = docs.find((d) => d.title.includes('2024') || d.title.includes('v2.0'));
          if (ret1 && ret2) {
            setDocAId(ret1.id);
            setDocBId(ret2.id);
          } else {
            setDocAId(docs[0].id);
            setDocBId(docs[1].id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadDocs();
  }, []);

  const handleCompare = async () => {
    if (!docAId || !docBId || docAId === docBId) return;
    setLoading(true);
    setComparison(null);
    try {
      const data = await api.compareDocuments(docAId, docBId);
      setComparison(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteFinding = async (cand: ContradictionCandidate, index: number) => {
    try {
      await api.createFinding({
        category: 'possible_contradiction',
        title: cand.topic,
        description: cand.explanation,
        severity: cand.confidence === 'high' ? 'high' : 'medium',
        status: 'open',
        doc_a_id: docAId,
        doc_a_title: comparison?.doc_a.title,
        doc_a_page: cand.page_a,
        doc_a_quote: cand.statement_a,
        doc_b_id: docBId,
        doc_b_title: comparison?.doc_b.title,
        doc_b_page: cand.page_b,
        doc_b_quote: cand.statement_b,
        reviewer_notes: 'Promoted directly from Comparative Diff Workbench.'
      });
      setPromotedIndex(index);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-clario-text tracking-tight flex items-center space-x-2">
          <span>Document Comparison Workbench</span>
          <Badge variant="navy" size="sm">Side-by-Side Diff Engine</Badge>
        </h2>
        <p className="text-xs text-clario-text-secondary">
          Compare version revisions, identify added/removed clauses, and detect semantic contradiction candidates
        </p>
      </div>

      {/* Document Selector Card */}
      <Card className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
          {/* Doc A Selector */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold text-clario-navy uppercase tracking-wider mb-1.5">
              Document A (Base / Prior Version)
            </label>
            <select
              value={docAId}
              onChange={(e) => setDocAId(e.target.value)}
              className="w-full text-xs bg-white border border-clario-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-clario-teal font-medium"
            >
              <option value="">Select Document A</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.file_type.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Compare Action Button in Middle */}
          <div className="flex flex-col items-center justify-center pt-2">
            <Button
              variant="secondary"
              size="md"
              disabled={!docAId || !docBId || docAId === docBId || loading}
              loading={loading}
              onClick={handleCompare}
              className="w-full"
            >
              <GitCompare className="w-4 h-4 mr-1.5" />
              Compare
            </Button>
          </div>

          {/* Doc B Selector */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold text-clario-navy uppercase tracking-wider mb-1.5">
              Document B (Target / Revised Version)
            </label>
            <select
              value={docBId}
              onChange={(e) => setDocBId(e.target.value)}
              className="w-full text-xs bg-white border border-clario-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-clario-teal font-medium"
            >
              <option value="">Select Document B</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.file_type.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {docAId === docBId && docAId !== '' && (
          <p className="text-[11px] text-amber-600 mt-2 font-medium">
            Please choose two distinct documents to perform a comparative difference analysis.
          </p>
        )}
      </Card>

      {/* Comparison Analysis Results */}
      {comparison && (
        <div className="space-y-6 animate-in fade-in">
          {/* Summary Metric Ribbon */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-3 text-center">
              <span className="text-[10px] text-clario-text-muted uppercase tracking-wider block">Similarity Ratio</span>
              <span className="text-xl font-bold text-clario-teal font-mono">
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

            <Card className="p-3 text-center border-clario-gold/50 bg-amber-50/30">
              <span className="text-[10px] text-clario-gold-dark uppercase tracking-wider block">Contradictions Flagged</span>
              <span className="text-xl font-bold text-clario-gold-dark font-mono">
                {comparison.contradiction_candidates.length}
              </span>
            </Card>
          </div>

          {/* Executive Comparative Summary */}
          <Card className="p-4 bg-clario-ivory-card border-clario-border">
            <div className="flex items-start space-x-3">
              <Sparkles className="w-5 h-5 text-clario-gold shrink-0 mt-0.5" />
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
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
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
                    className="p-4 rounded-xl bg-white border border-amber-200 shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-xs text-clario-navy">{cand.topic}</span>
                        <Badge variant="gold" size="sm">Confidence: {cand.confidence}</Badge>
                      </div>
                      <Button
                        variant={promotedIndex === idx ? 'outline' : 'secondary'}
                        size="sm"
                        disabled={promotedIndex === idx}
                        onClick={() => handlePromoteFinding(cand, idx)}
                      >
                        {promotedIndex === idx ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1" />
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

                    <p className="text-xs text-clario-text leading-relaxed">
                      {cand.explanation}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-lg bg-rose-50/60 border border-rose-200">
                        <span className="text-[10px] font-semibold text-rose-800 uppercase block mb-1">
                          {comparison.doc_a.title} (Page {cand.page_a})
                        </span>
                        <p className="text-[11px] text-rose-950 italic">
                          "{cand.statement_a}"
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200">
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
              <div className="flex items-center space-x-3 text-[11px]">
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
              <div className="border border-clario-border rounded-xl bg-white overflow-hidden shadow-subtle flex flex-col">
                <div className="p-3 bg-clario-navy text-white text-xs font-semibold flex items-center justify-between">
                  <span className="truncate max-w-xs">{comparison.doc_a.title}</span>
                  <Badge variant="sage" size="sm">{comparison.doc_a.file_type.toUpperCase()}</Badge>
                </div>
                <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto text-xs leading-relaxed font-sans">
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
                        <div key={idx} className="p-1 text-clario-text/80 whitespace-pre-line">
                          {block.text_a}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>

              {/* Right Column: Doc B */}
              <div className="border border-clario-border rounded-xl bg-white overflow-hidden shadow-subtle flex flex-col">
                <div className="p-3 bg-clario-teal text-white text-xs font-semibold flex items-center justify-between">
                  <span className="truncate max-w-xs">{comparison.doc_b.title}</span>
                  <Badge variant="navy" size="sm">{comparison.doc_b.file_type.toUpperCase()}</Badge>
                </div>
                <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto text-xs leading-relaxed font-sans">
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
                        <div key={idx} className="p-1 text-clario-text/80 whitespace-pre-line">
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
    </div>
  );
};
