import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Download,
  RotateCcw,
  ClipboardCheck,
  Check,
  Copy
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { DocumentItem } from '../../types';

export interface AuditCheckItem {
  id: string;
  category: string;
  title: string;
  standardRequirement: string;
  status: 'compliant' | 'warning' | 'critical' | 'pending';
  findings: string;
  notes?: string;
}

export interface AuditPlaybook {
  id: string;
  name: string;
  description: string;
  badge: string;
  checks: AuditCheckItem[];
}

const AUDIT_PLAYBOOKS: AuditPlaybook[] = [
  {
    id: 'ma_due_diligence',
    name: 'M&A Due Diligence Checklist',
    description: 'Transaction-readiness review focusing on assignment, change-of-control, exclusivity, and liability super-caps.',
    badge: 'Transactional',
    checks: [
      {
        id: 'coc',
        category: 'Corporate Structuring',
        title: 'Change of Control & Assignment',
        standardRequirement: 'Agreement must permit assignment without counterparty consent upon merger, acquisition, or sale of substantial assets.',
        status: 'compliant',
        findings: 'Permits assignment upon corporate reorganization with 30-day written notice; no termination trigger.',
      },
      {
        id: 'exclusivity',
        category: 'Commercial Restrictions',
        title: 'Exclusivity & Non-Compete Clauses',
        standardRequirement: 'No restrictive covenants barring acquirer or affiliates from entering competing commercial lines.',
        status: 'compliant',
        findings: 'No customer non-solicitation or commercial exclusivity restrictions identified.',
      },
      {
        id: 'ip_assignment',
        category: 'Intellectual Property',
        title: 'IP Ownership & Deliverable Rights',
        standardRequirement: 'Customer retains sole ownership of customer data, proprietary configurations, and developed IP.',
        status: 'compliant',
        findings: 'Customer owns all work product and derivative workflows; vendor retains only pre-existing core platform IP.',
      },
      {
        id: 'super_caps',
        category: 'Liability Exposure',
        title: 'Liability Super-Cap Multipliers',
        standardRequirement: 'Overall exposure capped at 12-month trailing fees; indemnity carve-outs strictly defined.',
        status: 'warning',
        findings: 'General liability capped at 12-month spend, but confidentiality breach indemnity has a 3x super-cap requiring disclosure in deal schedule.',
      },
      {
        id: 'term_convenience',
        category: 'Operational Risk',
        title: 'Termination for Convenience',
        standardRequirement: 'Customer maintains right to terminate upon 30-60 days notice without accelerated fee penalties.',
        status: 'compliant',
        findings: 'Standard 30-day notice permitted without unamortized equipment or licensing clawbacks.',
      },
    ],
  },
  {
    id: 'gdpr_privacy',
    name: 'GDPR & Privacy Vendor Assessment',
    description: 'Statutory compliance audit against Article 28 DPA requirements, breach notification SLAs, and cross-border transfers.',
    badge: 'Regulatory',
    checks: [
      {
        id: 'subprocessor',
        category: 'Data Governance',
        title: 'Sub-Processor Prior Notification',
        standardRequirement: 'Minimum 30 calendar days written advance notice before engaging or replacing sub-processors.',
        status: 'compliant',
        findings: '30-day email notification commitment with explicit customer right to object or terminate.',
      },
      {
        id: 'breach_sla',
        category: 'Security Compliance',
        title: 'Security Incident Notification SLA',
        standardRequirement: 'Notification without undue delay and strictly within 48-72 hours of confirmed breach.',
        status: 'compliant',
        findings: '48-hour formal incident notification timeline with preliminary forensic summary delivery.',
      },
      {
        id: 'cross_border',
        category: 'Data Sovereignty',
        title: 'Cross-Border Transfer Safeguards',
        standardRequirement: 'Standard Contractual Clauses (EU SCCs 2021) or certified adequacy decisions implemented.',
        status: 'warning',
        findings: 'EU-US Data Privacy Framework invoked; verification of standard fallback clauses recommended.',
      },
      {
        id: 'data_deletion',
        category: 'Data Lifecycle',
        title: 'Post-Termination Return / Erasure',
        standardRequirement: 'Prompt deletion or return of all personal data within 30-60 days with written certification.',
        status: 'compliant',
        findings: '30-day automated purge window upon contract expiration with crypto-erasure attestation.',
      },
      {
        id: 'audit_rights',
        category: 'Oversight',
        title: 'Direct / Third-Party Audit Rights',
        standardRequirement: 'Annual SOC 2 Type II or ISO 27001 report provision; reasonable on-premises audit access upon breach.',
        status: 'compliant',
        findings: 'Annual SOC 2 Type II delivery guaranteed; customer right to audit upon security incident.',
      },
    ],
  },
  {
    id: 'ai_governance',
    name: 'AI Model Safety & Training Rights',
    description: 'Enterprise AI procurement governance ensuring prompt isolation, output warranty, and model copyright indemnification.',
    badge: 'Emerging Tech',
    checks: [
      {
        id: 'training_opt_out',
        category: 'Data Protection',
        title: 'Zero Customer Data Training Rights',
        standardRequirement: 'Unconditional guarantee that customer prompts, inputs, and outputs are never utilized for model training.',
        status: 'compliant',
        findings: 'Explicit contractual exclusion: zero retention of inputs/outputs for training or base model weights.',
      },
      {
        id: 'copyright_indemnity',
        category: 'Legal Defense',
        title: 'Generative AI Copyright Indemnification',
        standardRequirement: 'Vendor defends and indemnifies customer against third-party copyright claims stemming from generated output.',
        status: 'compliant',
        findings: 'Full customer indemnification for outputs generated in accordance with acceptable use guidelines.',
      },
      {
        id: 'retention_window',
        category: 'Information Security',
        title: 'Ephemeral Processing & Data Isolation',
        standardRequirement: 'Zero data retention or maximum 30-day transient logging for abuse monitoring only.',
        status: 'compliant',
        findings: 'Ephemeral processing in memory; encrypted zero-data retention pipelines enabled.',
      },
      {
        id: 'model_availability',
        category: 'Service Level Agreement',
        title: 'Model Version Pinning & Deprecation',
        standardRequirement: 'Minimum 6 months advance notice prior to retiring or degrading pinned foundation model endpoints.',
        status: 'warning',
        findings: '90-day deprecation notice provided; negotiate extension to 180 days for enterprise stability.',
      },
    ],
  },
];

