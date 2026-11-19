import React, { useState, useEffect } from 'react';
import { Copy, Check, Scale, Shield, AlertTriangle, FileText, BookmarkCheck } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { api } from '../../services/api';
import { NegotiateResponse } from '../../types';

interface ClauseNegotiatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  findingId?: string;
  topic?: string;
  statementA?: string;
  statementB?: string;
  docATitle?: string;
  docBTitle?: string;
  pageA?: number;
  pageB?: number;
  onSaved?: () => void;
}

type StanceType = 'balanced' | 'customer_protective' | 'vendor_favorable' | 'strict_compliance';

const STANCES: { id: StanceType; label: string; desc: string }[] = [
  { id: 'balanced', label: 'Balanced Compromise', desc: 'Equal burden sharing, industry-standard mutual terms' },
  { id: 'customer_protective', label: 'Customer Protective', desc: 'Prioritizes customer liability caps, audit rights, and remedies' },
  { id: 'vendor_favorable', label: 'Vendor Favorable', desc: 'Protects IP, limits warranties, standard service disclaimers' },
  { id: 'strict_compliance', label: 'Strict Compliance', desc: 'Zero regulatory exposure, mandatory auditability and breach notices' },
];

export const ClauseNegotiatorModal: React.FC<ClauseNegotiatorModalProps> = ({
  isOpen,
  onClose,
  findingId,
  topic = 'Contractual Contradiction',
  statementA = '',
  statementB = '',
  docATitle = 'Document A',
  docBTitle = 'Document B',
  pageA = 1,
  pageB = 1,
  onSaved,
}) => {
  const [stance, setStance] = useState<StanceType>('balanced');
  const [customInstructions, setCustomInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NegotiateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedToNotes, setSavedToNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setResult(null);
      setError(null);
      setCopied(false);
      setSavedToNotes(false);
      setCustomInstructions('');
      setStance('balanced');
    }
  }, [isOpen, findingId, statementA, statementB]);

  const handleNegotiate = async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      let res: NegotiateResponse;
      if (findingId) {
        res = await api.negotiateFinding(findingId, stance, customInstructions || undefined);
      } else {
        res = await api.negotiateClause({
          topic,
          statement_a: statementA,
          statement_b: statementB,
          doc_a_title: docATitle,
          doc_b_title: docBTitle,
          page_a: pageA,
          page_b: pageB,
          stance,
          custom_instructions: customInstructions || undefined,
        });
      }
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to generate redline reconciliation.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.proposed_clause);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToFinding = async () => {
    if (!findingId || !result) return;
    setSavingNotes(true);
    try {
      const noteContent = `[Autonomous Redline Amendment - ${result.stance}]\nProposed Clause:\n${result.proposed_clause}\n\nRationale:\n${result.rationale}`;
      await api.updateFinding(findingId, {
        reviewer_notes: noteContent,
        status: 'under_review',
      });
      setSavedToNotes(true);
      onSaved?.();
      setTimeout(() => setSavedToNotes(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save amendment to finding notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  const getRiskBadgeVariant = (risk: string): 'sage' | 'teal' | 'gold' | 'navy' | 'gray' | 'red' => {
    const lower = risk.toLowerCase();
    if (lower.includes('high') || lower.includes('critical')) return 'red';
    if (lower.includes('medium') || lower.includes('moderate')) return 'gold';
    return 'sage';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Autonomous Redline & Clause Negotiator" maxWidth="4xl">
      <div className="space-y-6 max-h-[80vh] overflow-y-auto px-1 py-1">
        {/* Header Topic Context */}
        <div className="bg-slate-50 border border-slate-200 rounded-md p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Subject / Clause Topic</span>
            <Badge variant="gray">{topic}</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Reconciles competing contractual provisions and generates legal redlines adhering to your preferred strategic stance.
          </p>
        </div>

        {/* Conflicting Statements Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-md p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <span className="text-xs font-semibold text-navy-800 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                {docATitle || 'Document A'}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Page {pageA || 1}</span>
            </div>
            <p className="text-xs text-slate-700 italic leading-relaxed whitespace-pre-wrap">
              "{statementA || 'No provision text available'}"
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-md p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <span className="text-xs font-semibold text-navy-800 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                {docBTitle || 'Document B'}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Page {pageB || 1}</span>
            </div>
            <p className="text-xs text-slate-700 italic leading-relaxed whitespace-pre-wrap">
              "{statementB || 'No provision text available'}"
            </p>
          </div>
        </div>

        {/* Negotiation Stance Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Negotiation Stance & Risk Appetite
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {STANCES.map((s) => {
              const active = stance === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStance(s.id)}
                  className={`text-left p-3 rounded-md border transition-all ${
                    active
                      ? 'border-navy-800 bg-navy-50/50 shadow-sm ring-1 ring-navy-800'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${active ? 'text-navy-900' : 'text-slate-800'}`}>
                      {s.label}
                    </span>
                    {active && <span className="w-2 h-2 rounded-full bg-navy-800" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">{s.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Drafting Notes (Optional) */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Custom Drafting Guidance (Optional)
          </label>
          <input
            type="text"
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="e.g. Cap damages at 12 months fees, require 30-day notice for material changes"
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-navy-800 bg-white"
          />
        </div>

        {/* Action Button */}
        <div>
          <Button
            variant="primary"
            onClick={handleNegotiate}
            disabled={loading}
            className="w-full justify-center text-xs py-2.5 font-medium"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Synthesizing Redline Amendment...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Scale className="w-4 h-4" />
                Generate Redline Amendment
              </span>
            )}
          </Button>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2.5 text-xs text-red-700">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Negotiated Clause Output */}
        {result && (
          <div className="border border-slate-200 rounded-md bg-white overflow-hidden shadow-sm space-y-0">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-navy-900">Proposed Redline Amendment</span>
                <Badge variant={getRiskBadgeVariant(result.risk_level)}>
                  {result.risk_level} Risk
                </Badge>
                <Badge variant="teal">
                  {result.mode === 'local_ai' ? 'Local AI Generated' : 'Synthesized'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="text-xs flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-slate-700" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy Clause'}
                </Button>
                {findingId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveToFinding}
                    disabled={savingNotes || savedToNotes}
                    className="text-xs flex items-center gap-1.5"
                  >
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    {savedToNotes ? 'Saved to Notes' : savingNotes ? 'Saving...' : 'Save to Finding'}
                  </Button>
                )}
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* The Clause Body */}
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Drafted Provision
                </span>
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3 font-mono text-xs text-slate-800 leading-relaxed whitespace-pre-wrap select-all">
                  {result.proposed_clause}
                </div>
              </div>

              {/* Rationale & Concessions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                    Negotiation Rationale
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {result.rationale}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                    Key Concessions & Trade-offs
                  </span>
                  <ul className="space-y-1">
                    {result.key_concessions?.map((concession, idx) => (
                      <li key={idx} className="text-xs text-slate-600 flex items-start gap-1.5">
                        <span className="text-slate-400 font-bold">•</span>
                        <span>{concession}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
