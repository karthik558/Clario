import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  FileText,
  Copy,
  Check,
  RefreshCw,
  Search,
  Scale,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  Award,
  FileCheck
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { api } from '../services/api';
import { useBackgroundTasks } from '../context/BackgroundTaskContext';
import { PolicyAuditResponse, PolicyRuleAudit, DocumentItem } from '../types';

export const PolicyCheckerPage: React.FC = () => {
  const navigate = useNavigate();
  const { startTask } = useBackgroundTasks();
  const [audit, setAudit] = useState<PolicyAuditResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [auditing, setAuditing] = useState<boolean>(false);
  const [copiedRuleId, setCopiedRuleId] = useState<string | null>(null);
  const [copiedCert, setCopiedCert] = useState<boolean>(false);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [docs, auditRes] = await Promise.all([
        api.getDocuments().catch(() => []),
        api.auditPolicies().catch(() => null)
      ]);
      setDocuments(docs);
      if (auditRes) setAudit(auditRes);
    } catch (err) {
      console.error('Failed to load initial policy audit data', err);
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
      const res = await startTask<PolicyAuditResponse>({
        title: 'Policy Governance Benchmark Check',
        category: 'scan',
        targetScope: scopeLabel,
        route: '/policy-checker',
        initialStage: 'Evaluating contractual language against governance rules...',
        executor: async (updateProgress) => {
          updateProgress(35, 'Analyzing liability caps, SLAs, and data retention rules...', 'Auditing policy rules');
          await new Promise((r) => setTimeout(r, 300));
          const auditRes = await api.auditPolicies(
            selectedDocIds.length > 0 ? selectedDocIds : undefined,
            selectedCategory !== 'all' ? selectedCategory : undefined
          );
          updateProgress(100, 'Policy audit completed', 'Policy compliance evaluated');
          return auditRes;
        },
      });
      setAudit(res);
    } catch (err) {
      console.error('Failed to run policy audit', err);
    } finally {
      setAuditing(false);
    }
  };

  const handleToggleDoc = (docId: string) => {
    const next = selectedDocIds.includes(docId)
      ? selectedDocIds.filter((id) => id !== docId)
      : [...selectedDocIds, docId];
    setSelectedDocIds(next);
  };

  const handleCopyClause = (rule: PolicyRuleAudit) => {
    navigator.clipboard.writeText(rule.remediation_clause);
    setCopiedRuleId(rule.id);
    setTimeout(() => setCopiedRuleId(null), 2000);
  };

  const handleExportCertificate = () => {
    if (!audit) return;
    const certText = `# Clario AI Policy Audit Certificate\nDate: ${audit.audit_date}\nOverall Policy Health: ${audit.overall_score}% (Grade ${audit.overall_grade})\n\n## Executive Summary\n${audit.summary}\n\n## Audited Scope\n${audit.audited_documents.map(d => `- ${d}`).join('\n')}\n\n## Rule-by-Rule Compliance Checklist\n${audit.rules.map(r => `### [${r.status}] ${r.title} (${r.category} • ${r.severity})\n- **Standard Benchmark**: ${r.benchmark}\n- **Evidence Quote**: "${r.evidence_quote}" (${r.evidence_source})\n- **Assessment**: ${r.violation_notes}\n- **Remediation Model Clause**:\n> ${r.remediation_clause}\n`).join('\n')}`;

    navigator.clipboard.writeText(certText);
    setCopiedCert(true);
    setTimeout(() => setCopiedCert(false), 2000);
  };

  const filteredRules = useMemo(() => {
    if (!audit) return [];
    return audit.rules.filter((rule) => {
      if (selectedCategory !== 'all' && rule.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      if (statusFilter !== 'all' && rule.status.toUpperCase() !== statusFilter.toUpperCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          rule.title.toLowerCase().includes(q) ||
          rule.benchmark.toLowerCase().includes(q) ||
          rule.evidence_quote.toLowerCase().includes(q) ||
          rule.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [audit, selectedCategory, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Policy checker"
        description="Audit document clauses against Fortune 500 enterprise governance, data privacy, and AI safety benchmarks."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCertificate}
            disabled={!audit || audit.rules.length === 0}
            className="flex items-center gap-1.5"
          >
            {copiedCert ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Certificate Copied</span>
              </>
            ) : (
              <>
                <Award className="w-3.5 h-3.5 text-slate-500" />
                <span>Export Audit Certificate</span>
              </>
            )}
          </Button>

          <Button
            size="sm"
            onClick={handleRunAudit}
            loading={auditing}
            className="flex items-center gap-1.5 shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{auditing ? 'Auditing Policies...' : 'Run Policy Audit'}</span>
          </Button>
        </div>
      </PageHeader>

      {/* Top Metric Cards - Matching Overview, Documents, and Compliance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Policy Health Score
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {audit ? `${audit.overall_score}%` : '—'}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            {audit ? `Grade ${audit.overall_grade} Enterprise Standard` : 'Awaiting audit run'}
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Compliant Rules
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {audit ? `${audit.passed_count}/${audit.total_rules}` : '—'}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Fully satisfied covenants
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Flagged Gaps
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {audit ? audit.violation_count : '—'}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            {audit && audit.warning_count > 0 ? `+${audit.warning_count} advisory review` : 'Immediate attention'}
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
            {audit ? audit.audited_documents.length : documents.length}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Verified policy documents
          </span>
        </Card>
      </div>

      {/* Target Scope Selector - Matching CompliancePage identically */}
      {documents.length > 0 && (
        <Card className="p-3 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-500 font-semibold uppercase text-[10px] shrink-0 tracking-wider">
              Document Scope:
            </span>
            <button
              type="button"
              onClick={() => setSelectedDocIds([])}
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
                  type="button"
                  onClick={() => handleToggleDoc(d.id)}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-slate-900 text-white font-medium'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  <span className="truncate max-w-[180px]">{d.title || d.filename}</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Filter Ribbon - Matching FindingsPage and DocumentsPage filter design */}
      <Card className="p-4 bg-white border border-slate-200 shadow-subtle">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center space-x-1.5 text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-medium">Filter By:</span>
          </div>

          <Select
            aria-label="Category filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="Data Governance">Data Governance</option>
            <option value="AI Ethics & IP">AI Ethics & IP</option>
            <option value="Security & Breach">Security & Breach</option>
            <option value="Commercial & Liability">Commercial & Liability</option>
          </Select>

          <Select
            aria-label="Status filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="COMPLIANT">Compliant</option>
            <option value="NEEDS_REVIEW">Needs Review</option>
            <option value="VIOLATION">Violation</option>
          </Select>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search policy rule or benchmark..."
              className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-md focus:outline-none bg-white"
            />
          </div>

          <span className="text-[11px] text-slate-400 ml-auto font-mono">
            Showing {filteredRules.length} of {audit?.total_rules ?? 8} rule(s)
          </span>
        </div>
      </Card>

      {/* Rules Checklist */}
      <div className="space-y-3.5">
        {loading ? (
          <div className="text-center py-12 text-xs text-slate-500">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin mx-auto mb-2" />
            Evaluating policy rules against enterprise standards...
          </div>
        ) : filteredRules.length === 0 ? (
          <Card className="p-8 text-center bg-white border border-slate-200">
            <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-900 mb-1">No Matching Policy Rules</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No policy rules match your selected filters. Adjust your category or search query.
            </p>
          </Card>
        ) : (
          filteredRules.map((rule) => {
            const isExpanded = expandedRuleId === rule.id;
            const isCompliant = rule.status === 'COMPLIANT';
            const isNeedsReview = rule.status === 'NEEDS_REVIEW';

            const statusVariant = isCompliant ? 'sage' : isNeedsReview ? 'gold' : 'red';
            const statusLabel = isCompliant ? 'Compliant' : isNeedsReview ? 'Needs Review' : 'Violation';

            return (
              <Card
                key={rule.id}
                className="p-5 bg-white border border-slate-200 hover:border-slate-300 transition-all rounded-md shadow-subtle space-y-3"
              >
                {/* Rule Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={statusVariant} size="sm">
                      {statusLabel}
                    </Badge>
                    <Badge variant="navy" size="sm">
                      {rule.category}
                    </Badge>
                    <Badge variant="gray" size="sm">
                      {rule.severity}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyClause(rule)}
                      className="text-xs flex items-center gap-1"
                      title="Copy standard model clause"
                    >
                      {copiedRuleId === rule.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Copy Clause</span>
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/negotiate')}
                      className="text-xs flex items-center gap-1"
                      title="Send to Clause Redline Studio"
                    >
                      <Scale className="w-3.5 h-3.5 text-slate-500" />
                      <span>Redline</span>
                    </Button>
                  </div>
                </div>

                {/* Rule Title & Benchmark */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {rule.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed mt-1">
                    <span className="font-semibold text-slate-700">Enterprise Standard: </span>
                    {rule.benchmark}
                  </p>
                </div>

                {/* Evidence Citation Block */}
                <div className="p-3 bg-slate-50 rounded-md border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      Citation: {rule.evidence_source}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {rule.violation_notes}
                    </span>
                  </div>
                  <blockquote className="text-slate-800 italic border-l-2 border-slate-300 pl-2.5 my-1 leading-relaxed">
                    "{rule.evidence_quote}"
                  </blockquote>
                </div>

                {/* Remediation Clause Accordion */}
                <div>
                  <button
                    type="button"
                    onClick={() => setExpandedRuleId(isExpanded ? null : rule.id)}
                    className="text-xs font-semibold text-clario-navy hover:text-slate-900 flex items-center gap-1.5 transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    <span>{isExpanded ? 'Hide Recommended Model Clause' : 'View Recommended Model Clause'}</span>
                  </button>

                  {isExpanded && (
                    <div className="mt-2.5 p-3.5 bg-slate-50 rounded-md border border-slate-200 text-xs space-y-2 animate-in fade-in-50">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                          Fortune 500 Recommended Model Clause
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyClause(rule)}
                          className="text-[11px] text-clario-navy hover:underline font-semibold flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          Copy Clause
                        </button>
                      </div>
                      <p className="text-slate-800 font-mono text-[11px] leading-relaxed bg-white p-3 rounded-md border border-slate-200 select-all">
                        {rule.remediation_clause}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
