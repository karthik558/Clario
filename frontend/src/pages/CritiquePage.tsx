import { PageHeader } from '../components/layout/PageHeader';
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  Scale,
  ShieldAlert,
  Coins,
  ShieldCheck,
  FileCheck,
  Briefcase,
  Copy,
  Check,
  Send,
  FileText,
  UserCheck,
  RefreshCw,
  Cpu,
  Loader2
} from 'lucide-react';
import { api } from '../services/api';
import { useBackgroundTasks } from '../context/BackgroundTaskContext';
import { CritiqueResponse, DocumentItem } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export const CritiquePage: React.FC = () => {
  const navigate = useNavigate();
  const { startTask, activeTasks, getLatestTask, setIsDrawerOpen } = useBackgroundTasks();
  const [data, setData] = useState<CritiqueResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [useAi, setUseAi] = useState<boolean>(false);
  const [customClause, setCustomClause] = useState('');
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [activePersonaTab, setActivePersonaTab] = useState<string>('general_counsel');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [draftingOptionKey, setDraftingOptionKey] = useState<string | null>(null);
  const [aiDraftedFlags, setAiDraftedFlags] = useState<Record<string, boolean>>({});

  const [searchParams] = useSearchParams();
  const location = useLocation();

  const activeCritiqueTask = activeTasks.find((t) => t.category === 'critique');

  const selectedDocTitle = selectedDocIds.length > 0
    ? documents.find((d) => d.id === selectedDocIds[0])?.title || 'Selected Document'
    : 'All Workspace Documents';

  useEffect(() => {
    const council = searchParams.get('council') || searchParams.get('persona');
    if (council && ['general_counsel', 'cfo', 'ciso', 'cco', 'coo'].includes(council)) {
      setActivePersonaTab(council);
    }
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
  }, [searchParams, location.hash]);

  const handleDraftOptionWithAi = async (personaId: string, point: string, detail: string, idx: number) => {
    const key = `${personaId}-${idx}`;
    const targetRoute = `/critique?council=${personaId}#flag-${personaId}-${idx}`;
    try {
      setDraftingOptionKey(key);
      const res = await startTask<{ point: string; counter_clause: string; rationale: string; mode: string }>({
        title: point,
        category: 'counter',
        targetScope: selectedDocTitle,
        route: targetRoute,
        initialStage: `Synthesizing defense for ${point}...`,
        executor: async (updateProgress) => {
          updateProgress(35, `Drafting ${personaId} defense covenants...`, `Analyzing ${point} in ${selectedDocTitle}`);
          const draftRes = await api.draftCounterClause(point, detail, personaId, selectedDocTitle);
          updateProgress(90, 'Enforcing protective covenants...', 'Validating bilateral liability protections');
          return draftRes;
        },
      });
      if (res && res.counter_clause) {
        setData(prev => {
          if (!prev) return prev;
          const nextPersonas = prev.personas.map(p => {
            if (p.persona_id !== personaId) return p;
            const nextFlags = [...p.red_flags];
            if (nextFlags[idx]) {
              nextFlags[idx] = {
                ...nextFlags[idx],
                counter_clause: res.counter_clause
              };
            }
            return { ...p, red_flags: nextFlags };
          });
          return { ...prev, personas: nextPersonas };
        });
        setAiDraftedFlags(prev => ({ ...prev, [key]: true }));
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Failed to draft counter-clause with AI', err);
      }
    } finally {
      setDraftingOptionKey(null);
    }
  };

  const fetchCritique = async (docIds?: string[], aiMode: boolean = useAi) => {
    try {
      setLoading(true);
      // Restore latest completed task result if available
      const cached = getLatestTask('critique');
      if (cached && cached.status === 'completed' && cached.result) {
        setData(cached.result);
      }
      const [critRes, docs] = await Promise.all([
        api.evaluateCritique(docIds && docIds.length > 0 ? docIds : undefined, undefined, aiMode).catch(() => null),
        api.getDocuments().catch(() => [])
      ]);
      if (critRes) setData(critRes);
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load critique evaluation', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCritique();
  }, []);

  const handleEvaluate = async (docIds: string[] = selectedDocIds, aiMode: boolean = useAi, clauseText: string = customClause) => {
    try {
      setEvaluating(true);
      const res = await startTask<CritiqueResponse>({
        title: aiMode ? 'AI Red Team Multi-Council Audit' : 'Red Team Adversarial Audit',
        category: 'critique',
        targetScope: selectedDocTitle,
        route: '/critique#audit-consensus',
        initialStage: 'Binding document scope and loading passages...',
        executor: async (updateProgress) => {
          updateProgress(20, 'Analyzing Legal Counsel & CFO liabilities...', `Auditing ${selectedDocTitle} for liability super-caps and auto-renewals`);
          if (aiMode) {
            updateProgress(55, 'Synthesizing CISO, CCO & COO covenants with AI...', 'Drafting 48h breach SLAs, regulatory audit rights, and uptime commitments');
          }
          const critiqueRes = await api.evaluateCritique(
            docIds.length > 0 ? docIds : undefined,
            clauseText.trim() || undefined,
            aiMode
          );
          updateProgress(95, 'Consolidating composite executive consensus...', 'Aggregating risk ratings across all 5 councils');
          return critiqueRes;
        },
      });
      setData(res);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Evaluation failed', err);
      }
    } finally {
      setEvaluating(false);
    }
  };

  const handleSelectDoc = (docId: string | null) => {
    const nextIds = docId ? [docId] : [];
    setSelectedDocIds(nextIds);
    handleEvaluate(nextIds, useAi, customClause);
  };

  const handleToggleAi = () => {
    const nextAi = !useAi;
    setUseAi(nextAi);
    handleEvaluate(selectedDocIds, nextAi, customClause);
  };

  const handleCopyClause = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getPersonaIcon = (id: string) => {
    switch (id) {
      case 'general_counsel':
        return <Scale className="w-4 h-4" />;
      case 'cfo':
        return <Coins className="w-4 h-4" />;
      case 'ciso':
        return <ShieldCheck className="w-4 h-4" />;
      case 'cco':
        return <FileCheck className="w-4 h-4" />;
      case 'coo':
        return <Briefcase className="w-4 h-4" />;
      default:
        return <UserCheck className="w-4 h-4" />;
    }
  };

  const activePersona = data?.personas.find((p) => p.persona_id === activePersonaTab) || data?.personas[0];
  const personaGeneral = data?.personas.find((p) => p.persona_id === 'general_counsel');
  const personaCfo = data?.personas.find((p) => p.persona_id === 'cfo');
  const personaCiso = data?.personas.find((p) => p.persona_id === 'ciso');
  const personaCco = data?.personas.find((p) => p.persona_id === 'cco');
  const personaCoo = data?.personas.find((p) => p.persona_id === 'coo');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Red team critique"
        description="Adversarial multi-council audit examining contractual terms from legal, financial, security, compliance, and operational perspectives."
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* AI Generation Toggle */}
          <Button
            size="sm"
            variant={useAi ? 'secondary' : 'outline'}
            onClick={handleToggleAi}
            title="Toggle between deep generative AI synthesis and instant heuristic pattern matching"
            className="flex items-center gap-1.5"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Generate with AI: {useAi ? 'ON' : 'OFF'}</span>
          </Button>

          <Button
            size="sm"
            onClick={() => handleEvaluate()}
            loading={evaluating}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{evaluating ? (useAi ? 'Synthesizing with AI...' : 'Simulating Review...') : (useAi ? 'Run AI Adversarial Audit' : 'Run Red Team Simulation')}</span>
          </Button>
        </div>
      </PageHeader>

      {/* Active Background Task Progress Banner */}
      {activeCritiqueTask && (
        <Card className="p-3.5 bg-amber-50/80 border border-amber-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700 shrink-0" />
              <span className="font-bold text-amber-950 uppercase tracking-wider text-[11px]">
                AI Adversarial Audit In Progress
              </span>
              <span className="text-amber-800 font-medium">— {activeCritiqueTask.stage}</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="font-mono font-bold text-amber-900">{activeCritiqueTask.progress}%</span>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="text-[11px] underline text-amber-900 font-semibold hover:text-amber-950 ml-2"
              >
                View Live Logs & Activity
              </button>
            </div>
          </div>
          <div className="w-full h-1.5 bg-amber-200/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-600 transition-all duration-300 rounded-full"
              style={{ width: `${activeCritiqueTask.progress}%` }}
            />
          </div>
        </Card>
      )}

      {/* Standard Multi-Document Scope Selector */}
      {documents.length > 0 && (
        <Card className="p-3 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-500 font-semibold uppercase text-[10px] shrink-0 tracking-wider">
              Audited Scope:
            </span>
            <button
              onClick={() => handleSelectDoc(null)}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors shrink-0 ${
                selectedDocIds.length === 0
                  ? 'bg-slate-900 text-white font-medium'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Workspace ({documents.length})
            </button>
            {documents.map((d) => {
              const isSelected = selectedDocIds.includes(d.id);
              return (
                <button
                  key={d.id}
                  onClick={() => handleSelectDoc(d.id)}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-slate-900 text-white font-medium'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  <span className="truncate max-w-[180px]">{d.title}</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Top Card KPI Stat Ribbon - Exactly matching Overview, Documents, Compliance */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Composite Risk Card */}
        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Composite Risk
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {data ? `${data.composite_risk_score}/100` : '—'}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Overall exposure index
          </span>
        </Card>

        {/* General Legal Counsel */}
        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              General Counsel
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <Scale className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {personaGeneral ? `${personaGeneral.risk_score}%` : '—'}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Liability & Indemnity
          </span>
        </Card>

        {/* CFO */}
        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              CFO / Finance
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <Coins className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {personaCfo ? `${personaCfo.risk_score}%` : '—'}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Renewal & Escalation
          </span>
        </Card>

        {/* CISO */}
        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              CISO / Infosec
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {personaCiso ? `${personaCiso.risk_score}%` : '—'}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Breach SLA & Telemetry
          </span>
        </Card>

        {/* CCO */}
        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              CCO / Compliance
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <FileCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {personaCco ? `${personaCco.risk_score}%` : '—'}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Regulatory & DPA Audit
          </span>
        </Card>

        {/* COO */}
        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              COO / Operations
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <Briefcase className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {personaCoo ? `${personaCoo.risk_score}%` : '—'}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Uptime SLA & Lock-in
          </span>
        </Card>
      </div>

      {/* Strategic Consensus & Executive Leverage Callout */}
      {data && data.personas.length > 0 && (
        <div id="audit-consensus" className="p-4 rounded-md bg-white border-l-4 border-l-clario-navy border border-slate-200 shadow-xs space-y-2 scroll-mt-6 transition-all duration-300">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-clario-navy">
                Executive Audit Consensus — {selectedDocTitle}
              </span>
              {data.mode === 'ai_multi_persona_synthesis' ? (
                <Badge variant="navy" size="sm">
                  Deep AI Multi-Persona Synthesis
                </Badge>
              ) : (
                <Badge variant="gray" size="sm">
                  Heuristic Grounded Audit
                </Badge>
              )}
            </div>
            <Badge variant={data.composite_risk_score >= 50 ? 'red' : 'sage'} size="sm">
              {data.composite_risk_score >= 50 ? 'Action Required' : 'Acceptable Baseline'}
            </Badge>
          </div>
          <p className="text-xs text-slate-800 leading-relaxed font-medium">
            {data.overall_assessment}
          </p>
          <div className="text-xs text-slate-600 pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
            <strong className="text-slate-900 font-semibold">Strategic Bargaining Leverage:</strong>
            <span className="text-slate-800">{data.leverage_summary}</span>
          </div>
        </div>
      )}

      {/* Empty State when no personas/data */}
      {!loading && (!data || data.personas.length === 0) && (
        <Card className="p-10 text-center bg-white border border-slate-200">
          <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-900 mb-1">
            {documents.length === 0 ? 'No Documents in Workspace' : 'No Clause Provided for Red Team Review'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
            {documents.length === 0
              ? 'Upload contracts or agreements in the Document Library, or type/paste a custom clause in the input box below to trigger adversarial executive critique.'
              : 'Paste or type a clause in the input area below and click "Critique Custom Clause" to analyze via all 5 council personas.'}
          </p>
          {documents.length === 0 && (
            <Button variant="secondary" size="sm" onClick={() => navigate('/documents')}>
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Go to Document Library
            </Button>
          )}
        </Card>
      )}

      {/* 5-Persona Council Selector Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-0">
        {data?.personas.map((persona) => {
          const isActive = activePersonaTab === persona.persona_id;
          return (
            <button
              key={persona.persona_id}
              onClick={() => setActivePersonaTab(persona.persona_id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-slate-900 text-slate-900 bg-slate-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              {getPersonaIcon(persona.persona_id)}
              <span>{persona.role_title}</span>
              <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-md text-slate-600">
                {persona.risk_score}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Council Scrutiny Panel */}
      {activePersona && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 bg-white rounded-md border border-slate-200 shadow-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Primary Scrutiny Focus
              </span>
              <span className="text-xs font-bold text-slate-900">{activePersona.focus}</span>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Recommended Stance
              </span>
              <Badge variant={activePersona.risk_score >= 50 ? 'red' : 'gold'} size="sm">
                {activePersona.verdict}
              </Badge>
            </div>
          </div>

          <div className="space-y-3">
            {activePersona.red_flags.map((flag, idx) => (
              <Card
                key={idx}
                id={`flag-${activePersona.persona_id}-${idx}`}
                className="p-5 bg-white border border-slate-200 shadow-xs space-y-3 scroll-mt-6 transition-all duration-300"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={flag.severity === 'Critical' ? 'red' : flag.severity === 'High' ? 'gold' : 'navy'} size="sm">
                      {flag.severity.toUpperCase()}
                    </Badge>
                    <h3 className="font-bold text-xs text-slate-900">{flag.point}</h3>
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">{flag.detail}</p>

                <div className="bg-slate-50 p-3.5 rounded-md border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-800">
                        Recommended Strategic Counter-Clause
                      </span>
                      {aiDraftedFlags[`${activePersona.persona_id}-${idx}`] && (
                        <Badge variant="navy" size="sm">
                          AI Generated
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={draftingOptionKey === `${activePersona.persona_id}-${idx}`}
                        onClick={() => handleDraftOptionWithAi(activePersona.persona_id, flag.point, flag.detail, idx)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-xs"
                        title="Generate or rewrite an AI defense counter-clause specifically for this risk"
                      >
                        <Cpu className="w-3 h-3 text-slate-500" />
                        <span>{draftingOptionKey === `${activePersona.persona_id}-${idx}` ? 'Generating with AI...' : 'Generate with AI'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyClause(flag.counter_clause, `${activePersona.persona_id}-${idx}`)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                      >
                        {copiedId === `${activePersona.persona_id}-${idx}` ? (
                          <>
                            <Check className="w-3 h-3 text-slate-700" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-500" />
                            <span>Copy Clause</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs font-mono text-slate-900 leading-relaxed whitespace-pre-wrap">
                    "{flag.counter_clause}"
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Ad-Hoc Clause Tester Sandbox */}
      <Card className="p-5 bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Ad-Hoc Clause Scrutiny Sandbox
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Paste draft language below to simulate instant 5-persona executive critique.
            </p>
          </div>
        </div>

        <textarea
          rows={3}
          value={customClause}
          onChange={(e) => setCustomClause(e.target.value)}
          placeholder="e.g. 'Vendor aggregate liability shall be capped at the total amount paid in the preceding three months, with no warranties of continuous availability.'"
          className="w-full text-xs font-mono p-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white text-slate-900"
        />

        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            onClick={() => handleEvaluate(selectedDocIds, useAi, customClause)}
            loading={evaluating}
            disabled={!customClause.trim()}
            className="flex items-center gap-1.5"
          >
            <Send className="w-3 h-3" />
            <span>Critique Custom Clause</span>
          </Button>
        </div>
      </Card>
    </div>
  );
};
