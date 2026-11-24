import { PageHeader } from '../components/layout/PageHeader';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  Layers,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { useBackgroundTasks } from '../context/BackgroundTaskContext';
import { ComplianceAuditResponse, DocumentItem, ComplianceGap } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';

export const CompliancePage: React.FC = () => {
  const navigate = useNavigate();
  const { startTask } = useBackgroundTasks();
  const [data, setData] = useState<ComplianceAuditResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditing, setAuditing] = useState(false);
  const [expandedFramework, setExpandedFramework] = useState<string | null>('gdpr');
  const [copiedGapId, setCopiedGapId] = useState<string | null>(null);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [docs, auditRes] = await Promise.all([
        api.getDocuments().catch(() => []),
        api.auditCompliance().catch(() => null)
      ]);
      setDocuments(docs);
      if (auditRes) setData(auditRes);
    } catch (err) {
      console.error('Failed to load compliance data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleRunAudit = async () => {
    try {
      setAuditing(true);
      const scopeLabel = selectedDocIds.length > 0 ? `${selectedDocIds.length} doc(s)` : 'All Documents';
      const res = await startTask<ComplianceAuditResponse>({
        title: 'Compliance Framework Audit',
        category: 'scan',
        targetScope: scopeLabel,
        route: '/compliance',
        initialStage: 'Scanning against GDPR, HIPAA, SOC 2, and EU AI Act...',
        executor: async (updateProgress) => {
          updateProgress(35, 'Evaluating contractual covenants and audit rights...', 'Matching framework controls');
          await new Promise((r) => setTimeout(r, 300));
          const compRes = await api.auditCompliance(
            selectedDocIds.length > 0 ? selectedDocIds : undefined
          );
          updateProgress(100, 'Compliance audit complete', 'Framework gaps evaluated');
          return compRes;
        },
      });
      setData(res);
    } catch (err) {
      console.error('Audit execution failed', err);
    } finally {
      setAuditing(false);
    }
  };

  const handleCopyRemediation = (gap: ComplianceGap) => {
    navigator.clipboard.writeText(gap.remediation_clause);
    setCopiedGapId(gap.id);
    setTimeout(() => setCopiedGapId(null), 2000);
  };

  const toggleDocSelection = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader title="Compliance matrix" description="Review document evidence against GDPR, HIPAA, SOC 2, and EU AI Act requirements.">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={handleRunAudit}
            loading={auditing}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{auditing ? 'Auditing Corpus...' : 'Re-Run Compliance Scan'}</span>
          </Button>
        </div>
      </PageHeader>

      {/* KPI Stat Cards matching Overview and Documents */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Readiness Score
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {data ? `${data.overall_score}%` : '—'}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            {(data as any)?.scope_status === 'operational_non_regulatory'
              ? 'Not applicable for financial scope'
              : data && data.overall_score >= 75
              ? 'Passable threshold'
              : 'Attention required'}
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Frameworks
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {data ? data.frameworks.length : 4}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            GDPR, HIPAA, SOC 2, AI Act
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Compliance Gaps
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {data ? data.gaps_count : 0}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Missing covenants
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Audited Scope
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <FileCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {data ? data.audited_documents : documents.length}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Active documents
          </span>
        </Card>
      </div>

      {/* Document Scope Filter */}
      {documents.length > 0 && (
        <Card className="p-3 bg-white border border-slate-200 shadow-xs">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label htmlFor="compliance-doc-scope" className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider shrink-0">
              Document Scope:
            </label>
            <Select
              id="compliance-doc-scope"
              value={selectedDocIds[0] || ''}
              onChange={(e) => setSelectedDocIds(e.target.value ? [e.target.value] : [])}
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

      {/* Scope Classification Banner */}
      {(data as any)?.scope_status === 'operational_non_regulatory' && (
        <Card className="p-4 bg-slate-50 border border-slate-200 shadow-xs flex items-start gap-3">
          <div className="w-8 h-8 rounded-md bg-slate-200 flex items-center justify-center text-slate-700 shrink-0 mt-0.5">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Document Scope: Operational & Financial Records
            </h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {(data as any)?.scope_description || 'The active documents in this workspace are internal operational / financial schedules. GDPR, HIPAA, SOC 2, and EU AI Act covenants apply to data processing agreements, cloud supplier contracts, and AI governance policies.'}
            </p>
          </div>
        </Card>
      )}

      {/* Framework Accordion Breakdown */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
          Regulatory Framework Assessment
        </h2>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">
            Analyzing document corpus against regulatory frameworks...
          </div>
        ) : !data || data.frameworks.length === 0 ? (
          <Card className="p-10 text-center bg-white border border-slate-200">
            <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800 mb-1">
              {documents.length === 0 ? 'No Documents in Workspace' : 'No Regulatory Frameworks Loaded'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              {documents.length === 0
                ? 'Upload governance policies, data privacy terms, or supplier agreements in the Document Library to audit compliance against GDPR, HIPAA, SOC 2, and EU AI Act covenants.'
                : 'No regulatory framework data is currently available.'}
            </p>
            {documents.length === 0 && (
              <Button variant="secondary" size="sm" onClick={() => navigate('/documents')}>
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                Go to Document Library
              </Button>
            )}
          </Card>
        ) : (
          data.frameworks.map((fw) => {
            const isExpanded = expandedFramework === fw.framework_id;
            return (
              <Card
                key={fw.framework_id}
                className="overflow-hidden bg-white border border-slate-200 shadow-xs"
              >
                <div
                  onClick={() =>
                    setExpandedFramework(isExpanded ? null : fw.framework_id)
                  }
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors select-none"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-bold text-sm text-slate-900">{fw.framework_name}</h3>
                      <Badge variant="navy" size="sm">
                        {fw.jurisdiction}
                      </Badge>
                      <Badge
                        variant={
                          fw.readiness_score >= 80
                            ? 'sage'
                            : fw.readiness_score >= 50
                            ? 'gold'
                            : 'red'
                        }
                        size="sm"
                      >
                        {fw.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">{fw.category}</p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-slate-900">
                        {fw.passed_count} / {fw.total_count} Verified
                      </div>
                      <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-slate-900 rounded-full"
                          style={{ width: `${fw.readiness_score}%` }}
                        />
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 sm:p-5 pt-0 border-t border-slate-100 space-y-3 bg-slate-50/50">
                    <div className="divide-y divide-slate-200">
                      {fw.criteria.map((c) => (
                        <div key={c.id} className="py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1 max-w-2xl">
                            <div className="flex items-center gap-2">
                              {c.status === 'compliant' ? (
                                <Check className="w-4 h-4 text-slate-700 shrink-0" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
                              )}
                              <span className="text-xs font-bold text-slate-900">{c.title}</span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                ({c.clause_target})
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 pl-6">{c.description}</p>
                            <p className="text-xs italic text-slate-800 pl-6 bg-white p-2.5 rounded-md border border-slate-200 mt-1 leading-relaxed">
                              "{c.evidence_quote}"
                            </p>
                          </div>
                          <Badge
                            variant={c.status === 'compliant' ? 'sage' : 'red'}
                            size="sm"
                            className="shrink-0 self-start sm:self-center"
                          >
                            {c.status === 'compliant' ? 'Verified' : 'Gap Found'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Identified Compliance Gaps & Auto-Remediation */}
      {data && data.gaps.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Identified Compliance Gaps & Recommended Amendments ({data.gaps.length})
            </h2>
          </div>

          <div className="space-y-3">
            {data.gaps.map((gap) => (
              <Card key={gap.id} className="p-5 bg-white border border-slate-200 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={gap.severity === 'critical' ? 'red' : 'gold'} size="sm">
                      {gap.severity.toUpperCase()}
                    </Badge>
                    <span className="text-xs font-bold text-slate-900">{gap.criterion_title}</span>
                    <Badge variant="navy" size="sm">
                      {gap.framework_name}
                    </Badge>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Target: {gap.clause_target}
                  </span>
                </div>

                <p className="text-xs text-slate-700">{gap.gap_summary}</p>

                <div className="bg-slate-50 rounded-md border border-slate-200 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                      Suggested Contractual Remediation Clause
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyRemediation(gap)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 px-2 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                    >
                      {copiedGapId === gap.id ? (
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
                  <p className="text-xs font-mono text-slate-900 leading-relaxed whitespace-pre-wrap">
                    {gap.remediation_clause}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