interface GuidedAuditWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: DocumentItem[];
}

export const GuidedAuditWizardModal: React.FC<GuidedAuditWizardModalProps> = ({
  isOpen,
  onClose,
  documents,
}) => {
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string>('ma_due_diligence');
  const [selectedDocId, setSelectedDocId] = useState<string>(documents[0]?.id || '');
  const [playbookStates, setPlaybookStates] = useState<Record<string, AuditCheckItem[]>>(() => {
    const initial: Record<string, AuditCheckItem[]> = {};
    AUDIT_PLAYBOOKS.forEach((pb) => {
      initial[pb.id] = pb.checks.map((c) => ({ ...c }));
    });
    return initial;
  });
  const [activeCheckId, setActiveCheckId] = useState<string>(
    AUDIT_PLAYBOOKS[0].checks[0].id
  );
  const [copiedMemo, setCopiedMemo] = useState(false);

  const activePlaybook = AUDIT_PLAYBOOKS.find((p) => p.id === selectedPlaybookId) || AUDIT_PLAYBOOKS[0];
  const currentChecks = playbookStates[selectedPlaybookId] || activePlaybook.checks;
  const activeCheck = currentChecks.find((c) => c.id === activeCheckId) || currentChecks[0];
  const targetDoc = documents.find((d) => d.id === selectedDocId) || documents[0];

  const compliantCount = currentChecks.filter((c) => c.status === 'compliant').length;
  const warningCount = currentChecks.filter((c) => c.status === 'warning').length;
  const criticalCount = currentChecks.filter((c) => c.status === 'critical').length;
  const totalCount = currentChecks.length;
  const scorePercent = Math.round((compliantCount / totalCount) * 100);

  const handleUpdateStatus = (status: 'compliant' | 'warning' | 'critical') => {
    setPlaybookStates((prev) => ({
      ...prev,
      [selectedPlaybookId]: prev[selectedPlaybookId].map((c) =>
        c.id === activeCheckId ? { ...c, status } : c
      ),
    }));
  };

  const handleUpdateNotes = (notes: string) => {
    setPlaybookStates((prev) => ({
      ...prev,
      [selectedPlaybookId]: prev[selectedPlaybookId].map((c) =>
        c.id === activeCheckId ? { ...c, notes } : c
      ),
    }));
  };

  const handleCopyAuditMemo = () => {
    const memo = [
      `======================================================`,
      `CLARIO LEGAL AUDIT MEMO: ${activePlaybook.name.toUpperCase()}`,
      `======================================================`,
      `Document: ${targetDoc?.title || 'Active Agreement'} (${targetDoc?.filename || 'N/A'})`,
      `Audit Date: ${new Date().toLocaleDateString(undefined, { dateStyle: 'full' })}`,
      `Overall Score: ${scorePercent}% Compliance (${compliantCount}/${totalCount} Verified)`,
      `Status Breakdown: ${compliantCount} Compliant | ${warningCount} Action Items | ${criticalCount} Critical`,
      ``,
      `CHECKPOINT DETAILS:`,
      ...currentChecks.map((c, idx) =>
        `[${idx + 1}] ${c.title.toUpperCase()} (${c.category})\n` +
        `    Standard: ${c.standardRequirement}\n` +
        `    Status: ${c.status.toUpperCase()}\n` +
        `    Findings: ${c.findings}\n` +
        (c.notes ? `    Counsel Notes: ${c.notes}\n` : '')
      ),
      `======================================================`,
      `Generated by Clario Contract Intelligence System`,
    ].join('\n');

    navigator.clipboard.writeText(memo);
    setCopiedMemo(true);
    setTimeout(() => setCopiedMemo(false), 2500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Guided Contract Audit & Compliance Wizard"
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Playbook Selection Bar */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-700 shrink-0">Playbook:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {AUDIT_PLAYBOOKS.map((pb) => (
                  <button
                    key={pb.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlaybookId(pb.id);
                      setActiveCheckId(pb.checks[0].id);
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      selectedPlaybookId === pb.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                    }`}
                  >
                    <span>{pb.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {documents.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-medium text-slate-500 shrink-0">Document:</span>
                <div className="w-64 max-w-full">
                  <Select
                    aria-label="Target Document"
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className="w-full text-xs py-1 px-2.5 bg-white border border-slate-200 rounded-md shadow-2xs font-medium text-slate-800"
                  >
                    {documents.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Progress & Executive Score Banner */}
        <div className="p-4 rounded-md bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                Audit Progress: {compliantCount} of {totalCount} Checkpoints Verified
              </span>
              <Badge variant={scorePercent >= 80 ? 'sage' : scorePercent >= 60 ? 'gold' : 'red'} size="sm">
                {scorePercent}% Verified
              </Badge>
            </div>
            <div className="w-full sm:w-72 h-2 bg-slate-100 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-600 transition-all duration-300"
                style={{ width: `${(compliantCount / totalCount) * 100}%` }}
              />
              <div
                className="bg-amber-500 transition-all duration-300"
                style={{ width: `${(warningCount / totalCount) * 100}%` }}
              />
              <div
                className="bg-rose-500 transition-all duration-300"
                style={{ width: `${(criticalCount / totalCount) * 100}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyAuditMemo}
              className="text-xs flex items-center gap-1.5"
            >
              {copiedMemo ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedMemo ? 'Audit Memo Copied!' : 'Export Audit Memo'}</span>
            </Button>
          </div>
        </div>

        {/* 2-Column Interactive Workspace */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* Left Checklist Stream */}
          <div className="md:col-span-5 space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {currentChecks.map((check, idx) => {
              const isSelected = activeCheck.id === check.id;
              return (
                <div
                  key={check.id}
                  onClick={() => setActiveCheckId(check.id)}
                  className={`p-3 rounded-md border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Step #{idx + 1} &bull; {check.category}
                    </span>
                    <Badge
                      variant={
                        check.status === 'compliant'
                          ? 'sage'
                          : check.status === 'warning'
                          ? 'gold'
                          : 'red'
                      }
                      size="sm"
                    >
                      {check.status === 'compliant' ? 'Compliant' : check.status === 'warning' ? 'Needs Review' : 'Deficiency'}
                    </Badge>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 truncate">{check.title}</h4>
                  <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{check.findings}</p>
                </div>
              );
            })}
          </div>

          {/* Right Detailed Checkpoint Inspector */}
          <div className="md:col-span-7 p-4 bg-slate-50 rounded-md border border-slate-200 space-y-3.5">
            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                  {activeCheck.category}
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">{activeCheck.title}</h3>
              </div>
              <Badge variant="navy" size="sm">{activePlaybook.badge}</Badge>
            </div>

            <div className="space-y-1">
              <span className="text-[10.5px] font-bold text-slate-600 uppercase tracking-wider">
                Standard Benchmark Requirement
              </span>
              <p className="text-xs text-slate-800 bg-white p-2.5 rounded-md border border-slate-200 leading-relaxed font-sans">
                {activeCheck.standardRequirement}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[10.5px] font-bold text-slate-600 uppercase tracking-wider">
                Synthesized Document Findings
              </span>
              <p className="text-xs text-slate-800 bg-white p-2.5 rounded-md border border-slate-200 leading-relaxed font-mono">
                {activeCheck.findings}
              </p>
            </div>

            {/* Status Selector */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wider">
                Counsel Verification Assessment
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateStatus('compliant')}
                  className={`p-2.5 rounded-md border text-center text-xs font-semibold transition-all ${
                    activeCheck.status === 'compliant'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 mx-auto mb-1 ${activeCheck.status === 'compliant' ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span>Compliant</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateStatus('warning')}
                  className={`p-2.5 rounded-md border text-center text-xs font-semibold transition-all ${
                    activeCheck.status === 'warning'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <AlertTriangle className={`w-3.5 h-3.5 mx-auto mb-1 ${activeCheck.status === 'warning' ? 'text-amber-400' : 'text-slate-500'}`} />
                  <span>Needs Review</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateStatus('critical')}
                  className={`p-2.5 rounded-md border text-center text-xs font-semibold transition-all ${
                    activeCheck.status === 'critical'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <XCircle className={`w-3.5 h-3.5 mx-auto mb-1 ${activeCheck.status === 'critical' ? 'text-rose-400' : 'text-slate-500'}`} />
                  <span>Deficiency</span>
                </button>
              </div>
            </div>

            {/* Counsel Notes */}
            <div className="space-y-1 pt-1">
              <span className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wider">
                Auditor / Attorney Notes
              </span>
              <textarea
                rows={2}
                value={activeCheck.notes || ''}
                onChange={(e) => handleUpdateNotes(e.target.value)}
                placeholder="Add disclosure note, deal schedule carve-out, or amendment request..."
                className="w-full text-xs p-2.5 border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:border-slate-800 font-sans resize-none shadow-xs"
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
