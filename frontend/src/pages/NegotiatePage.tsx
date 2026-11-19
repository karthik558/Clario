import { PageHeader } from '../components/layout/PageHeader';
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Scale,
  Copy,
  Check,
  Shield,
  FileText,
  AlertTriangle,
  BookmarkCheck,
  ArrowRight,
  Layers,
  RotateCcw,
  Download,
  Cpu
} from 'lucide-react';
import { api } from '../services/api';
import { useBackgroundTasks } from '../context/BackgroundTaskContext';
import { FindingItem, DocumentItem, NegotiateResponse } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';

type StanceType = 'balanced' | 'customer_protective' | 'vendor_favorable' | 'strict_compliance';

const STANCES: { id: StanceType; label: string; desc: string }[] = [
  { id: 'balanced', label: 'Balanced Compromise', desc: 'Equal burden sharing, industry-standard mutual terms' },
  { id: 'customer_protective', label: 'Customer Protective', desc: 'Prioritizes customer liability caps, audit rights, and remedies' },
  { id: 'vendor_favorable', label: 'Vendor Favorable', desc: 'Protects IP, limits warranties, standard service disclaimers' },
  { id: 'strict_compliance', label: 'Strict Compliance', desc: 'Zero regulatory exposure, mandatory auditability and breach notices' },
];

