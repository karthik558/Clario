import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';
import { api } from '../services/api';
import { DocumentItem, DocumentDetail } from '../types';
import {
  Shield,
  Eye,
  EyeOff,
  Copy,
  Check,
  Download,
  AlertTriangle,
  RotateCcw,
  Layers,
  FileText,
  UserCheck
} from 'lucide-react';

interface SensitiveMatch {
  id: string;
  category: 'pii' | 'financial' | 'entity' | 'legal';
  label: string;
  originalText: string;
  replacementText: string;
  active: boolean;
}

export const RedactionStudioPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [docDetail, setDocDetail] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [redactionStyle, setRedactionStyle] = useState<'blackout' | 'blur' | 'token'>('blackout');
  const [copied, setCopied] = useState(false);

  // Redaction category toggles
  const [togglePii, setTogglePii] = useState(true);
  const [toggleFinancial, setToggleFinancial] = useState(true);
  const [toggleEntity, setToggleEntity] = useState(true);
  const [toggleLegal, setToggleLegal] = useState(false);

  // Manual exclusions / overrides
  const [exemptedIds, setExemptedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.getDocuments()
      .then((docs) => {
        const ready = docs.filter((d) => d.status === 'READY');
        setDocuments(ready);
        if (ready.length > 0) {
          setSelectedDocId(ready[0].id);
        }
      })
      .catch((err) => console.error('Failed to load documents for redaction', err));
  }, []);

  useEffect(() => {
    if (!selectedDocId) return;
    setLoading(true);
    api.getDocument(selectedDocId)
      .then((detail) => {
        setDocDetail(detail);
        setExemptedIds(new Set());
      })
      .catch((err) => console.error('Failed to load document content', err))
      .finally(() => setLoading(false));
  }, [selectedDocId]);

  // Aggregate raw text from chunks
  const fullText = useMemo(() => {
    if (!docDetail?.chunks || docDetail.chunks.length === 0) return '';
    return docDetail.chunks.map((c) => c.content).join('\n\n');
  }, [docDetail]);

  // Detected sensitive items
  const detectedItems = useMemo<SensitiveMatch[]>(() => {
    if (!fullText) return [];
    const items: SensitiveMatch[] = [];
    let counter = 0;

    // 1. PII Patterns (Emails, Phone numbers, Names)
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    let match;
    while ((match = emailRegex.exec(fullText)) !== null) {
      items.push({
        id: `pii-email-${counter++}`,
        category: 'pii',
        label: 'Email Address',
        originalText: match[0],
        replacementText: '[REDACTED_EMAIL]',
        active: togglePii,
      });
    }

    const phoneRegex = /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
    while ((match = phoneRegex.exec(fullText)) !== null) {
      items.push({
        id: `pii-phone-${counter++}`,
        category: 'pii',
        label: 'Phone Number',
        originalText: match[0],
        replacementText: '[REDACTED_PHONE]',
        active: togglePii,
      });
    }

    // 2. Financial Patterns (Dollar figures, fees, rates)
    const moneyRegex = /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?(?:\s?(?:million|billion|thousand|USD))?/gi;
    while ((match = moneyRegex.exec(fullText)) !== null) {
      items.push({
        id: `fin-money-${counter++}`,
        category: 'financial',
        label: 'Monetary Amount',
        originalText: match[0],
        replacementText: '[REDACTED_AMOUNT]',
        active: toggleFinancial,
      });
    }

    const feeRegex = /\b(?:hourly rate|subscription fee|setup fee|annual license fee)\s?(?:of\s?)?:?\s?[^\n.]{3,30}/gi;
    while ((match = feeRegex.exec(fullText)) !== null) {
      items.push({
        id: `fin-fee-${counter++}`,
        category: 'financial',
        label: 'Commercial Rate',
        originalText: match[0],
        replacementText: '[REDACTED_FEE_SCHEDULE]',
        active: toggleFinancial,
      });
    }

    // 3. Corporate Entity Names & Identifiers
    const entityRegex = /\b(?:OpenAI,\s?LLC|OpenAI|Anthropic,\s?PBC|Anthropic|Google LLC|Microsoft Corporation|Amazon Web Services,\s?Inc\.|Delaware Corporation)\b/g;
    while ((match = entityRegex.exec(fullText)) !== null) {
      items.push({
        id: `ent-party-${counter++}`,
        category: 'entity',
        label: 'Corporate Entity',
        originalText: match[0],
        replacementText: '[PARTY_ENTITY]',
        active: toggleEntity,
      });
    }

    // 4. Privileged / Confidential markers
    const privRegex = /\b(?:Privileged and Confidential|Attorney-Client Communication|Work Product|Strictly Confidential)\b/gi;
    while ((match = privRegex.exec(fullText)) !== null) {
      items.push({
        id: `legal-priv-${counter++}`,
        category: 'legal',
        label: 'Privilege Marker',
        originalText: match[0],
        replacementText: '[PRIVILEGED_MARKER]',
        active: toggleLegal,
      });
    }

    // Deduplicate identical occurrences
    const uniqueMap = new Map<string, SensitiveMatch>();
    items.forEach((item) => {
      if (!uniqueMap.has(item.originalText)) {
        uniqueMap.set(item.originalText, item);
      }
    });

    return Array.from(uniqueMap.values());
  }, [fullText, togglePii, toggleFinancial, toggleEntity, toggleLegal]);

  const toggleItemExemption = (id: string) => {
    setExemptedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Render sanitized text based on selected style
  const processedText = useMemo(() => {
    if (!fullText) return '';
    let text = fullText;

    const activeRules = detectedItems.filter((i) => i.active && !exemptedIds.has(i.id));

    // Sort by length descending to prevent partial replacement collision
    activeRules.sort((a, b) => b.originalText.length - a.originalText.length);

    activeRules.forEach((rule) => {
      const escaped = rule.originalText.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');

      if (redactionStyle === 'token') {
        text = text.replace(regex, rule.replacementText);
      } else if (redactionStyle === 'blackout') {
        const bar = '█'.repeat(Math.min(rule.originalText.length, 12));
        text = text.replace(regex, bar);
      } else if (redactionStyle === 'blur') {
        text = text.replace(regex, `[BLURRED: ${rule.label}]`);
      }
    });

    return text;
  }, [fullText, detectedItems, exemptedIds, redactionStyle]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(processedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Non-fatal
    }
  };

  const handleDownload = () => {
    const blob = new Blob([processedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sanitized-${docDetail?.filename || 'contract'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeCount = detectedItems.filter((i) => i.active && !exemptedIds.has(i.id)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Redaction Studio"
        description="Sanitize PII, sensitive commercial rates, corporate entities, and privileged language before sharing documents."
      >
        <div className="flex flex-wrap items-center gap-2">
          {processedText && (
            <>
              <Button variant="outline" size="sm" onClick={handleCopy} className="text-xs">
                {copied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copied ? 'Copied' : 'Copy Sanitized'}
              </Button>
              <Button size="sm" onClick={handleDownload} className="text-xs">
                <Download className="w-3.5 h-3.5 mr-1" />
                Export Clean Document
              </Button>
            </>
          )}
        </div>
      </PageHeader>

      {/* Quick Walkthrough / Guidance Banner */}
      <div className="p-4 rounded-md bg-white border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="flex items-start gap-2.5">
          <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-300 text-slate-800 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
          <div>
            <strong className="text-slate-900 block font-semibold">Select Agreement</strong>
            <p className="text-slate-500 text-[11px] leading-relaxed mt-0.5">
              Choose an indexed document from your corpus. Raw text is aggregated automatically.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-300 text-slate-800 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
          <div>
            <strong className="text-slate-900 block font-semibold">Configure Masking</strong>
            <p className="text-slate-500 text-[11px] leading-relaxed mt-0.5">
              Toggle PII, Financial Rates, Entities, or Privilege, and choose Blackout, Token, or Blur.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-300 text-slate-800 font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
          <div>
            <strong className="text-slate-900 block font-semibold">Review & Export</strong>
            <p className="text-slate-500 text-[11px] leading-relaxed mt-0.5">
              Click individual tokens to exempt or re-mask, then copy or download the sanitized file.
            </p>
          </div>
        </div>
      </div>

      {/* Control Ribbon */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Document Selection & Style Picker */}
        <Card className="lg:col-span-8 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-clario-navy" />
              <span className="text-xs font-semibold uppercase tracking-wider text-clario-navy">
                Document Target
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-semibold text-slate-800">{activeCount}</span>
              <span>active redactions applied</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Select Agreement to Sanitize</label>
              <Select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="w-full text-xs"
              >
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} ({d.file_type.toUpperCase()})
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Redaction Masking Style</label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-md">
                <button
                  type="button"
                  onClick={() => setRedactionStyle('blackout')}
                  className={`py-1 text-xs font-medium rounded-md transition-all ${
                    redactionStyle === 'blackout'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Blackout (███)
                </button>
                <button
                  type="button"
                  onClick={() => setRedactionStyle('token')}
                  className={`py-1 text-xs font-medium rounded-md transition-all ${
                    redactionStyle === 'token'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Token ([ID])
                </button>
                <button
                  type="button"
                  onClick={() => setRedactionStyle('blur')}
                  className={`py-1 text-xs font-medium rounded-md transition-all ${
                    redactionStyle === 'blur'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Blur Preview
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Protection Categories */}
        <Card className="lg:col-span-4 p-4 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Sensitivity Filters
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExemptedIds(new Set())}
              className="text-[11px] h-6 px-2 text-slate-600"
            >
              Reset All
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
            <label className="flex items-center gap-2 p-2 rounded-md border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={togglePii}
                onChange={(e) => setTogglePii(e.target.checked)}
                className="rounded border-slate-300 text-clario-navy focus:ring-0"
              />
              <span className="font-medium text-slate-800">PII & Contact</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-md border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={toggleFinancial}
                onChange={(e) => setToggleFinancial(e.target.checked)}
                className="rounded border-slate-300 text-clario-navy focus:ring-0"
              />
              <span className="font-medium text-slate-800">Financial Rates</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-md border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={toggleEntity}
                onChange={(e) => setToggleEntity(e.target.checked)}
                className="rounded border-slate-300 text-clario-navy focus:ring-0"
              />
              <span className="font-medium text-slate-800">Entity Names</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-md border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={toggleLegal}
                onChange={(e) => setToggleLegal(e.target.checked)}
                className="rounded border-slate-300 text-clario-navy focus:ring-0"
              />
              <span className="font-medium text-slate-800">Legal Privilege</span>
            </label>
          </div>
        </Card>
      </div>

      {/* Main Studio Workspace: Detected Entities vs Redacted Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Panel: Detected Sensitive Entities List */}
        <Card className="lg:col-span-4 p-4 flex flex-col h-[640px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Detected Sensitive Tokens ({detectedItems.length})
            </span>
            <span className="text-[11px] text-slate-400">Click to toggle</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {detectedItems.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No sensitive items detected under current filter settings.
              </div>
            ) : (
              detectedItems.map((item) => {
                const isExempted = exemptedIds.has(item.id);
                const isMasked = item.active && !isExempted;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleItemExemption(item.id)}
                    className={`w-full text-left p-2.5 rounded-md border transition-all flex items-start justify-between gap-2 text-xs ${
                      isMasked
                        ? 'border-slate-300 bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/5'
                        : 'border-slate-200 bg-slate-50 text-slate-400 line-through hover:bg-slate-100'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge variant="gray" size="sm">
                          {item.label}
                        </Badge>
                      </div>
                      <p className="font-mono text-[11px] truncate text-slate-800">{item.originalText}</p>
                    </div>

                    <div className="shrink-0 mt-0.5">
                      {isMasked ? (
                        <EyeOff className="w-3.5 h-3.5 text-slate-700" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Right Panel: Live Redacted Document View */}
        <Card className="lg:col-span-8 p-5 flex flex-col h-[640px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-clario-navy" />
              <span className="text-xs font-semibold text-slate-800">
                {docDetail?.title || 'Document Preview'}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                ({docDetail?.word_count?.toLocaleString() || 0} words)
              </span>
            </div>

            <Badge variant="navy" size="sm">
              Live Sanitization Active
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto rounded-md bg-slate-50 border border-slate-200 p-5 font-mono text-xs text-slate-800 leading-relaxed whitespace-pre-wrap selection:bg-slate-200">
            {loading ? (
              <div className="text-center py-20 text-slate-400">Loading document text…</div>
            ) : processedText ? (
              processedText
            ) : (
              <div className="text-center py-20 text-slate-400">Select a document to begin sanitization.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
