import { useOutletContext } from 'react-router-dom';
import { AskSources, useAskDocuments, useAskSelection } from '../components/documents/AskSources';
import { PageHeader } from '../components/layout/PageHeader';
import { Select } from '../components/ui/Select';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send,
  SearchCheck,
  Bookmark,
  Clock,
  AlertTriangle,
  FileText,
  ChevronRight,
  Copy,
  Check,
  RotateCcw,
  Cpu,
  Brain,
  Radio,
  SlidersHorizontal,
  Bot,
  User,
  Layers,
  ShieldCheck,
  CheckCheck,
  FileSearch,
  GitCompare
} from 'lucide-react';
import { api } from '../services/api';
import { AskResponse, CitationItem } from '../types';
import { Markdown } from '../components/ui/Markdown';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DocumentViewerModal } from '../components/documents/DocumentViewerModal';
import { GuidedAuditWizardModal } from '../components/audit/GuidedAuditWizardModal';

const PROMPT_CAROUSEL = [
  { label: 'Liability Super-Caps', query: 'What are the aggregate liability super-caps and indemnity carve-outs across the agreements?' },
  { label: 'AI Model Training Rights', query: 'Do any of the agreements permit customer confidential data or inputs to be used for AI foundation model training?' },
  { label: 'Breach SLA & Forensics', query: 'Compare the security incident notification SLAs and forensic timeline commitments.' },
  { label: 'Termination Delta', query: 'What notice periods and cure windows are required for termination for convenience vs material breach?' },
  { label: 'Mutual Indemnity', query: 'Is indemnification reciprocal, or are there unilateral customer indemnity obligations?' },
  { label: 'Data Sovereignty', query: 'Where is customer confidential data stored and processed geographically?' },
];

