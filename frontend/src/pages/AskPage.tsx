import { PageHeader } from '../components/layout/PageHeader';
import { Select } from '../components/ui/Select';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send,
  SearchCheck,
  Bookmark,
  Layers,
  Clock,
  AlertTriangle,
  FileText,
  ExternalLink,
  ChevronRight,
  Info,
  Copy,
  Check,
  RotateCcw,
  Cpu,
  Brain,
  Radio
} from 'lucide-react';
import { api } from '../services/api';
import { AskResponse, CitationItem, DocumentItem } from '../types';
import { Markdown } from '../components/ui/Markdown';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DocumentViewerModal } from '../components/documents/DocumentViewerModal';

export const AskPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingMode, setStreamingMode] = useState(false);
  const [streamAnswer, setStreamAnswer] = useState('');
  const [streamThinking, setStreamThinking] = useState('');
  const [streamCitations, setStreamCitations] = useState<CitationItem[]>([]);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [history, setHistory] = useState<Array<{ query: string; response: AskResponse }>>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [selectedCitation, setSelectedCitation] = useState<CitationItem | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Local AI Gateway & Engine States
  const [llmProvider, setLlmProvider] = useState<string>('ollama');
  const [localModel, setLocalModel] = useState<string>('gemma3:latest');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [thinkingMode, setThinkingMode] = useState<boolean>(true);

  const [error, setError] = useState('');
  const [pendingQuery, setPendingQuery] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [expandedCitations, setExpandedCitations] = useState<Record<number, boolean>>({});
  const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

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
      setStatusMessage('Local server check failed');
    }
  };

  useEffect(() => {
    let cancelled = false;
    api.getSettings().then(config => {
      if (!cancelled) {
        const prov = config.llm_provider || 'ollama';
        setLlmProvider(prov);
        setLocalModel((prov === 'ollama' ? config.ollama_model : config.local_ai_model) || '');
        setThinkingMode(config.thinking_mode ?? true);
        refreshModelList(prov);
      }
    }).catch(() => {});

    api.getAnswerHistory().then(saved => { if (!cancelled) setHistory(saved); })
      .catch(() => { if (!cancelled) setError('Saved answers could not be loaded. You can still ask a new question.'); })
      .finally(() => { if (!cancelled) setLoadingHistory(false); });

    const loadDocs = async () => {
      try {
        const docs = await api.getDocuments();
        if (!cancelled) setDocuments(docs);
      } catch (err) {
        console.error(err);
      }
    };
    loadDocs();
    return () => { cancelled = true; };
  }, []);

  const handleSwitchProvider = async (provider: string) => {
    setLlmProvider(provider);
    if (provider !== 'extractive') {
      await refreshModelList(provider);
    }
    try {
      await api.updateSettings({ llm_provider: provider });
    } catch (e) {
      console.warn('Failed to persist provider setting', e);
    }
  };

  const handleAsk = async (userQuery?: string) => {
    const q = (userQuery || query).trim();
    if (!q || loading || loadingHistory) return;

    setError('');
    setPendingQuery(q);
    setLoading(true);
    setResponse(null);
    setQuery('');

    const docIds = selectedDocIds.length > 0 ? selectedDocIds : undefined;

    if (streamingMode) {
      setStreaming(true);
      setStreamAnswer('');
      setStreamThinking('');
      setStreamCitations([]);
      try {
        const result = await api.streamAsk(
          {
            query: q,
            document_ids: docIds,
            thinking_mode: thinkingMode,
            local_model: localModel || undefined,
            llm_provider: llmProvider,
          },
          {
            onToken: (token) => {
              setStreamAnswer((prev) => prev + token);
              bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            },
            onThinking: (token) => {
              setStreamThinking((prev) => prev + token);
            },
            onCitations: (cits) => {
              setStreamCitations(cits);
            },
          }
        );

        setResponse(result);
        setHistory(prev => [...prev, { query: q, response: result }]);
      } catch {
        setQuery(q);
        setError('The answer could not be generated or saved. Your question is kept below; please try again.');
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
    } catch {
      setQuery(q);
      setError('The answer could not be generated or saved. Your question is kept below; please try again.');
    } finally {
      setLoading(false);
      setPendingQuery('');
    }
  };

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError('Could not copy the answer. Select and copy the text manually.');
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

  const presets: string[] = useMemo(() => {
    const pool = documents.filter(doc => doc.status === 'READY' && (!selectedDocIds.length || selectedDocIds.includes(doc.id)));
    if (!pool.length) return [];
    const docA = pool[0]?.title || 'Document 1';
    const docB = pool[1]?.title || 'Document 2';

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
      {/* Header */}
      <PageHeader title="Ask Clario" description="Ask questions across your documents and follow each answer back to its sources.">
        <div className="flex flex-wrap items-center gap-2">
          {history.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearHistory}
              disabled={clearing || loading}
              className="text-xs text-clario-text-secondary hover:text-rose-600 hover:border-rose-300"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              {clearing ? 'Clearing…' : 'New Conversation'}
            </Button>
          )}
        </div>
      </PageHeader>

      {error && <p role="alert" className="p-3 border border-rose-200 bg-rose-50 text-rose-800 rounded-md text-sm">{error}</p>}
      {loadingHistory && <p role="status" className="text-sm text-clario-text-secondary">Loading saved answers…</p>}

      {/* Local AI Gateway & Engine Toolbar */}
      <div className="p-3.5 bg-white rounded-md border border-clario-border space-y-3 shadow-subtle">
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
              className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                llmProvider === 'ollama'
                  ? 'bg-clario-navy text-white border-clario-navy'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Ollama Local
            </button>
            <button
              type="button"
              onClick={() => handleSwitchProvider('local_openai')}
              className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                llmProvider === 'local_openai'
                  ? 'bg-clario-navy text-white border-clario-navy'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              LM Studio / vLLM
            </button>
            <button
              type="button"
              onClick={() => handleSwitchProvider('extractive')}
              className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                llmProvider === 'extractive'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Extractive Synthesis (Instant)
            </button>
          </div>

          {/* Thinking Mode & Streaming Toggles */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setThinkingMode((prev) => !prev)}
              className={`px-2.5 py-1 rounded text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                thinkingMode
                  ? 'bg-navy-50 text-navy-900 border-navy-800 ring-1 ring-navy-800'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
              title="Extract or synthesize step-by-step reasoning (DeepSeek-R1 <think> tags)"
            >
              <Brain className={`w-3.5 h-3.5 ${thinkingMode ? 'text-navy-900' : 'text-slate-400'}`} />
              <span>Thinking Mode: {thinkingMode ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => setStreamingMode((prev) => !prev)}
              className={`px-2.5 py-1 rounded text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                streamingMode
                  ? 'bg-teal-50 text-teal-900 border-teal-700 ring-1 ring-teal-700'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
              title="Stream tokens in real-time via Server-Sent Events (SSE)"
            >
              <Radio className={`w-3.5 h-3.5 ${streamingMode ? 'text-teal-700' : 'text-slate-400'}`} />
              <span>Realtime Streaming: {streamingMode ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Model Picker for Local Endpoints */}
        {llmProvider !== 'extractive' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500 font-medium">Model:</span>
              {availableModels.length > 0 ? (
                <div className="w-full sm:w-60">
                  <Select
                    aria-label="Active Model"
                    value={localModel}
                    onChange={(e) => setLocalModel(e.target.value)}
                    className="w-full text-xs bg-white border border-clario-border rounded-md px-3 py-2 focus:outline-none focus:border-clario-navy font-medium text-clario-text shadow-xs"
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
                  className="text-xs px-3 py-2 border border-clario-border rounded-md bg-white text-clario-text w-full sm:w-60 focus:outline-none focus:border-clario-navy shadow-xs"
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

            <span className="text-[11px] text-slate-500">
              {statusMessage || 'Local endpoint ready'}
            </span>
          </div>
        )}
      </div>

      {/* Scope Selector */}
      {documents.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-md border border-slate-200 text-xs shadow-xs">
          <span className="text-slate-700 font-semibold flex items-center gap-1.5 mr-1 shrink-0">
            Search Scope:
          </span>
          <button
            aria-pressed={selectedDocIds.length === 0}
            onClick={() => setSelectedDocIds([])}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0 ${
              selectedDocIds.length === 0
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            Entire Workspace ({documents.length} Docs)
          </button>
          {documents.map((d) => {
            const isSelected = selectedDocIds.includes(d.id);
            return (
              <button
                key={d.id}
                aria-pressed={isSelected}
                onClick={() => {
                  if (isSelected) {
                    setSelectedDocIds(selectedDocIds.filter((id) => id !== d.id));
                  } else {
                    setSelectedDocIds([...selectedDocIds, d.id]);
                  }
                }}
                className={`px-3 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1.5 max-w-[260px] min-w-0 shrink-0 border ${
                  isSelected
                    ? 'bg-slate-900 text-white font-medium border-slate-900 shadow-xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                }`}
                title={d.title}
              >
                <span className="truncate min-w-0 block flex-1 text-left">{d.title}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Preset Starters */}
      {history.length === 0 && !loading && !loadingHistory && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {presets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleAsk(p)}
              className="p-3.5 rounded-md border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 transition-all text-left group flex items-start space-x-3 shadow-subtle"
            >
              <SearchCheck className="w-4 h-4 text-clario-navy shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
              <span className="min-w-0 [overflow-wrap:anywhere] text-xs font-medium text-clario-text group-hover:text-clario-navy transition-colors">
                "{p}"
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Conversation Thread */}
      <div className="space-y-6">
        {history.map((item, idx) => (
          <div key={idx} className="space-y-4 animate-in fade-in">
            {/* User Question */}
            <div className="flex justify-end">
              <p className="whitespace-pre-wrap break-words bg-clario-navy text-white px-4 py-2.5 rounded-md text-xs font-medium max-w-xl shadow-xs">
                {item.query}
              </p>
            </div>

            {/* Clario Answer */}
            <div className="bg-white rounded-md border border-clario-border p-6 shadow-subtle space-y-4">
              {/* Answer Header Bar */}
              <div className="flex flex-wrap gap-3 items-center justify-between pb-3 border-b border-clario-border text-xs">
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="w-6 h-6 rounded-md bg-clario-navy text-white flex items-center justify-center font-bold text-[10px]">
                    CL
                  </div>
                  <span className="font-semibold text-clario-navy">Clario Synthesized Answer</span>
                  <Badge variant="sage" size="sm">{item.response.mode}</Badge>
                </div>
                <div className="flex items-center space-x-3 text-clario-text-secondary">
                  <span className="text-[11px] font-mono flex items-center space-x-1 text-clario-text-secondary">
                    <Clock className="w-3 h-3 text-clario-text-secondary" />
                    <span>{item.response.retrieval_latency_ms}ms</span>
                  </span>
                  <button
                    onClick={() => handleCopy(item.response.answer, idx)}
                    className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                    title="Copy Answer"
                  >
                    {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-clario-navy" /> : <Copy className="w-3.5 h-3.5 text-clario-text-secondary" />}
                  </button>
                </div>
              </div>

              {/* Expandable Thinking Process / Chain-of-Thought */}
              {item.response.thinking_process && (
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

              {/* Formatted Markdown Content */}
              <div className="min-w-0 text-clario-text">
                <Markdown>{item.response.answer}</Markdown>
              </div>

              {/* Citations Grid (Collapsible, Hidden by default) */}
              {item.response.citations.length > 0 && (
                <div className="pt-3 border-t border-clario-border">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => toggleCitations(idx)}
                      className="inline-flex items-center space-x-1.5 text-[11px] font-semibold text-slate-800 hover:text-slate-900 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
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
                              <span className="w-4 h-4 rounded bg-clario-navy text-white text-[10px] flex items-center justify-center font-bold shrink-0">
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
                            <span className="font-mono">Relevance: {cit.relevance_score}</span>
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
            </div>
          </div>
        ))}

        {/* Realtime Streaming Turn */}
        {streaming && pendingQuery && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex justify-end">
              <p className="whitespace-pre-wrap break-words bg-clario-navy text-white px-4 py-2.5 rounded-md text-xs font-medium max-w-xl">
                {pendingQuery}
              </p>
            </div>

            <div className="bg-white rounded-md border border-clario-border p-6 shadow-subtle space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-clario-border text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-clario-navy text-white flex items-center justify-center font-bold text-[10px]">
                    CL
                  </div>
                  <span className="font-semibold text-clario-navy">Clario Realtime Streaming</span>
                  <Badge variant="teal" size="sm">Live Generation</Badge>
                </div>
              </div>

              {/* Streaming Thinking Process */}
              {streamThinking && (
                <div className="border border-slate-200 rounded-md bg-slate-50 p-3 text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">
                  <div className="flex items-center gap-1.5 font-sans font-semibold text-clario-navy mb-1">
                    <Brain className="w-3.5 h-3.5 text-clario-navy animate-pulse" />
                    <span>Live Reasoning Chain:</span>
                  </div>
                  {streamThinking}
                </div>
              )}

              {/* Streaming Markdown Answer */}
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
            </div>
          </div>
        )}

        {/* Pending Query (Non-Streaming) */}
        {!streaming && pendingQuery && (
          <div className="flex justify-end">
            <p className="max-w-xl whitespace-pre-wrap break-words bg-clario-navy text-white p-4 rounded-md text-sm">
              {pendingQuery}
            </p>
          </div>
        )}

        {loading && !streaming && (
          <p role="status" className="rounded-md border bg-white p-4 text-sm text-slate-600">Looking for supporting passages…</p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input Form Bar */}
      <Card className="sticky bottom-4 z-10 p-3 shadow-elevated border-slate-200 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="flex items-center space-x-2"
        >
          <textarea
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
            placeholder="Ask anything about policies, contracts, findings, or research... (Press Enter to send, Shift+Enter for newline)"
            aria-label="Question about your documents"
            className="min-w-0 flex-1 text-xs px-3.5 py-2.5 rounded-md border border-slate-200 bg-white focus:outline-none focus:border-slate-900 text-slate-900 resize-none"
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!query.trim() || loading || loadingHistory}
            loading={loading}
          >
            <Send className="w-4 h-4 mr-1.5" />
            Ask
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
    </div>
  );
};
