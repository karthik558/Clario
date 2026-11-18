import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Scale,
  ShieldAlert,
  Coins,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  Send,
  FileText,
  UserCheck,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import { CritiqueResponse, DocumentItem } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export const CritiquePage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<CritiqueResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [customClause, setCustomClause] = useState('');
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [activePersonaTab, setActivePersonaTab] = useState<string>('general_counsel');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchCritique = async () => {
    try {
      setLoading(true);
      const [critRes, docs] = await Promise.all([
        api.evaluateCritique().catch(() => null),
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

  const handleEvaluate = async () => {
    try {
      setEvaluating(true);
      const res = await api.evaluateCritique(
        selectedDocIds.length > 0 ? selectedDocIds : undefined,
        customClause.trim() || undefined
      );
      setData(res);
    } catch (err) {
      console.error('Evaluation failed', err);
    } finally {
      setEvaluating(false);
    }
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
      default:
        return <UserCheck className="w-4 h-4" />;
    }
  };

  const activePersona = data?.personas.find((p) => p.persona_id === activePersonaTab) || data?.personas[0];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-clario-border">
        <div>
          <h2 className="text-xl font-bold text-clario-text tracking-tight flex items-center space-x-2">
            <span>Multi-Persona Red Team Critique</span>
          </h2>
          <p className="text-xs text-clario-text-secondary">
            Simulated adversarial scrutiny across Legal Counsel, CFO, and CISO perspectives
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            onClick={handleEvaluate}
            loading={evaluating}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{evaluating ? 'Simulating Review...' : 'Run Red Team Simulation'}</span>
          </Button>
        </div>
      </div>

      {/* KPI Stat Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Composite Risk Score
            </span>
            <span className="text-2xl font-bold text-rose-600 font-mono mt-0.5 block">
              {data ? `${data.composite_risk_score}/100` : '—'}
            </span>
            <span className="text-[10px] text-rose-500 mt-0.5 block">High exposure index</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Legal Risk
            </span>
            <span className="text-2xl font-bold text-slate-900 font-mono mt-0.5 block">
              {data?.personas[0] ? `${data.personas[0].risk_score}%` : '—'}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">General Counsel</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
            <Scale className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Financial Risk
            </span>
            <span className="text-2xl font-bold text-slate-900 font-mono mt-0.5 block">
              {data?.personas[1] ? `${data.personas[1].risk_score}%` : '—'}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">CFO / Finance</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
            <Coins className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Security Risk
            </span>
            <span className="text-2xl font-bold text-slate-900 font-mono mt-0.5 block">
              {data?.personas[2] ? `${data.personas[2].risk_score}%` : '—'}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">CISO / Infosec</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Strategic Leverage Callout */}
      {data && data.personas.length > 0 && (
        <div className="p-4 rounded-md bg-white border-l-4 border-l-clario-navy border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-clario-navy">
              Executive Negotiation Assessment
            </span>
            <Badge variant="navy" size="sm">
              Red Team Consensus
            </Badge>
          </div>
          <p className="text-xs text-slate-800 leading-relaxed font-medium">
            {data.overall_assessment}
          </p>
          <div className="text-xs text-slate-600 pt-2 border-t border-slate-100 flex items-center gap-1.5">
            <strong className="text-slate-900 font-semibold">Bargaining Leverage:</strong>
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
              ? 'Upload contracts or agreements in the Document Library, or type/paste a custom clause in the input box above to trigger adversarial executive critique.'
              : 'Paste or type a clause in the input area above and click "Evaluate Clause" to analyze via General Counsel, CFO, and CISO personas.'}
          </p>
          {documents.length === 0 && (
            <Button variant="secondary" size="sm" onClick={() => navigate('/documents')}>
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Go to Document Library
            </Button>
          )}
        </Card>
      )}

      {/* Persona Selector Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        {data?.personas.map((persona) => {
          const isActive = activePersonaTab === persona.persona_id;
          return (
            <button
              key={persona.persona_id}
              onClick={() => setActivePersonaTab(persona.persona_id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
                isActive
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              {getPersonaIcon(persona.persona_id)}
              <span>{persona.role_title}</span>
              <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                {persona.risk_score}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Persona Scrutiny Panel */}
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
              <Badge variant="red" size="sm">
                {activePersona.verdict}
              </Badge>
            </div>
          </div>

          <div className="space-y-3">
            {activePersona.red_flags.map((flag, idx) => (
              <Card key={idx} className="p-5 bg-white border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Badge variant={flag.severity === 'Critical' ? 'red' : 'gold'} size="sm">
                      {flag.severity.toUpperCase()}
                    </Badge>
                    <h3 className="font-bold text-xs text-slate-900">{flag.point}</h3>
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">{flag.detail}</p>

                <div className="bg-slate-50 p-3.5 rounded-md border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-800">
                      Recommended Strategic Counter-Clause
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyClause(flag.counter_clause, `${activePersona.persona_id}-${idx}`)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 px-2 py-1 rounded bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                    >
                      {copiedId === `${activePersona.persona_id}-${idx}` ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
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
              Paste draft language below to simulate instant multi-persona critique.
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

        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleEvaluate}
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