export const NegotiatePage: React.FC = () => {
  const { startTask, getLatestTask } = useBackgroundTasks();
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedFindingId, setSelectedFindingId] = useState<string>('');

  const [topic, setTopic] = useState('');
  const [statementA, setStatementA] = useState('');
  const [statementB, setStatementB] = useState('');
  const [docATitle, setDocATitle] = useState('');
  const [docBTitle, setDocBTitle] = useState('');

  const [stance, setStance] = useState<StanceType>('balanced');
  const [customInstructions, setCustomInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NegotiateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedNotes, setSavedNotes] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [useAi, setUseAi] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const elementId = location.hash.replace('#', '');
      const timer = setTimeout(() => {
        const el = document.getElementById(elementId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-slate-900', 'ring-offset-2', 'transition-all');
          setTimeout(() => {
            el.classList.remove('ring-2', 'ring-slate-900', 'ring-offset-2');
          }, 3500);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [location.hash, result]);

  const handleExportDocx = async () => {
    if (!result) return;
    try {
      setExportingDocx(true);
      const res = await fetch('/api/negotiate/export-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: result.topic || topic || 'Contract Provision',
          stance: result.stance || stance,
          doc_a_title: docATitle || 'Document A',
          doc_b_title: docBTitle || 'Document B',
          statement_a: statementA,
          statement_b: statementB,
          proposed_clause: result.proposed_clause,
          rationale: result.rationale,
          risk_level: result.risk_level,
          key_concessions: result.key_concessions,
        })
      });
      if (!res.ok) throw new Error('Failed to generate docx');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clario-redline-${(result.topic || 'clause').toLowerCase().replace(/\s+/g, '-')}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to export docx', err);
    } finally {
      setExportingDocx(false);
    }
  };

  useEffect(() => {
    Promise.all([
      api.getFindings().catch(() => []),
      api.getDocuments().catch(() => []),
    ]).then(([fList, dList]) => {
      setFindings(fList);
      setDocuments(dList);
      if (fList.length > 0) {
        applyFinding(fList[0]);
      } else if (dList.length > 0) {
        setDocATitle(dList[0].title);
        if (dList.length > 1) {
          setDocBTitle(dList[1].title);
        }
      }
      const cached = getLatestTask('redline');
      if (cached?.status === 'completed' && cached.result) {
        setResult(cached.result);
      } else if (cached?.status === 'running') {
        setLoading(true);
      }
    });
  }, []);

  const applyFinding = (f: FindingItem) => {
    setSelectedFindingId(f.id);
    setTopic(f.title);
    setStatementA(f.doc_a_quote || f.description || '');
    setStatementB(f.doc_b_quote || '');
    setDocATitle(f.doc_a_title || 'Document A');
    setDocBTitle(f.doc_b_title || 'Document B');
  };

  const handleSelectFinding = (findingId: string) => {
    setSelectedFindingId(findingId);
    if (!findingId) return;
    const found = findings.find(f => f.id === findingId);
    if (found) applyFinding(found);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    setSavedNotes(false);
    try {
      const res = await startTask<NegotiateResponse>({
        title: useAi ? `AI Redline: ${topic || 'Clause Harmonization'}` : `Redline: ${topic || 'Clause'}`,
        category: 'redline',
        targetScope: `${docATitle || 'Doc A'} vs ${docBTitle || 'Doc B'}`,
        route: '/negotiate#synthesis-result',
        initialStage: `Harmonizing ${topic || 'provision'} (${stance})...`,
        executor: async (updateProgress) => {
          updateProgress(30, 'Analyzing conflicting statements...', `Comparing ${docATitle} against ${docBTitle}`);
          if (useAi) {
            updateProgress(60, 'Synthesizing compromise redline with AI...', `Applying ${stance} stance guidelines`);
          }
          const negRes = await api.negotiateClause({
            statement_a: statementA,
            statement_b: statementB,
            stance,
            custom_instructions: customInstructions || undefined,
            topic,
            doc_a_title: docATitle,
            doc_b_title: docBTitle,
            finding_id: selectedFindingId || undefined,
            use_ai: useAi,
          });
          updateProgress(100, 'Redline clause drafted', 'Harmonized compromise ready');
          return negRes;
        },
      });
      setResult(res);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setError(err?.message || 'Failed to draft redline clause. Please retry.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result?.proposed_clause) return;
    navigator.clipboard.writeText(result.proposed_clause);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToFinding = async () => {
    if (!selectedFindingId || !result) return;
    try {
      await api.updateFinding(selectedFindingId, {
        reviewer_notes: `[AI Redline - ${stance.toUpperCase()}]\nProposed Clause:\n${result.proposed_clause}\n\nRationale:\n${result.rationale}`,
        status: 'under_review',
      });
      setSavedNotes(true);
    } catch {
      setError('Could not save to finding notes.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title="Clause redline" description="Compare alternative wording and draft revisions to a clause.">
        {findings.length > 0 && (
          <div className="w-full sm:w-72">
            <Select
              aria-label="Preset Finding"
              value={selectedFindingId}
              onChange={(e) => handleSelectFinding(e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-md px-3 py-2 text-slate-800 font-medium shadow-xs"
            >
              <option value="">-- Choose from Flagged Findings --</option>
              {findings.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title} ({f.severity.toUpperCase()})
                </option>
              ))}
            </Select>
          </div>
        )}
      </PageHeader>

      {error && (
        <div role="alert" className="p-3.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Inputs & Stance Controls */}
        <div className="space-y-5">
          {/* Conflicting Text Inputs */}
          <Card className="p-5 bg-white border border-slate-200 shadow-sm rounded-lg space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <FileText className="w-4 h-4 text-slate-700" />
              <span>Contradictory Clauses to Bridge</span>
            </h3>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Provision / Clause Topic
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Data Retention, Indemnification Cap, SLA Breach"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:border-slate-800 shadow-xs"
              />
            </div>

            {/* Document A Clause */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">Document A Baseline Clause</span>
                <input
                  type="text"
                  value={docATitle}
                  onChange={(e) => setDocATitle(e.target.value)}
                  placeholder="Doc A Title"
                  className="text-[11px] px-2 py-0.5 border border-slate-200 rounded text-slate-600 w-44 text-right"
                />
              </div>
              <textarea
                rows={3}
                value={statementA}
                onChange={(e) => setStatementA(e.target.value)}
                placeholder="Paste clause or excerpt from Document A..."
                className="w-full text-xs p-3 border border-slate-200 rounded-md bg-slate-50 text-slate-900 focus:outline-none focus:bg-white focus:border-slate-800 font-mono leading-relaxed resize-none shadow-xs"
              />
            </div>

            {/* Document B Clause */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">Document B Modernized Clause</span>
                <input
                  type="text"
                  value={docBTitle}
                  onChange={(e) => setDocBTitle(e.target.value)}
                  placeholder="Doc B Title"
                  className="text-[11px] px-2 py-0.5 border border-slate-200 rounded text-slate-600 w-44 text-right"
                />
              </div>
              <textarea
                rows={3}
                value={statementB}
                onChange={(e) => setStatementB(e.target.value)}
                placeholder="Paste clause or excerpt from Document B..."
                className="w-full text-xs p-3 border border-slate-200 rounded-md bg-slate-50 text-slate-900 focus:outline-none focus:bg-white focus:border-slate-800 font-mono leading-relaxed resize-none shadow-xs"
              />
            </div>
          </Card>

          {/* Stance Selector */}
          <Card className="p-5 bg-white border border-slate-200 shadow-sm rounded-lg space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <Shield className="w-4 h-4 text-slate-700" />
              <span>Negotiation Strategy & Stance</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {STANCES.map((s) => {
                const isActive = stance === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStance(s.id)}
                    className={`p-3 rounded-md border text-left transition-all ${
                      isActive
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="text-xs font-bold mb-0.5">{s.label}</div>
                    <p className={`text-[11px] leading-relaxed line-clamp-2 ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                      {s.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Custom Redline Instructions (Optional)
              </label>
              <input
                type="text"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="e.g. Ensure 72-hour notice window and retain $250k liability ceiling"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:border-slate-800 shadow-xs"
              />
            </div>

            {/* AI Generation Mode Toggle */}
            <div className="flex items-center justify-between pb-3 pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-slate-600" />
                <span>Generate with AI (LLM Synthesis)</span>
              </span>
              <button
                type="button"
                onClick={() => setUseAi(!useAi)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                  useAi
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                }`}
              >
                {useAi ? 'AI ON' : 'AI OFF'}
              </button>
            </div>

            <Button
              variant="primary"
              size="md"
              disabled={loading || (!statementA.trim() && !statementB.trim())}
              onClick={handleGenerate}
              className="w-full justify-center text-xs font-semibold py-2.5 bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  <span>Synthesizing Harmonized Redline...</span>
                </>
              ) : (
                <>
                  <Scale className="w-4 h-4 mr-2" />
                  <span>Generate AI Redline Amendment</span>
                </>
              )}
            </Button>
          </Card>
        </div>

        {/* Right Column: Generated Redline Output */}
        <div className="space-y-5">
          <Card
            id="synthesis-result"
            className="p-5 bg-white border border-slate-200 shadow-sm rounded-lg min-h-[460px] flex flex-col justify-between scroll-mt-6 transition-all duration-300"
          >
            {result ? (
              <div className="space-y-4">
                {/* Result Header Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Badge variant="navy">STANCE: {result.stance.toUpperCase()}</Badge>
                    <Badge variant={result.risk_level === 'Low' ? 'sage' : result.risk_level === 'Medium' ? 'gold' : 'red'}>
                      Risk: {result.risk_level}
                    </Badge>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {result.mode}
                  </span>
                </div>

                {/* Proposed Clause Box */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Proposed Redline Amendment
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleExportDocx}
                        disabled={exportingDocx}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200 shadow-xs"
                        title="Download Microsoft Word document with tracked changes markup"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-600" />
                        <span>{exportingDocx ? 'Exporting...' : 'Export Track Changes (.docx)'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 transition-colors"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copied' : 'Copy Clause'}</span>
                      </button>
                    </div>
                  </div>
                  <div className="p-4 rounded-md border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 leading-relaxed whitespace-pre-wrap selection:bg-slate-200">
                    {result.proposed_clause}
                  </div>
                </div>

                {/* Legal Rationale */}
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block mb-1">
                    Strategic Rationale & Justification
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed bg-white border border-slate-100 p-3 rounded-md">
                    {result.rationale}
                  </p>
                </div>

                {/* Key Concessions */}
                {result.key_concessions && result.key_concessions.length > 0 && (
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block mb-1">
                      Key Concessions & Safeguards
                    </span>
                    <ul className="space-y-1">
                      {result.key_concessions.map((c, i) => (
                        <li key={i} className="text-xs text-slate-700 flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-20 px-6 text-slate-500 my-auto">
                <Scale className="w-12 h-12 text-slate-300 mb-3 stroke-[1.2]" />
                <h4 className="text-sm font-bold text-slate-700 mb-1">No Redline Generated Yet</h4>
                <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-4">
                  Select a detected finding or paste contradictory clauses on the left, choose your preferred bargaining stance, and generate a harmonized clause.
                </p>

              </div>
            )}

            {/* Bottom Actions */}
            {result && (
              <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Ready to incorporate into contractual rider
                </span>
                {selectedFindingId && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={savedNotes}
                    onClick={handleSaveToFinding}
                    className="text-xs"
                  >
                    <BookmarkCheck className="w-3.5 h-3.5 mr-1.5 text-slate-700" />
                    <span>{savedNotes ? 'Saved to Audit Notes' : 'Save to Finding'}</span>
                  </Button>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