export const AskPage: React.FC = () => {
  const handoff = useOutletContext<{ selection: ReturnType<typeof useAskSelection>; askDraft: string | null; setAskDraft: (value: string | null) => void } | null>();
  const [query, setQuery] = useState(handoff?.askDraft ?? '');
  const fromQuickAsk = useRef(handoff?.askDraft != null);
  const questionInput = useRef<HTMLTextAreaElement>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingMode, setStreamingMode] = useState(false);
  const [streamAnswer, setStreamAnswer] = useState('');
  const [streamThinking, setStreamThinking] = useState('');
  const [streamCitations, setStreamCitations] = useState<CitationItem[]>([]);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [history, setHistory] = useState<Array<{ query: string; response: AskResponse }>>([]);
  const { documents, error: sourceError } = useAskDocuments(true);
  const standaloneSelection = useAskSelection();
  const selection = handoff?.selection ?? standaloneSelection;
  const selectedDocIds = selection.ids;
  const [selectedCitation, setSelectedCitation] = useState<CitationItem | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showAuditWizard, setShowAuditWizard] = useState(false);
  const [answerViewMode, setAnswerViewMode] = useState<Record<number, 'synthesis' | 'verbatim'>>({});

  // Local AI Gateway & Engine States
  const [llmProvider, setLlmProvider] = useState<string>('ollama');
  const [localModel, setLocalModel] = useState<string>('gemma3:latest');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [savingThinking, setSavingThinking] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [thinkingMode, setThinkingMode] = useState<boolean>(true);

  const [error, setError] = useState('');
  const [pendingQuery, setPendingQuery] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [expandedCitations, setExpandedCitations] = useState<Record<number, boolean>>({});
  const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loadingHistory && fromQuickAsk.current) {
      fromQuickAsk.current = false;
      handoff?.setAskDraft(null);
      questionInput.current?.focus();
    }
  }, [loadingHistory, handoff]);

  // Handle URL query parameters (e.g. from Compare versions or Document Library)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const search = new URLSearchParams(window.location.search);
    const docParams = [
      ...search.getAll('document'),
      ...search.getAll('doc'),
      ...(search.get('docs')?.split(',') || [])
    ].filter(Boolean);

    if (docParams.length > 0) {
      selection.select(docParams);
    }

    const qParam = search.get('q') || search.get('query');
    if (qParam) {
      setQuery(qParam);
      setTimeout(() => {
        questionInput.current?.focus();
      }, 150);
    }
  }, []);

  const toggleCitations = (idx: number) => {
    setExpandedCitations(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const toggleThinking = (idx: number) => {
    setExpandedThinking(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const refreshModelList = async (provider: string) => {
    try {
      const status = await api.getLocalAIStatus(provider);
      setAvailableModels(status.models || []);
      if (status.models && status.models.length > 0) {
        if (!status.models.includes(localModel)) {
          setLocalModel(status.active_model || status.models[0]);
        }
      }
      setStatusMessage(status.message);
    } catch {
      setStatusMessage('Local server unreachable');
    }
  };

  useEffect(() => {
    api.getSettings().then((s) => {
      if (s.thinking_mode !== undefined) {
        setThinkingMode(s.thinking_mode);
      }
      if (s.llm_provider) {
        setLlmProvider(s.llm_provider);
      }
      if (s.local_ai_model) {
        setLocalModel(s.local_ai_model);
      }
      setSettingsLoaded(true);
      refreshModelList(s.llm_provider || 'ollama');
    }).catch(() => {
      setSettingsLoaded(true);
      refreshModelList('ollama');
    });

    api.getAnswerHistory().then((rows) => {
      setHistory(rows.map((row) => ({ query: row.query, response: row.response })));
    }).catch(() => {
      // Non-fatal
    }).finally(() => {
      setLoadingHistory(false);
    });
  }, []);

  const handleSwitchProvider = async (provider: string) => {
    setLlmProvider(provider);
    await refreshModelList(provider);
    try {
      await api.updateSettings({ llm_provider: provider });
    } catch (err) {
      console.error('Failed to persist LLM provider setting', err);
    }
  };

  const toggleThinkingMode = async () => {
    if (savingThinking) return;
    const next = !thinkingMode;
    setThinkingMode(next);
    setSavingThinking(true);
    try {
      await api.updateSettings({ thinking_mode: next });
    } catch (err) {
      console.error('Failed to update thinking mode', err);
      setThinkingMode(!next);
    } finally {
      setSavingThinking(false);
    }
  };

  const handleAsk = async (explicitQuery?: string) => {
    const q = (explicitQuery ?? query).trim();
    if (!q || loading || loadingHistory) return;

    setError('');
    setQuery('');
    setLoading(true);
    setPendingQuery(q);

    const docIds = selectedDocIds.length > 0 ? selectedDocIds : undefined;

    // Streaming SSE Path
    if (streamingMode) {
      setStreaming(true);
      setStreamAnswer('');
      setStreamThinking('');
      setStreamCitations([]);

      try {
        const doneResponse = await api.streamAsk(
          {
            query: q,
            document_ids: docIds,
            thinking_mode: thinkingMode,
            local_model: localModel || undefined,
            llm_provider: llmProvider
          },
          {
            onToken: (token: string) => {
              setStreamAnswer((prev) => prev + token);
            },
            onThinking: (thinking: string) => {
              setStreamThinking(thinking);
            },
            onCitations: (cits: CitationItem[]) => {
              setStreamCitations(cits);
            }
          }
        );

        setResponse(doneResponse);
        setHistory((prev) => [...prev, { query: q, response: doneResponse }]);
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } catch (err: any) {
        setQuery(q);
        setError(`Streaming error: ${err.message || 'Check local model connection'}`);
      } finally {
        setStreaming(false);
        setLoading(false);
        setPendingQuery('');
      }
      return;
    }

    // Standard Non-Streaming Ask
    try {
      const res = await api.ask(q, docIds, undefined, thinkingMode, localModel || undefined, llmProvider);
      setResponse(res);
      setHistory((prev) => [...prev, { query: q, response: res }]);
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      setQuery(q);
      setError(`The answer could not be generated or saved. ${err instanceof Error ? err.message : 'Please try again.'}`);
    } finally {
      setLoading(false);
      setPendingQuery('');
    }
  };

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError('Could not copy text.');
      return;
    }
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleClearHistory = async () => {
    if (loading || clearing) return;
    setClearing(true);
    try {
      await api.clearAnswerHistory();
      setHistory([]);
      setResponse(null);
      setQuery('');
      setPendingQuery('');
      setError('');
    } catch {
      setError('Could not clear conversation history. Please try again.');
    } finally {
      setClearing(false);
    }
  };

  const presets = useMemo(() => {
    const pool = documents.filter(doc => doc.status === 'READY' && (!selectedDocIds.length || selectedDocIds.includes(doc.id)));
    const docA = pool[0]?.title || 'Anthropic Claude Policy 2026';
    const docB = pool[1]?.title || 'OpenAI Policy 2026';

    if (pool.length >= 2) {
      return [
        `What are the key differences between ${docA} and ${docB}?`,
        `Compare the liability limits, warranties, and indemnification caps in ${docA} vs ${docB}.`,
        `What are the data retention and security commitments specified in ${docA}?`,
        `Are there conflicting terms or termination notice deltas between ${docA} and ${docB}?`
      ];
    } else {
      return [
        `Provide a comprehensive summary of key clauses in ${docA}.`,
        `What are the governing terms, liability caps, and breach notifications in ${docA}?`,
        `What data privacy, retention, and security commitments are outlined in ${docA}?`,
        `Identify any potential risks, warranties, or unhedged indemnities in ${docA}.`
      ];
    }
  }, [documents, selectedDocIds]);

  return (
    <div className="space-y-6">
      {/* Page Header matching Overview, Documents, Compare, Negotiate */}
      <PageHeader
        title="Ask Clario"
        description="Ask questions across your documents and follow each answer back to its sources."
      >
        <div className="flex flex-wrap items-center gap-2">
          {history.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearHistory}
              disabled={clearing || loading}
              className="text-xs text-slate-700 hover:text-rose-600 hover:border-rose-300 flex items-center gap-1.5"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${clearing ? 'animate-spin' : ''}`} />
              <span>{clearing ? 'Clearing…' : 'New Conversation'}</span>
            </Button>
          )}
        </div>
      </PageHeader>

      {error && (
        <div role="alert" className="p-3.5 border border-rose-200 bg-rose-50 text-rose-800 rounded-md text-sm">
          {error}
        </div>
      )}
      {loadingHistory && <p role="status" className="text-sm text-slate-500">Loading saved answers…</p>}

      {/* KPI Stat Ribbon matching Overview and Documents */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">AI Provider</span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <Cpu className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-xl font-semibold tracking-tight text-clario-navy font-mono truncate">
            {llmProvider === 'ollama' ? 'Ollama Local' : 'LM Studio'}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1 truncate">
            {localModel || 'Default model'}
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Document Scope</span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {selectedDocIds.length > 0 ? `${selectedDocIds.length} Selected` : `${documents.length} Files`}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            {selectedDocIds.length > 0 ? 'Targeted retrieval' : 'Entire workspace corpus'}
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Verification Engine</span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <Brain className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-xl font-semibold tracking-tight text-clario-navy font-mono">
            {thinkingMode ? 'Deep Thinking' : 'Direct Answer'}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            {streamingMode ? 'Streaming active' : 'Batch synthesis'}
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Gateway Status</span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <Bot className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-xl font-semibold tracking-tight text-clario-navy font-mono truncate">
            {statusMessage || 'Connected'}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Low latency pipeline
          </span>
        </Card>
      </div>

      {/* Local AI Gateway & Engine Toolbar */}
      <Card className="p-0 overflow-hidden">
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-slate-700 flex items-center justify-between p-4 hover:bg-slate-50 transition-colors select-none [&::-webkit-details-marker]:hidden list-none">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-clario-navy" />
              <span className="font-semibold text-clario-navy text-xs uppercase tracking-wider">Answer settings</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-normal text-slate-500">
              <span className="hidden sm:inline">{llmProvider === 'ollama' ? 'Ollama' : 'LM Studio'} • {localModel || 'Auto'} • Thinking {thinkingMode ? 'ON' : 'OFF'}</span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-open:rotate-90 transition-transform" />
            </div>
          </summary>
          <div className="p-4 pt-1 border-t border-slate-100 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Provider Selector */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-clario-navy flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-clario-navy" />
                  AI Engine:
                </span>
                <button
                  type="button"
                  onClick={() => handleSwitchProvider('ollama')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    llmProvider === 'ollama'
                      ? 'bg-clario-navy text-white border-clario-navy'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Ollama Local
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchProvider('openai_compatible')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    llmProvider === 'openai_compatible'
                      ? 'bg-clario-navy text-white border-clario-navy'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  LM Studio / vLLM
                </button>
              </div>

              {/* Thinking Mode & Streaming Toggles */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={toggleThinkingMode}
                  disabled={!settingsLoaded || savingThinking || loading}
                  aria-pressed={thinkingMode}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                    thinkingMode
                      ? 'bg-navy-50 text-navy-900 border-navy-800 ring-1 ring-navy-800'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Extract or synthesize step-by-step reasoning"
                >
                  <Brain className={`w-3.5 h-3.5 ${thinkingMode ? 'text-navy-900' : 'text-slate-400'}`} />
                  <span>Thinking Mode: {settingsLoaded ? (thinkingMode ? 'ON' : 'OFF') : '…'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStreamingMode((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                    streamingMode
                      ? 'bg-teal-50 text-teal-900 border-teal-700 ring-1 ring-teal-700'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Stream tokens in real-time"
                >
                  <Radio className={`w-3.5 h-3.5 ${streamingMode ? 'text-teal-700' : 'text-slate-400'}`} />
                  <span>Stream answers: {streamingMode ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            </div>

            {/* Model Picker for Local Endpoints */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-100 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-500 font-medium">Model:</span>
                {availableModels.length > 0 ? (
                  <div className="w-full sm:w-60">
                    <Select
                      aria-label="Active Model"
                      value={localModel}
                      onChange={(e) => setLocalModel(e.target.value)}
                      className="w-full text-xs bg-white border border-clario-border rounded-md px-3 py-2 text-slate-800 font-medium shadow-xs"
                    >
                      {availableModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={localModel}
                    onChange={(e) => setLocalModel(e.target.value)}
                    placeholder="e.g. gemma3:latest, deepseek-r1:8b"
                    className="text-xs px-3 py-2 border border-clario-border rounded-md bg-white text-slate-800 w-full sm:w-60 shadow-xs"
                  />
                )}
                <button
                  type="button"
                  onClick={() => refreshModelList(llmProvider)}
                  className="text-[11px] text-clario-navy hover:underline ml-1 font-medium"
                >
                  Refresh Models
                </button>
              </div>
              <span className="text-[11px] text-slate-500">{statusMessage}</span>
            </div>
          </div>
        </details>
      </Card>

      {/* Scope Selector Card */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-clario-border">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-clario-navy" />
            <span className="text-xs font-semibold uppercase tracking-wider text-clario-navy">
              Document Scope
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="navy" size="md">
              {selectedDocIds.length ? `${selectedDocIds.length} Selected` : 'All Documents'}
            </Badge>
            {selectedDocIds.length >= 2 && (
              <Button
                variant="outline"
                size="sm"
                disabled={loading || loadingHistory}
                onClick={() => {
                  const targetUrl =
                    selectedDocIds.length === 2
                      ? `/compare?docA=${selectedDocIds[0]}&docB=${selectedDocIds[1]}`
                      : `/compare?mode=matrix&docs=${selectedDocIds.join(',')}`;
                  if (typeof window !== 'undefined') {
                    window.location.assign(targetUrl);
                  }
                }}
                className="flex items-center gap-1.5 text-xs h-7 px-2.5"
              >
                <GitCompare className="w-3.5 h-3.5 text-slate-700" />
                <span>
                  {selectedDocIds.length === 2
                    ? 'Compare Side-by-Side (2)'
                    : `Compare Matrix (${selectedDocIds.length})`}
                </span>
              </Button>
            )}
          </div>
        </div>
        <AskSources documents={documents} selection={selection} error={sourceError} disabled={loading} />
      </Card>

      {/* Preset Starters (when history is empty) */}
      {history.length === 0 && !loading && !loadingHistory && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-clario-border">
            <div className="flex items-center gap-2">
              <SearchCheck className="w-4 h-4 text-clario-navy" />
              <span className="text-xs font-semibold uppercase tracking-wider text-clario-navy">
                Suggested Inquiries & Verification Starters
              </span>
            </div>
            <span className="text-[11px] text-slate-400">Click any question to analyze</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {presets.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAsk(p)}
                className="p-3.5 rounded-md border border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-slate-100/80 transition-all text-left group flex items-start space-x-3 cursor-pointer shadow-subtle"
              >
                <SearchCheck className="w-4 h-4 text-clario-navy shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <span className="min-w-0 [overflow-wrap:anywhere] text-xs font-medium text-slate-800 group-hover:text-clario-navy transition-colors">
                  "{p}"
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Conversation Thread */}
      <div className="space-y-6">
        {history.map((item, idx) => (
          <div key={idx} className="space-y-3 animate-in fade-in">
            {/* User Inquiry: Right-aligned "You" Card */}
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1.5 mb-1.5 pr-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span>You</span>
                <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center shadow-xs border border-slate-700">
                  <User className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="relative max-w-full sm:max-w-2xl rounded-md bg-slate-900 text-white px-5 py-3.5 shadow-md shadow-slate-900/10">
                <p className="whitespace-pre-wrap break-words text-sm text-slate-100 leading-relaxed font-normal selection:bg-slate-700 selection:text-white">
                  {item.query}
                </p>
              </div>
            </div>

            {/* Clario Answer: Left-aligned "Clario" Card */}
            <div className="flex flex-col items-start w-full">
              <div className="flex items-center gap-1.5 mb-1.5 pl-1 text-[11px] font-bold text-clario-navy uppercase tracking-wider">
                <div className="w-6 h-6 rounded-full bg-clario-navy text-white flex items-center justify-center shadow-xs">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <span>Clario</span>
              </div>
              <Card className="w-full rounded-md p-6 space-y-4 border border-slate-200/90 shadow-subtle bg-white">
                {/* Answer Header Bar */}
                <div className="flex flex-wrap gap-3 items-center justify-between pb-3 border-b border-clario-border text-xs">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="font-semibold text-clario-navy">Clario Answer</span>
                    <Badge variant={item.response.mode === 'safety_restricted' ? 'red' : 'sage'} size="sm">
                      {item.response.mode}
                    </Badge>

                    {/* View Switcher: Synthesis vs Verbatim Proof Points */}
                    {item.response.citations.length > 0 && (
                      <div className="flex items-center border border-slate-200 rounded-md p-0.5 bg-slate-50 ml-1">
                        <button
                          type="button"
                          onClick={() => setAnswerViewMode((prev) => ({ ...prev, [idx]: 'synthesis' }))}
                          className={`px-2 py-0.5 rounded text-[10.5px] font-semibold transition-all ${
                            (answerViewMode[idx] || 'synthesis') === 'synthesis'
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Synthesis
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnswerViewMode((prev) => ({ ...prev, [idx]: 'verbatim' }))}
                          className={`px-2 py-0.5 rounded text-[10.5px] font-semibold transition-all flex items-center gap-1 ${
                            answerViewMode[idx] === 'verbatim'
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          <CheckCheck className="w-3 h-3 text-emerald-600" />
                          <span>Verbatim Proof</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-3 text-clario-text-secondary">
                    <span className="text-[11px] font-mono flex items-center space-x-1 text-clario-text-secondary">
                      <Clock className="w-3 h-3 text-clario-text-secondary" />
                      <span>{item.response.retrieval_latency_ms}ms</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(item.response.answer, idx)}
                      className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                      title="Copy Answer"
                    >
                      {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-clario-navy" /> : <Copy className="w-3.5 h-3.5 text-clario-text-secondary" />}
                    </button>
                  </div>
                </div>

                {/* Expandable Thinking Process / Chain-of-Thought */}
                {thinkingMode && item.response.thinking_process && (
                  <div className="border border-slate-200 rounded-md bg-slate-50 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleThinking(idx)}
                      className="w-full px-3.5 py-2 flex items-center justify-between text-left hover:bg-slate-100/60 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Brain className="w-3.5 h-3.5 text-clario-navy" />
                        <span className="text-xs font-semibold text-slate-800">
                          Reasoning Process & Verification Chain
                        </span>
                        <Badge variant="teal" size="sm">Deep Thinking</Badge>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <span>{expandedThinking[idx] ? 'Collapse' : 'Expand'}</span>
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            expandedThinking[idx] ? 'rotate-90' : ''
                          }`}
                        />
                      </div>
                    </button>
                    {expandedThinking[idx] && (
                      <div className="p-3 border-t border-slate-200 text-xs text-slate-700 font-mono whitespace-pre-wrap bg-white leading-relaxed select-text">
                        {item.response.thinking_process}
                      </div>
                    )}
                  </div>
                )}

                {/* Contradiction Alert if detected */}
                {item.response.has_conflicting_evidence && (
                  <div className="p-3.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-2.5">
                    <AlertTriangle className="w-4 h-4 text-clario-navy shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block mb-0.5">Divergent Terms Detected Across Sources</span>
                      <span className="text-[11px] text-amber-800 leading-relaxed">
                        {item.response.conflict_notes || 'Retrieved passages from differing documents state differing metrics or timelines.'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Formatted Content: Either Markdown Synthesis or Verbatim Inspector */}
                {answerViewMode[idx] === 'verbatim' ? (
                  <div className="space-y-2.5 p-3.5 rounded-md bg-slate-50 border border-slate-200 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <FileSearch className="w-3.5 h-3.5 text-slate-700" />
                        <span>Verbatim Grounded Passage Evidence</span>
                      </span>
                      <span>{item.response.citations.length} Verified Excerpts</span>
                    </div>
                    {item.response.citations.map((c) => (
                      <div key={c.citation_id} className="p-3 bg-white rounded-md border border-slate-200/90 space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-md bg-clario-navy text-white text-[10px] flex items-center justify-center font-bold">
                              {c.citation_id}
                            </span>
                            <span className="font-semibold text-slate-900">{c.document_title}</span>
                          </div>
                          <Badge variant="sage" size="sm">Page {c.page_number}</Badge>
                        </div>
                        <p className="font-mono text-slate-800 text-[11.5px] leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-100 select-text">
                          "{c.snippet}"
                        </p>
                        <div className="flex items-center justify-between pt-1 text-[10.5px] text-slate-500">
                          <span className="font-mono">{c.relevance_score > 0 ? `Confidence: ${c.relevance_score}` : 'Corpus context'}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedCitation(c)}
                            className="text-clario-navy hover:underline font-semibold flex items-center gap-1"
                          >
                            <span>Inspect Full Page</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="min-w-0 text-clario-text">
                    <Markdown>{item.response.answer}</Markdown>
                  </div>
                )}

                {/* Citations Grid */}
                {item.response.citations.length > 0 && (
                  <div className="pt-3 border-t border-clario-border">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => toggleCitations(idx)}
                        className="inline-flex items-center space-x-1.5 text-[11px] font-semibold text-slate-800 hover:text-slate-900 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                      >
                        <Bookmark className="w-3.5 h-3.5 text-slate-700" />
                        <span>
                          {expandedCitations[idx] ? 'Hide' : 'View'} source citations ({item.response.citations.length})
                        </span>
                        <ChevronRight
                          className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
                            expandedCitations[idx] ? 'rotate-90' : ''
                          }`}
                        />
                      </button>
                      {expandedCitations[idx] && (
                        <span className="text-[10px] text-slate-400">Click any citation to inspect page & passage</span>
                      )}
                    </div>

                    {expandedCitations[idx] && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-2.5">
                        {item.response.citations.map((cit) => (
                          <button
                            type="button"
                            key={cit.citation_id}
                            onClick={() => setSelectedCitation(cit)}
                            className="text-left p-3 rounded-md border border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100/70 transition-all cursor-pointer group flex flex-col justify-between"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center space-x-2 truncate">
                                <span className="w-4 h-4 rounded-md bg-clario-navy text-white text-[10px] flex items-center justify-center font-bold shrink-0">
                                  {cit.citation_id}
                                </span>
                                <span className="font-semibold text-xs text-clario-navy truncate max-w-[180px]">
                                  {cit.document_title}
                                </span>
                              </div>
                              <Badge variant="sage" size="sm">
                                Page {cit.page_number}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-clario-text-secondary line-clamp-2 italic leading-relaxed">
                              "{cit.snippet}"
                            </p>
                            <div className="mt-2 flex items-center justify-between text-[10px] text-clario-text-muted">
                              <span className="font-mono">{cit.relevance_score > 0 ? `Relevance: ${cit.relevance_score}` : 'Document overview'}</span>
                              <span className="text-clario-navy font-medium group-hover:underline flex items-center space-x-1">
                                <span>View Passage</span>
                                <ChevronRight className="w-3 h-3 text-clario-navy" />
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>
          </div>
        ))}

        {/* Realtime Streaming Turn */}
        {streaming && pendingQuery && (
          <div className="space-y-3 animate-in fade-in">
            {/* User Inquiry: Right-aligned "You" Bubble */}
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1.5 mb-1.5 pr-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span>You</span>
                <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center shadow-xs border border-slate-700">
                  <User className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="relative max-w-full sm:max-w-2xl rounded-md bg-slate-900 text-white px-5 py-3.5 shadow-md shadow-slate-900/10">
                <p className="whitespace-pre-wrap break-words text-sm text-slate-100 leading-relaxed font-normal">
                  {pendingQuery}
                </p>
              </div>
            </div>

            {/* Clario Answer: Left-aligned "Clario" Bubble */}
            <div className="flex flex-col items-start w-full">
              <div className="flex items-center gap-1.5 mb-1.5 pl-1 text-[11px] font-bold text-clario-navy uppercase tracking-wider">
                <div className="w-6 h-6 rounded-full bg-clario-navy text-white flex items-center justify-center shadow-xs">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <span>Clario</span>
              </div>
              <Card className="w-full rounded-md p-6 space-y-4 border border-slate-200/90 shadow-subtle bg-white">
                <div className="flex items-center justify-between pb-3 border-clario-border text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-clario-navy">Clario Realtime Streaming</span>
                    <Badge variant="teal" size="sm">Live Generation</Badge>
                  </div>
                </div>

                {thinkingMode && streamThinking && (
                  <div className="border border-slate-200 rounded-md bg-slate-50 p-3 text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">
                    <div className="flex items-center gap-1.5 font-sans font-semibold text-clario-navy mb-1">
                      <Brain className="w-3.5 h-3.5 text-clario-navy animate-pulse" />
                      <span>Live Reasoning Chain:</span>
                    </div>
                    {streamThinking}
                  </div>
                )}

                <div className="min-w-0 text-clario-text">
                  {streamAnswer ? (
                    <Markdown>{streamAnswer}</Markdown>
                  ) : (
                    <div className="flex items-center space-x-2 text-xs text-slate-500 italic">
                      <span className="w-3 h-3 border-2 border-slate-300 border-t-clario-navy rounded-full animate-spin" />
                      <span>Retrieving relevant passages and synthesizing evidence...</span>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Non-Streaming Pending Query */}
        {!streaming && pendingQuery && (
          <div className="space-y-3 animate-in fade-in">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1.5 mb-1.5 pr-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span>You</span>
                <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center shadow-xs border border-slate-700">
                  <User className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="relative max-w-full sm:max-w-2xl rounded-md bg-slate-900 text-white px-5 py-3.5 shadow-md shadow-slate-900/10">
                <p className="whitespace-pre-wrap break-words text-sm text-slate-100 leading-relaxed font-normal">
                  {pendingQuery}
                </p>
              </div>
            </div>

            {loading && (
              <div className="flex flex-col items-start w-full">
                <div className="flex items-center gap-1.5 mb-1.5 pl-1 text-[11px] font-bold text-clario-navy uppercase tracking-wider">
                  <div className="w-6 h-6 rounded-full bg-clario-navy text-white flex items-center justify-center shadow-xs">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span>Clario</span>
                </div>
                <div className="w-full rounded-md p-5 border border-slate-200/90 shadow-subtle bg-white flex items-center gap-3 text-sm text-slate-600">
                  <span className="w-4 h-4 border-2 border-slate-300 border-t-clario-navy rounded-full animate-spin shrink-0" />
                  <p role="status">Looking for supporting passages…</p>
                </div>
              </div>
            )}
          </div>
        )}

        {loading && !streaming && !pendingQuery && (
          <div className="flex flex-col items-start w-full animate-in fade-in">
            <div className="flex items-center gap-1.5 mb-1.5 pl-1 text-[11px] font-bold text-clario-navy uppercase tracking-wider">
              <div className="w-6 h-6 rounded-full bg-clario-navy text-white flex items-center justify-center shadow-xs">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <span>Clario</span>
            </div>
            <div className="w-full rounded-md p-5 border border-slate-200/90 shadow-subtle bg-white flex items-center gap-3 text-sm text-slate-600">
              <span className="w-4 h-4 border-2 border-slate-300 border-t-clario-navy rounded-full animate-spin shrink-0" />
              <p role="status">Looking for supporting passages…</p>
            </div>
          </div>
        )}

        <div ref={bottomRef} className="h-2" />
      </div>

      {/* Input Form Bar (Sticky at bottom with integrated Sticky Reset Chat button) */}
      <Card className="sticky bottom-3 z-10 p-3 shadow-elevated border-clario-border bg-white space-y-2">
        <div className="flex items-center justify-between px-1 text-xs text-slate-500">
          <div className="flex items-center gap-1.5 font-medium text-slate-700">
            <Bot className="w-3.5 h-3.5 text-clario-navy" />
            <span>Clario Document Intelligence</span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] text-slate-500">
              {selectedDocIds.length ? `${selectedDocIds.length} doc${selectedDocIds.length === 1 ? '' : 's'} in scope` : 'Entire workspace'}
            </span>
          </div>
          {history.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              disabled={clearing || loading}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 px-2 py-0.5 rounded-md hover:bg-rose-50 border border-slate-200 transition-colors"
              title="Reset conversation and start fresh"
            >
              <RotateCcw className={`w-3 h-3 ${clearing ? 'animate-spin' : ''}`} />
              <span>Reset Chat</span>
            </button>
          )}
        </div>
        {/* Dynamic Legal Prompt Carousel */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1 flex items-center gap-1">
            <SearchCheck className="w-3 h-3 text-slate-600" />
            <span>Starters:</span>
          </span>
          {PROMPT_CAROUSEL.map((item, cIdx) => (
            <button
              key={cIdx}
              type="button"
              onClick={() => {
                setQuery(item.query);
                questionInput.current?.focus();
              }}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 shrink-0 border border-slate-200 transition-colors shadow-2xs"
            >
              {item.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="flex items-center space-x-2"
        >
          <textarea
            ref={questionInput}
            rows={2}
            disabled={loading || loadingHistory}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
            placeholder="Ask a question about your documents…"
            aria-label="Question about your documents"
            className="min-w-0 flex-1 text-base sm:text-sm px-3.5 py-2.5 rounded-md border border-slate-200 bg-white focus:outline-none focus:border-slate-900 text-slate-900 resize-none shadow-xs"
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!query.trim() || loading || loadingHistory}
            className="h-[58px] px-5 transition-all"
          >
            {loading ? (
              <span className="flex items-center space-x-2">
                <span className="flex space-x-1 items-center" aria-hidden="true">
                  <span className="w-1.5 h-1.5 bg-white/90 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-white/90 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-white/90 rounded-full animate-bounce" />
                </span>
                <span className="text-xs font-medium">Thinking…</span>
              </span>
            ) : (
              <>
                <Send className="w-4 h-4 mr-1.5" />
                <span>Ask</span>
              </>
            )}
          </Button>
        </form>
      </Card>

      {/* Source Citation Modal */}
      {selectedCitation && (
        <DocumentViewerModal
          documentId={selectedCitation.document_id}
          highlightChunkId={selectedCitation.chunk_id}
          highlightPage={selectedCitation.page_number}
          onClose={() => setSelectedCitation(null)}
        />
      )}

      {/* Guided Audit & Compliance Wizard */}
      <GuidedAuditWizardModal
        isOpen={showAuditWizard}
        onClose={() => setShowAuditWizard(false)}
        documents={documents}
      />
    </div>
  );
};
