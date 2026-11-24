import { useOutletContext } from 'react-router-dom';
import { AskSources, useAskDocuments, useAskSelection } from '../components/documents/AskSources';
import { PageHeader } from '../components/layout/PageHeader';
import { Select } from '../components/ui/Select';
import { useBackgroundTasks } from '../context/BackgroundTaskContext';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send,
  SearchCheck,
  Bookmark,
  Clock,
  AlertTriangle,
  FileText,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
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
  GitCompare,
  Sparkles
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
  const { startTask, activeTasks, getLatestTask } = useBackgroundTasks();
  const activeAskTask = activeTasks.find((t) => t.category === 'ask');
  const lastProcessedTaskIdRef = useRef<string | null>(null);

  const handoff = useOutletContext<{ selection: ReturnType<typeof useAskSelection>; askDraft: string | null; setAskDraft: (value: string | null) => void } | null>();
  const [query, setQuery] = useState(handoff?.askDraft ?? '');
  const fromQuickAsk = useRef(handoff?.askDraft != null);
  const questionInput = useRef<HTMLTextAreaElement>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingMode, setStreamingMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('clario_ask_stream') === 'true';
    } catch {
      return false;
    }
  });
  const [streamAnswer, setStreamAnswer] = useState('');
  const [streamThinking, setStreamThinking] = useState('');
  const [streamCitations, setStreamCitations] = useState<CitationItem[]>([]);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [history, setHistory] = useState<Array<{ query: string; response: AskResponse }>>([]);
  const standaloneSelection = useAskSelection();
  const selection = handoff?.selection ?? standaloneSelection;
  const { documents, error: sourceError } = useAskDocuments(true, selection);
  const selectedDocIds = selection.ids;
  const [selectedCitation, setSelectedCitation] = useState<CitationItem | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showAuditWizard, setShowAuditWizard] = useState(false);
  const [answerViewMode, setAnswerViewMode] = useState<Record<number, 'synthesis' | 'verbatim'>>({});

  // Local AI Gateway & Engine States
  const [llmProvider, setLlmProvider] = useState<string>('ollama');
  const [localModel, setLocalModel] = useState<string>(() => {
    try {
      const cached = localStorage.getItem('clario_ai_status');
      if (cached) return JSON.parse(cached).active_model || '';
    } catch {}
    return '';
  });
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>(() => {
    try {
      const cached = localStorage.getItem('clario_ai_status');
      if (cached) return JSON.parse(cached).message || 'Connected';
    } catch {}
    return 'Connected';
  });
  const [savingThinking, setSavingThinking] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [thinkingMode, setThinkingMode] = useState<boolean>(false);
  const [answerLength, setAnswerLength] = useState<'concise' | 'standard' | 'comprehensive'>('standard');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showScopePicker, setShowScopePicker] = useState(false);
  const [showScopeModal, setShowScopeModal] = useState(false);
  const [scopeSearch, setScopeSearch] = useState('');
  const [researchMode, setResearchMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('clario_ask_research_mode') === 'true';
    } catch {
      return false;
    }
  });

  const toggleResearchMode = () => {
    setResearchMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('clario_ask_research_mode', String(next));
      } catch {}
      return next;
    });
  };

  const filteredScopeDocuments = useMemo(() => {
    if (!scopeSearch.trim()) return documents;
    const lower = scopeSearch.toLowerCase();
    return documents.filter((doc) =>
      doc.title.toLowerCase().includes(lower) ||
      (doc.filename && doc.filename.toLowerCase().includes(lower))
    );
  }, [documents, scopeSearch]);

  const [error, setError] = useState('');
  const [pendingQuery, setPendingQuery] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [expandedCitations, setExpandedCitations] = useState<Record<number, boolean>>({});
  const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [pendingQuery, response, history.length, streamAnswer]);

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
      let activeModel = localModel;
      if (status.models && status.models.length > 0) {
        if (!status.models.includes(localModel)) {
          activeModel = status.active_model && status.models.includes(status.active_model) ? status.active_model : status.models[0];
          setLocalModel(activeModel);
        }
      } else if (status.active_model) {
        activeModel = status.active_model;
        setLocalModel(activeModel);
      }
      setStatusMessage(status.message);
      try {
        localStorage.setItem('clario_ai_status', JSON.stringify({
          provider,
          message: status.message,
          active_model: activeModel,
          models: status.models
        }));
      } catch {}
    } catch {
      setStatusMessage('Local server unreachable');
    }
  };

  useEffect(() => {
    api.getSettings().then((s) => {
      if (s.thinking_mode !== undefined) {
        setThinkingMode(s.thinking_mode);
      }
      if (s.answer_length) {
        setAnswerLength(s.answer_length);
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
      setHistory(rows.map((row) => {
        let ans = row.response.answer;
        if (ans && (ans.includes('Thinking Process:') || ans.includes('Role: Clario'))) {
          const parts = ans.split(/Direct Cited Answer:|Direct Answer:|\n\nAnswer:|\nAnswer:/);
          if (parts.length > 1) {
            ans = parts[parts.length - 1].trim();
          }
        }
        return { query: row.query, response: { ...row.response, answer: ans } };
      }));
    }).catch(() => {
      // Non-fatal
    }).finally(() => {
      setLoadingHistory(false);
    });
  }, []);

  // Synchronize with background task execution for Ask Clario across page navigations
  useEffect(() => {
    if (activeAskTask) {
      setLoading(true);
      setPendingQuery(activeAskTask.title);
    } else {
      const latest = getLatestTask('ask');
      if (latest && latest.status === 'completed' && latest.result && latest.id !== lastProcessedTaskIdRef.current) {
        lastProcessedTaskIdRef.current = latest.id;
        const answerRes = latest.result as AskResponse;
        setResponse(answerRes);
        setHistory((prev) => {
          if (prev.some((h) => h.query === latest.title && h.response.answer === answerRes.answer)) {
            return prev;
          }
          return [...prev, { query: latest.title, response: answerRes }];
        });
        setLoading(false);
        setPendingQuery('');
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [activeAskTask, getLatestTask]);

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

  const handleSetAnswerLength = async (length: 'concise' | 'standard' | 'comprehensive') => {
    setAnswerLength(length);
    try {
      await api.updateSettings({ answer_length: length });
    } catch (err) {
      console.error('Failed to update answer length setting', err);
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
    const targetScope = docIds && docIds.length > 0 ? `${docIds.length} Document${docIds.length > 1 ? 's' : ''}` : 'All Workspace Documents';
    const topK = researchMode ? 10 : undefined;

    // Check localStorage QA cache first
    const cacheKey = `${q.toLowerCase()}__${(docIds || []).sort().join(',')}`;
    try {
      const stored = localStorage.getItem('clario_ask_cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed[cacheKey]) {
          const cachedRes = parsed[cacheKey];
          if (cachedRes?.answer && !cachedRes.answer.includes('Thinking Process:') && !cachedRes.answer.includes('Role: Clario')) {
            setResponse(cachedRes);
            setHistory((prev) => {
              if (prev.some((h) => h.query === q && h.response.answer === cachedRes.answer)) return prev;
              return [...prev, { query: q, response: cachedRes }];
            });
            setLoading(false);
            setPendingQuery('');
            setTimeout(() => {
              bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
            return;
          }
        }
      }
    } catch {
      // ignore
    }

    // Streaming SSE Path
    if (streamingMode) {
      setStreaming(true);
      setStreamAnswer('');
      setStreamThinking('');
      setStreamCitations([]);

      try {
        const doneResponse = await startTask<AskResponse>({
          title: q,
          category: 'ask',
          targetScope,
          route: '/ask',
          initialStage: researchMode ? 'Deep multi-document research analysis...' : 'Searching indexed passages...',
          executor: async (updateProgress) => {
            updateProgress(15, researchMode ? 'Deep multi-document research analysis...' : 'Searching indexed passages...', `Searching for: "${q.slice(0, 45)}..."`);

            const result = await api.streamAsk(
              {
                query: q,
                document_ids: docIds,
                top_k: topK,
                thinking_mode: thinkingMode,
                local_model: localModel || undefined,
                llm_provider: llmProvider
              },
              {
                onToken: (token: string) => {
                  setStreamAnswer((prev) => prev + token);
                  updateProgress(65, 'Streaming cited answer...', 'Generating answer text');
                },
                onThinking: (thinking: string) => {
                  setStreamThinking(thinking);
                  updateProgress(35, 'Local AI reasoning chain...', 'Analyzing retrieved passages');
                },
                onCitations: (cits: CitationItem[]) => {
                  setStreamCitations(cits);
                  updateProgress(50, `Found ${cits.length} verified citation${cits.length > 1 ? 's' : ''}...`);
                }
              }
            );

            updateProgress(100, 'Answer generated with verified citations', 'Completed');
            return result;
          }
        });

        // Cache in localStorage
        try {
          const stored = localStorage.getItem('clario_ask_cache');
          const parsed = stored ? JSON.parse(stored) : {};
          parsed[cacheKey] = doneResponse;
          const keys = Object.keys(parsed);
          if (keys.length > 30) delete parsed[keys[0]];
          localStorage.setItem('clario_ask_cache', JSON.stringify(parsed));
        } catch {}

        setResponse(doneResponse);
        setHistory((prev) => {
          if (prev.some((h) => h.query === q && h.response.answer === doneResponse.answer)) return prev;
          return [...prev, { query: q, response: doneResponse }];
        });
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
      const res = await startTask<AskResponse>({
        title: q,
        category: 'ask',
        targetScope,
        route: '/ask',
        initialStage: researchMode ? 'Deep multi-document research analysis...' : 'Searching indexed passages...',
        executor: async (updateProgress) => {
          updateProgress(15, researchMode ? 'Deep multi-document research analysis...' : 'Searching indexed passages...', `Searching for: "${q.slice(0, 45)}..."`);

          let currentPct = 15;
          const progressInterval = setInterval(() => {
            if (currentPct < 85) {
              currentPct += 7;
              updateProgress(
                currentPct,
                currentPct < 50
                  ? (researchMode ? 'Conducting multi-source cross-examination...' : 'Searching indexed passages and citations...')
                  : 'Synthesizing verified cited answer...',
                'Auditing context and citations'
              );
            }
          }, 350);

          let answerRes: AskResponse;
          try {
            answerRes = await api.ask(q, docIds, topK, thinkingMode, localModel || undefined, llmProvider);
          } finally {
            clearInterval(progressInterval);
          }

          updateProgress(100, 'Answer generated with verified citations', 'Completed');
          return answerRes;
        }
      });

      // Cache in localStorage
      try {
        const stored = localStorage.getItem('clario_ask_cache');
        const parsed = stored ? JSON.parse(stored) : {};
        parsed[cacheKey] = res;
        const keys = Object.keys(parsed);
        if (keys.length > 30) delete parsed[keys[0]];
        localStorage.setItem('clario_ask_cache', JSON.stringify(parsed));
      } catch {}

      setResponse(res);
      setHistory((prev) => {
        if (prev.some((h) => h.query === q && h.response.answer === res.answer)) return prev;
        return [...prev, { query: q, response: res }];
      });
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
    <div className="flex flex-col min-h-[calc(100vh-8rem)] max-w-5xl mx-auto space-y-4">
      {/* Page Header */}
      <PageHeader
        title="Ask Clario"
        description="Ask questions across your documents and follow each answer back to its sources."
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Document Scope Modal Button (Top) */}
          <button
            type="button"
            onClick={() => setShowScopeModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs cursor-pointer"
            title="Filter specific documents or search entire workspace"
          >
            <Layers className="w-3.5 h-3.5 text-clario-navy" />
            <span>
              {selectedDocIds.length > 0 ? `${selectedDocIds.length} doc${selectedDocIds.length > 1 ? 's' : ''} selected` : 'Entire workspace'}
            </span>
          </button>

          {/* Answer Settings Trigger Button */}
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors cursor-pointer"
            title="Configure AI model, thinking mode, and streaming"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-clario-navy" />
            <span>Answer settings</span>
          </button>

          {/* Reset Chat Button */}
          {history.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearHistory}
              disabled={clearing || loading}
              className="text-xs text-slate-700 hover:text-rose-600 hover:border-rose-300 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${clearing ? 'animate-spin' : ''}`} />
              <span>{clearing ? 'Clearing…' : 'Reset Chat'}</span>
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Document Scope Selector Card */}
      <Card className="p-3.5 space-y-2 border-clario-border bg-white rounded-xl shadow-subtle">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-clario-navy" />
            <span className="text-xs font-semibold uppercase tracking-wider text-clario-navy">
              Document Scope
            </span>
            <span className="text-xs text-slate-500 font-medium">
              • {selectedDocIds.length === 1 ? '1 document selected' : `${selectedDocIds.length} documents selected`}
            </span>
          </div>
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
              className="flex items-center gap-1.5 text-xs h-7 px-2.5 font-medium"
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
        <AskSources documents={documents} selection={selection} error={sourceError} disabled={loading} />
      </Card>

      {error && (
        <div role="alert" className="p-3.5 border border-rose-200 bg-rose-50 text-rose-800 rounded-md text-sm">
          {error}
        </div>
      )}
      {loadingHistory && <p role="status" className="text-sm text-slate-500">Loading saved answers…</p>}

      {/* Preset Starters & Welcome Hero (when history is empty) */}
      {history.length === 0 && !loading && !loadingHistory && (
        <div className="py-8 flex flex-col items-center text-center space-y-6 max-w-2xl mx-auto my-auto animate-in fade-in">
          <div className="w-12 h-12 rounded-2xl bg-clario-navy text-white flex items-center justify-center shadow-md shadow-clario-navy/15">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-semibold text-slate-900 tracking-tight">
              Every document. A clearer answer.
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Ask questions about liabilities, breach notification SLAs, or compare terms across documents with source citations.
            </p>
          </div>

          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left pt-2">
            {presets.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAsk(p)}
                className="p-3 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/80 transition-all text-left group flex items-start space-x-2.5 shadow-2xs cursor-pointer"
              >
                <SearchCheck className="w-4 h-4 text-clario-navy shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-slate-700 group-hover:text-clario-navy leading-relaxed line-clamp-2">
                  {p}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversation Thread: Modern Chat Flow */}
      <div className="space-y-5 flex-1">
        {history.map((item, idx) => (
          <div key={idx} className="space-y-3 animate-in fade-in duration-150">
            {/* User message: clean, right-aligned, sleek rounded pill */}
            <div className="flex justify-end pl-8 sm:pl-16">
              <div className="rounded-2xl bg-slate-900 text-white px-4 py-2.5 shadow-xs max-w-[85%] sm:max-w-[70%]">
                <p className="whitespace-pre-wrap break-words text-sm text-slate-100 leading-relaxed font-normal selection:bg-slate-700 selection:text-white">
                  {item.query}
                </p>
              </div>
            </div>

            {/* Clario message: clean left-aligned modern response */}
            <div className="flex gap-3.5 items-start pr-2 sm:pr-8">
              <div className="w-7 h-7 rounded-full bg-clario-navy text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <Bot className="w-4 h-4 text-white" />
              </div>

              <div className="flex-1 min-w-0 space-y-2.5">
                {/* Meta row */}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-xs">Clario</span>
                    {item.response.retrieval_latency_ms > 0 && (
                      <span className="text-[11px] font-mono text-slate-400">
                        {item.response.retrieval_latency_ms}ms
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {item.response.citations.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setAnswerViewMode((prev) => ({ ...prev, [idx]: prev[idx] === 'verbatim' ? 'synthesis' : 'verbatim' }))}
                        className="px-2 py-0.5 rounded text-[10.5px] font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
                        title="Toggle verbatim passage evidence"
                      >
                        {answerViewMode[idx] === 'verbatim' ? 'Synthesis View' : 'Verbatim Proof'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopy(item.response.answer, idx)}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="Copy Answer"
                    >
                      {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                  </div>
                </div>

                {/* Thinking process if present */}
                {thinkingMode && item.response.thinking_process && (
                  <div className="border border-slate-200 rounded-lg bg-slate-50/80 overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => toggleThinking(idx)}
                      className="w-full px-3 py-1.5 flex items-center justify-between text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <span className="flex items-center gap-1.5 font-medium">
                        <Brain className="w-3.5 h-3.5 text-clario-navy" />
                        <span>Reasoning Process</span>
                      </span>
                      <span className="text-[10px] text-slate-400">{expandedThinking[idx] ? 'Hide' : 'Show'}</span>
                    </button>
                    {expandedThinking[idx] && (
                      <div className="p-3 border-t border-slate-200 text-xs font-mono text-slate-700 bg-white whitespace-pre-wrap leading-relaxed select-text">
                        {item.response.thinking_process}
                      </div>
                    )}
                  </div>
                )}

                {/* Contradiction Alert if detected */}
                {item.response.has_conflicting_evidence && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block mb-0.5">Divergent Terms Detected Across Sources</span>
                      <span className="text-[11px] text-amber-800 leading-relaxed">
                        {item.response.conflict_notes || 'Retrieved passages from differing documents state differing metrics or timelines.'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Verbatim vs Synthesis Content */}
                {answerViewMode[idx] === 'verbatim' ? (
                  <div className="space-y-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <span>Verbatim Grounded Passage Evidence ({item.response.citations.length})</span>
                    </div>
                    {item.response.citations.map((c) => (
                      <div key={c.citation_id} className="p-2.5 bg-white rounded-md border border-slate-200/90 space-y-1 shadow-2xs">
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded bg-clario-navy text-white text-[10px] flex items-center justify-center font-bold">
                              {c.citation_id}
                            </span>
                            <span className="font-semibold text-slate-900">{c.document_title}</span>
                          </div>
                          <Badge variant="sage" size="sm">Page {c.page_number}</Badge>
                        </div>
                        <p className="font-mono text-slate-800 text-[11.5px] leading-relaxed bg-slate-50 p-2 rounded border border-slate-100 select-text">
                          "{c.snippet}"
                        </p>
                        <div className="flex items-center justify-between pt-0.5 text-[10.5px] text-slate-500">
                          <span>{c.relevance_score > 0 ? `Confidence: ${c.relevance_score}` : 'Corpus context'}</span>
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
                  <div className="text-slate-800 text-sm leading-relaxed prose prose-sm max-w-none">
                    <Markdown>{item.response.answer}</Markdown>
                  </div>
                )}

                {/* Compact Source Citation Badges */}
                {item.response.citations.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                      Sources:
                    </span>
                    {item.response.citations.map((c) => (
                      <button
                        key={c.citation_id}
                        type="button"
                        onClick={() => setSelectedCitation(c)}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200/80 transition-colors cursor-pointer"
                        title={`View ${c.document_title} (Page ${c.page_number})`}
                      >
                        <span className="w-3.5 h-3.5 rounded-full bg-clario-navy text-white text-[9px] flex items-center justify-center font-bold shrink-0">
                          {c.citation_id}
                        </span>
                        <span className="truncate max-w-[160px]">{c.document_title}</span>
                        <span className="text-slate-400 font-mono text-[10px]">p.{c.page_number}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Realtime Streaming Turn */}
        {streaming && pendingQuery && (
          <div className="space-y-3 animate-in fade-in duration-150">
            <div className="flex justify-end pl-8 sm:pl-16">
              <div className="rounded-2xl bg-slate-900 text-white px-4 py-2.5 shadow-xs max-w-[85%] sm:max-w-[70%]">
                <p className="whitespace-pre-wrap break-words text-sm text-slate-100 leading-relaxed font-normal">
                  {pendingQuery}
                </p>
              </div>
            </div>

            <div className="flex gap-3.5 items-start pr-2 sm:pr-8">
              <div className="w-7 h-7 rounded-full bg-clario-navy text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-900">Clario</span>
                </div>

                {thinkingMode && streamThinking && (
                  <div className="border border-slate-200 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">
                    <div className="flex items-center gap-1.5 font-sans font-semibold text-clario-navy mb-1">
                      <Brain className="w-3.5 h-3.5 text-clario-navy animate-pulse" />
                      <span>Live Reasoning Chain:</span>
                    </div>
                    {streamThinking}
                  </div>
                )}

                <div className="text-slate-800 text-sm leading-relaxed prose prose-sm max-w-none">
                  {streamAnswer ? (
                    <Markdown>{streamAnswer}</Markdown>
                  ) : (
                    <div className="flex items-center space-x-2 text-xs text-slate-500 italic py-1">
                      <span className="w-3 h-3 border-2 border-slate-300 border-t-clario-navy rounded-full animate-spin" />
                      <span>Retrieving relevant passages and synthesizing evidence...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Non-Streaming Pending Query */}
        {!streaming && pendingQuery && (
          <div className="space-y-3 animate-in fade-in duration-150">
            <div className="flex justify-end pl-8 sm:pl-16">
              <div className="rounded-2xl bg-slate-900 text-white px-4 py-2.5 shadow-xs max-w-[85%] sm:max-w-[70%]">
                <p className="whitespace-pre-wrap break-words text-sm text-slate-100 leading-relaxed font-normal">
                  {pendingQuery}
                </p>
              </div>
            </div>

            {loading && (
              <div className="flex gap-3.5 items-start pr-2 sm:pr-8">
                <div className="w-7 h-7 rounded-full bg-clario-navy text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-900">Clario</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500">Generating</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 py-1">
                    <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-clario-navy rounded-full animate-spin shrink-0" />
                    <p role="status">{activeAskTask?.stage || 'Looking for supporting passages…'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {loading && !streaming && !pendingQuery && (
          <div className="flex gap-3.5 items-start pr-2 sm:pr-8 animate-in fade-in">
            <div className="w-7 h-7 rounded-full bg-clario-navy text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <span className="font-semibold text-slate-900 text-xs">Clario</span>
              <div className="flex items-center gap-2 text-xs text-slate-600 py-1">
                <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-clario-navy rounded-full animate-spin shrink-0" />
                <p role="status">{activeAskTask?.stage || 'Looking for supporting passages…'}</p>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Sticky Bottom Input Bar */}
      <div className="sticky bottom-3 z-10 space-y-2">
        {/* Dynamic Legal Starters Carousel */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs px-1 scrollbar-none">
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
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 shrink-0 border border-slate-200/90 transition-colors shadow-2xs cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Input Card Container */}
        <Card className="p-2.5 shadow-elevated border-clario-border bg-white rounded-2xl space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk();
            }}
            className="flex flex-col space-y-2"
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
              placeholder="Ask a question about your documents… (Press Enter to send)"
              aria-label="Question about your documents"
              className="min-w-0 w-full text-sm px-3 py-2 rounded-xl border-none focus:outline-none text-slate-900 placeholder:text-slate-400 resize-none bg-transparent"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs px-1">
              <div className="flex flex-wrap items-center gap-2">
                {/* Document Scope Modal Button (Bottom) */}
                <button
                  type="button"
                  onClick={() => setShowScopeModal(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors cursor-pointer"
                  title="Choose documents in scope or search entire workspace"
                >
                  <Layers className="w-3.5 h-3.5 text-clario-navy" />
                  <span>{selectedDocIds.length > 0 ? `${selectedDocIds.length} doc${selectedDocIds.length > 1 ? 's' : ''} in scope` : 'Entire workspace'}</span>
                </button>

                {/* Answer & AI Settings Trigger Button */}
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                  title="Tune inference and models"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
                  <span>{localModel || 'Settings'}</span>
                </button>

                {/* Reset Chat Button at Bottom */}
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    disabled={clearing || loading}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer"
                    title="Clear conversation history"
                  >
                    <RotateCcw className={`w-3 h-3 ${clearing ? 'animate-spin' : ''}`} />
                    <span>Reset Chat</span>
                  </button>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!query.trim() || loading || loadingHistory}
                className="h-8 px-4 rounded-xl transition-all ml-auto"
              >
                {loading ? (
                  <span className="flex items-center space-x-1.5">
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="text-xs">Thinking…</span>
                  </span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1" />
                    <span>Ask</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* Answer & AI Settings Modal */}
      {showSettingsModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-clario-navy" />
                <h3 className="text-sm font-semibold text-slate-900">AI Engine & Generation Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Provider Selector */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 block">AI Provider Engine</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSwitchProvider('ollama')}
                    className={`p-2.5 rounded-lg border text-left font-medium transition-all ${
                      llmProvider === 'ollama'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-semibold text-xs">Ollama Local</div>
                    <div className={`text-[10.5px] mt-0.5 ${llmProvider === 'ollama' ? 'text-slate-300' : 'text-slate-400'}`}>Native Apple Silicon / CPU</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchProvider('openai_compatible')}
                    className={`p-2.5 rounded-lg border text-left font-medium transition-all ${
                      llmProvider === 'openai_compatible'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-semibold text-xs">LM Studio / vLLM</div>
                    <div className={`text-[10.5px] mt-0.5 ${llmProvider === 'openai_compatible' ? 'text-slate-300' : 'text-slate-400'}`}>Local OpenAI Compatible</div>
                  </button>
                </div>
              </div>

              {/* Model Picker */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700">Active Model</label>
                  <button
                    type="button"
                    onClick={() => refreshModelList(llmProvider)}
                    className="text-[11px] text-clario-navy hover:underline font-medium"
                  >
                    Refresh Models
                  </button>
                </div>
                {availableModels.length > 0 ? (
                  <Select
                    aria-label="Active Model"
                    value={localModel}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLocalModel(val);
                      try {
                        const cached = localStorage.getItem('clario_ai_status');
                        const parsed = cached ? JSON.parse(cached) : {};
                        parsed.active_model = val;
                        localStorage.setItem('clario_ai_status', JSON.stringify(parsed));
                        api.updateSettings({ local_ai_model: val });
                      } catch {}
                    }}
                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-medium shadow-2xs"
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <input
                    type="text"
                    value={localModel}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLocalModel(val);
                      try {
                        const cached = localStorage.getItem('clario_ai_status');
                        const parsed = cached ? JSON.parse(cached) : {};
                        parsed.active_model = val;
                        localStorage.setItem('clario_ai_status', JSON.stringify(parsed));
                        api.updateSettings({ local_ai_model: val });
                      } catch {}
                    }}
                    placeholder="e.g. qwen3.5:4b, llama3.2"
                    className="text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-800 w-full shadow-2xs"
                  />
                )}
                <p className="text-[11px] text-slate-500">{statusMessage || 'Connected to local model host'}</p>
              </div>

              {/* Toggles: Thinking Mode and Streaming */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="font-semibold text-slate-700 block">Inference Controls</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={toggleThinkingMode}
                    disabled={!settingsLoaded || savingThinking || loading}
                    aria-pressed={thinkingMode}
                    className={`flex-1 p-2.5 rounded-lg border text-left font-medium transition-all flex items-center justify-between ${
                      thinkingMode
                        ? 'bg-navy-50 text-navy-900 border-navy-800 ring-1 ring-navy-800'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Brain className={`w-4 h-4 ${thinkingMode ? 'text-navy-900' : 'text-slate-400'}`} />
                      <span>Thinking Mode: {settingsLoaded ? (thinkingMode ? 'ON' : 'OFF') : '…'}</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !streamingMode;
                      setStreamingMode(next);
                      try { localStorage.setItem('clario_ask_stream', String(next)); } catch {}
                    }}
                    className={`flex-1 p-2.5 rounded-lg border text-left font-medium transition-all flex items-center justify-between ${
                      streamingMode
                        ? 'bg-teal-50 text-teal-900 border-teal-700 ring-1 ring-teal-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Radio className={`w-4 h-4 ${streamingMode ? 'text-teal-700' : 'text-slate-400'}`} />
                      <span>Stream answers: {streamingMode ? 'ON' : 'OFF'}</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Response Length */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <label className="font-semibold text-slate-700 block">Response Synthesis Detail</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['concise', 'standard', 'comprehensive'] as const).map((len) => (
                    <button
                      key={len}
                      type="button"
                      onClick={() => handleSetAnswerLength(len)}
                      className={`py-2 px-1 text-center rounded-lg border text-xs capitalize transition-all ${
                        answerLength === len
                          ? 'bg-slate-900 text-white border-slate-900 font-semibold shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {len === 'concise' ? 'Concise (Fast)' : len === 'standard' ? 'Standard' : 'Comprehensive'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowSettingsModal(false)}
                className="px-4"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Source Citation Modal */}
      {selectedCitation && (
        <DocumentViewerModal
          documentId={selectedCitation.document_id}
          highlightChunkId={selectedCitation.chunk_id}
          highlightPage={selectedCitation.page_number}
          onClose={() => setSelectedCitation(null)}
        />
      )}

      {/* Document Scope Modal (Center Screen) */}
      {showScopeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="scope-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-clario-navy" />
                <h3 id="scope-modal-title" className="text-sm font-semibold text-slate-900">
                  Select Document Scope
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowScopeModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search and Scope Filter */}
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 space-y-2.5">
              <input
                type="text"
                value={scopeSearch}
                onChange={(e) => setScopeSearch(e.target.value)}
                placeholder="Filter documents by title..."
                className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 text-slate-800 focus:outline-none focus:ring-1 focus:ring-clario-navy"
              />
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => selection.select([])}
                  className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors cursor-pointer ${
                    selectedDocIds.length === 0
                      ? 'bg-clario-navy text-white shadow-2xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Entire Workspace ({documents.length} files)
                </button>
                <span className="text-slate-500 font-medium">
                  {selectedDocIds.length > 0
                    ? `${selectedDocIds.length} of ${documents.length} selected`
                    : 'Searching all documents'}
                </span>
              </div>
            </div>

            {/* Document List with Checkboxes */}
            <div className="p-3.5 overflow-y-auto space-y-1 flex-1 divide-y divide-slate-100">
              {filteredScopeDocuments.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No documents found matching "{scopeSearch}".</p>
              ) : (
                filteredScopeDocuments.map((doc) => {
                  const isChecked = selectedDocIds.includes(doc.id);
                  return (
                    <label
                      key={doc.id}
                      className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                        isChecked ? 'bg-slate-50 font-medium' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            selection.select(selectedDocIds.filter((id) => id !== doc.id));
                          } else {
                            selection.select([...selectedDocIds, doc.id]);
                          }
                        }}
                        className="mt-0.5 rounded border-slate-300 text-clario-navy focus:ring-clario-navy w-4 h-4 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-900 truncate font-medium">
                            {doc.title || doc.filename}
                          </span>
                          <span className="text-[10.5px] text-slate-400 shrink-0 ml-2">
                            {doc.page_count ? `${doc.page_count} pages` : 'Document'}
                          </span>
                        </div>
                        {doc.status && doc.status !== 'READY' && (
                          <span className="text-[10px] text-amber-600 block">
                            Status: {doc.status}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div>
                {selectedDocIds.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowScopeModal(false);
                      const targetUrl =
                        selectedDocIds.length === 2
                          ? `/compare?docA=${selectedDocIds[0]}&docB=${selectedDocIds[1]}`
                          : `/compare?mode=matrix&docs=${selectedDocIds.join(',')}`;
                      window.location.assign(targetUrl);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <GitCompare className="w-3.5 h-3.5 text-clario-navy" />
                    <span>Compare ({selectedDocIds.length})</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedDocIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => selection.select([])}
                    className="px-3 py-1 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Clear Filter
                  </button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowScopeModal(false)}
                  className="px-4"
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
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
