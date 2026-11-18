import { PageHeader } from '../components/layout/PageHeader';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Download,
  Copy,
  Check,
  Building,
  Briefcase,
  Layers,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import { BriefResponse, DocumentItem } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export const BriefsPage: React.FC = () => {
  const navigate = useNavigate();
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('board_executive');
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchInitialBrief = async () => {
    try {
      setLoading(true);
      setError('');
      const [briefRes, docs, availableTemplates] = await Promise.all([
        api.generateBrief('board_executive'),
        api.getDocuments(),
        api.getBriefTemplates()
      ]);
      if (briefRes) setBrief(briefRes);
      setDocuments(docs);
      setTemplates(availableTemplates);
    } catch (err) {
      setError('Could not load the workspace briefing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialBrief();
  }, []);

  const handleGenerate = async (templateId?: string) => {
    const tId = templateId || selectedTemplate;
    try {
      setGenerating(true);
      setError('');
      const res = await api.generateBrief(tId);
      setBrief(res);
      setSelectedTemplate(tId);
    } catch (err) {
      setError('Could not generate the requested briefing.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!brief) return;
    const text = `# ${brief.title}\nDate: ${brief.generated_date}\n\n## Executive Summary\n${brief.executive_summary}\n\n## Key Recommendation\n${brief.key_recommendation}\n\n## Financial Exposure\n${brief.financial_exposure.map(f => `- **${f.label}**: ${f.detail}`).join('\n')}\n\n## Legal & Compliance Risks\n${brief.legal_risks.map(r => `- **${r.item}** (${r.status}): ${r.assessment}`).join('\n')}\n\n## Action Items\n${brief.action_items.map(a => `- ${a}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader title="Executive briefs" description="Prepare a decision-ready summary of the documents under review.">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={!brief}
            className="flex items-center gap-1.5"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Memorandum</span>
              </>
            )}
          </Button>

          <Button
            size="sm"
            onClick={() => handleGenerate(selectedTemplate)}
            loading={generating}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{generating ? 'Synthesizing...' : 'Re-Generate Briefing'}</span>
          </Button>
        </div>
      </PageHeader>

      {error && <p role="alert" className="rounded-md border bg-white p-4 text-sm">{error} <button className="underline" onClick={fetchInitialBrief}>Reload</button></p>}

      {/* Template Chooser Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {templates.map((tmpl) => {
          const isSelected = selectedTemplate === tmpl.id;
          const Icon = ({board_executive: Building, ma_due_diligence: Briefcase}[tmpl.id] || Layers);
          return (
            <button
              key={tmpl.id}
              onClick={() => handleGenerate(tmpl.id)}
              className={`p-4 rounded-lg border text-left transition-all ${
                isSelected
                  ? 'border-slate-900 bg-slate-50/70 shadow-xs ring-1 ring-slate-900'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-800">
                  <Icon className="w-4 h-4" />
                </div>
                {isSelected && (
                  <Badge variant="navy" size="sm">
                    Active
                  </Badge>
                )}
              </div>
              <h3 className="text-xs font-bold text-slate-900">{tmpl.name}</h3>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{tmpl.description}</p>
            </button>
          );
        })}
      </div>

      {/* Generated Briefing Document */}
      {error ? null : !loading && documents.length === 0 ? (
        <Card className="p-10 text-center bg-white border border-slate-200">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-900 mb-1">No Documents in Workspace</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
            Upload contracts, vendor agreements, or regulatory policies in the Document Library to synthesize an executive risk briefing.
          </p>
          <Button variant="secondary" size="sm" onClick={() => navigate('/documents')}>
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Go to Document Library
          </Button>
        </Card>
      ) : loading ? (
        <div className="py-16 text-center text-xs text-slate-500">
          Compiling executive intelligence memorandum...
        </div>
      ) : !brief ? (
        <Card className="p-10 text-center bg-white border border-slate-200">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500">No brief available. Select a template above to generate.</p>
        </Card>
      ) : (
        <Card className="[overflow-wrap:anywhere] p-6 sm:p-8 bg-white border border-slate-200 shadow-sm space-y-6">
          {/* Header Memo Style */}
          <div className="border-b border-slate-200 pb-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">
                CONFIDENTIAL • BOARD EXECUTIVE MEMORANDUM
              </span>
              <span className="text-xs font-mono text-slate-500">{brief.generated_date}</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {brief.title}
            </h2>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
              <span>
                <strong>Audited Corpus:</strong> {brief.audited_documents.length} Document(s)
              </span>
              <span>•</span>
              <span>
                <strong>Flagged Exposures:</strong> {brief.critical_findings_count} Critical / High
              </span>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Executive Summary
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-md border border-slate-200">
              {brief.executive_summary}
            </p>
          </div>

          {/* Key Recommendation Banner */}
          <div className="p-4 rounded-md bg-white border-l-4 border-l-clario-navy border border-slate-200 shadow-xs space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-clario-navy block">
              Primary Executive Decision / Action Required
            </span>
            <p className="text-xs font-medium text-slate-800 leading-relaxed">
              {brief.key_recommendation}
            </p>
          </div>

          {/* Two-Column Grid: Financial Exposure & Legal Risks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Financial Exposure */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-1 border-b border-slate-100">
                Financial Exposure & Liability Ceiling
              </h3>
              <div className="space-y-2.5">
                {brief.financial_exposure.map((f, i) => (
                  <div key={i} className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1">
                    <span className="text-xs font-bold text-slate-900 block">{f.label}</span>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{f.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Legal & Compliance Risks */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-1 border-b border-slate-100">
                Legal & Governance Risk Matrix
              </h3>
              <div className="space-y-2.5">
                {brief.legal_risks.map((r, i) => (
                  <div key={i} className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1">
                    <div className="flex flex-wrap gap-2 items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{r.item}</span>
                      <Badge variant={r.status === 'Action Required' ? 'red' : 'navy'} size="sm">
                        {r.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{r.assessment}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Items Roadmap */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Immediate Strategic Action Items
            </h3>
            <ul className="space-y-2">
              {brief.action_items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-slate-800 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}
    </div>
  );
};
