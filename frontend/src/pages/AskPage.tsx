import React, { useState, useEffect, useRef } from 'react';
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
  Sparkles
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
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [history, setHistory] = useState<Array<{ query: string; response: AskResponse }>>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [selectedCitation, setSelectedCitation] = useState<CitationItem | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [engineLabel, setEngineLabel] = useState('');
  const [llmProvider, setLlmProvider] = useState<'ollama' | 'extractive' | string>('ollama');
  const [switchingEngine, setSwitchingEngine] = useState(false);
  const [error, setError] = useState('');
  const [pendingQuery, setPendingQuery] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [clearing, setClearing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    api.getSettings().then(config => {
      if (!cancelled) {
        setLlmProvider(config.llm_provider || 'ollama');
        setEngineLabel(config.llm_provider === 'ollama' ? `Ollama · ${config.ollama_model}` : config.llm_provider === 'extractive' ? 'Extractive · retrieved passages' : config.llm_provider);
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

  const handleSwitchEngine = async (provider: 'ollama' | 'extractive') => {
    if (switchingEngine || loading) return;
    setSwitchingEngine(true);
    try {
      await api.updateSettings({ llm_provider: provider });
      setLlmProvider(provider);
      const conf = await api.getSettings();
      setEngineLabel(provider === 'ollama' ? `Ollama · ${conf.ollama_model}` : 'Extractive · retrieved passages');
    } catch (err) {
      console.error(err);
    } finally {
      setSwitchingEngine(false);
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
    try {
      const docIds = selectedDocIds.length > 0 ? selectedDocIds : undefined;
      const res = await api.ask(q, docIds);
      setResponse(res);
      setHistory((prev) => [...prev, { query: q, response: res }]);
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      setQuery(q);
      setError('The answer could not be generated or saved. Your question is kept below; please try again.');
    } finally {
      setLoading(false);
      setPendingQuery('');
    }
  };

  const handleCopy = async (text: string, index: number) => {
    try { await navigator.clipboard.writeText(text); } catch { setError('Could not copy the answer. Select and copy the text manually.'); return; }
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
    } catch (err) {
      setError('Could not clear conversation history. Please try again.');
    } finally {
      setClearing(false);
    }
  };

  const presets = [
    'What is the data retention policy for API inputs and outputs?',
    'What limitation of liability caps appear in the 2023 vs 2024 policies?',
    'How does the security incident notification timeline change between 2023 and 2024?',
    'Are API customer inputs used to train or improve models?'
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-clario-text tracking-tight flex items-center space-x-2">
            <span>Ask Clario</span>
          </h2>
          <p className="text-xs text-clario-text-secondary">
            Ask questions across your documents and verify answers against cited passages.
          </p>
        </div>
        <div className="flex items-center space-x-2">
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
      </div>

      <p className="text-xs text-clario-text-secondary">Completed answers and source citations are saved in this workspace. The latest 50 answers appear below.</p>
      {error && <p role="alert" className="p-3 border border-rose-200 bg-rose-50 text-rose-800 rounded-md text-sm">{error}</p>}
      {loadingHistory && <p role="status" className="text-sm text-clario-text-secondary">Loading saved answers…</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white rounded-md border border-clario-border text-xs">
        <div className="flex items-center space-x-2">
          <span className="text-clario-text-secondary font-medium">Generation Engine:</span>
          <button
            type="button"
            onClick={() => handleSwitchEngine('ollama')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              llmProvider === 'ollama'
                ? 'bg-clario-teal text-white'
                : 'bg-clario-ivory text-clario-text-secondary hover:bg-clario-ivory-muted border border-clario-border'
            }`}
          >
            Ollama Local ({engineLabel.includes('mimo') ? 'mimo-v2.6' : 'Local LLM'})
          </button>
          <button
            type="button"
            onClick={() => handleSwitchEngine('extractive')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              llmProvider === 'extractive'
                ? 'bg-clario-navy text-white'
                : 'bg-clario-ivory text-clario-text-secondary hover:bg-clario-ivory-muted border border-clario-border'
            }`}
          >
            Extractive Synthesis (Instant)
          </button>
        </div>
        <span className="text-[11px] text-clario-text-muted">
          {llmProvider === 'ollama' ? 'Neural model with cited answers' : 'Direct synthesis with instant response'}
        </span>
      </div>
      {/* Scope Selector */}
      {documents.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-md border border-clario-border text-xs">
          <span className="text-clario-text-secondary font-medium">Search Scope:</span>
          <button
            aria-pressed={selectedDocIds.length === 0}
            onClick={() => setSelectedDocIds([])}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              selectedDocIds.length === 0
                ? 'bg-clario-navy text-white'
                : 'bg-clario-ivory text-clario-text-secondary hover:bg-clario-ivory-muted'
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
                className={`px-2.5 py-1 rounded-md text-xs transition-colors truncate max-w-[200px] ${
                  isSelected
                    ? 'bg-clario-teal text-white font-medium'
                    : 'bg-clario-ivory text-clario-text-secondary hover:bg-clario-ivory-muted border border-clario-border'
                }`}
                title={d.title}
              >
                {d.title}
              </button>
            );
          })}
        </div>
      )}

      {/* Preset Starters */}
      {history.length === 0 && !response && !loading && !loadingHistory && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {presets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleAsk(p)}
              className="p-3.5 rounded-md border border-clario-border bg-white hover:border-clario-teal/50 hover:bg-clario-ivory transition-all text-left group flex items-start space-x-3 shadow-subtle"
            >
              <SearchCheck className="w-4 h-4 text-clario-navy shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium text-clario-text group-hover:text-clario-navy transition-colors">
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
              <div className="whitespace-pre-wrap break-words bg-clario-navy text-white px-4 py-2.5 rounded-md rounded-tr-xs text-xs font-medium max-w-xl shadow-xs">
                {item.query}
              </div>
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
                    className="p-1 rounded text-clario-text-secondary hover:text-clario-text hover:bg-clario-ivory transition-colors"
                    title="Copy Answer"
                  >
                    {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-clario-navy" /> : <Copy className="w-3.5 h-3.5 text-clario-text-secondary" />}
                  </button>
                </div>
              </div>

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

              {/* Citations Grid */}
              {item.response.citations.length > 0 && (
                <div className="pt-4 border-t border-clario-border">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-semibold text-clario-navy uppercase tracking-wider flex items-center space-x-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-clario-navy" />
                      <span>Source citations ({item.response.citations.length})</span>
                    </span>
                    <span className="text-[10px] text-clario-text-muted">Click to open source page & passage</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {item.response.citations.map((cit) => (
                      <button type="button"
                        key={cit.citation_id}
                        onClick={() => setSelectedCitation(cit)}
                        className="text-left p-3 rounded-md border border-clario-border bg-clario-ivory/60 hover:border-clario-navy/30 hover:bg-clario-ivory transition-all cursor-pointer group flex flex-col justify-between"
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
                </div>
              )}
            </div>
          </div>
        ))}

        {pendingQuery && <div className="flex justify-end"><p className="max-w-xl whitespace-pre-wrap break-words bg-clario-navy text-white p-4 rounded-md text-sm">{pendingQuery}</p></div>}
        {loading && (
          <div className="bg-white rounded-md border border-clario-border p-6 shadow-subtle flex items-center space-x-3 text-xs text-clario-text-secondary animate-pulse">
            <SearchCheck className="w-5 h-5 text-clario-navy animate-spin" />
            <span>Retrieving relevant passages and synthesizing evidence...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input Form Bar */}
      <Card className="sticky bottom-4 z-10 p-3 shadow-elevated border-clario-teal/30 bg-white">
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
            className="min-w-0 flex-1 text-xs px-3.5 py-2.5 rounded-md border border-clario-border bg-clario-ivory focus:outline-none focus:border-clario-teal text-clario-text resize-none"
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
