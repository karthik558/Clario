import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowUp, Maximize2, Search, X, ChevronDown, ChevronRight, RotateCcw, FileText } from 'lucide-react';
import { api } from '../../services/api';
import { useBackgroundTasks } from '../../context/BackgroundTaskContext';
import type { AskResponse, CitationItem } from '../../types';
import { Markdown } from '../ui/Markdown';

import { AskSources, useAskDocuments, type useAskSelection } from '../documents/AskSources';

interface Props {
  selection: ReturnType<typeof useAskSelection>;
  onExpand: (draft: string) => void;
  onSearch: () => void;
  onSource: (citation: CitationItem) => void;
}

interface QuickMessage {
  id: string;
  question: string;
  answer?: AskResponse;
  error?: string;
  pending?: boolean;
}

export function QuickAsk({ selection, onExpand, onSearch, onSource }: Props) {
  const { startTask } = useBackgroundTasks();
  const [open, setOpen] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<QuickMessage[]>([]);
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});
  const defaultCitationsOpen = (() => {
    try { return localStorage.getItem('clario_show_citations_default') === 'true'; } catch { return false; }
  })();
  const { documents, error: sourceError } = useAskDocuments(open);

  const thread = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    let cancelled = false;
    api.getAnswerHistory()
      .then((rows) => {
        if (cancelled || !Array.isArray(rows)) return;
        setMessages((prev) => {
          const loaded = rows.map((row) => ({
            id: row.id,
            question: row.query,
            answer: row.response,
            pending: false,
          }));
          if (prev.length === 0) return loaded;
          const existingIds = new Set(prev.map((m) => m.id));
          const existingPendingQuestions = new Set(
            prev.filter((m) => m.pending).map((m) => m.question)
          );
          const older = loaded.filter(
            (item) => !existingIds.has(item.id) && !existingPendingQuestions.has(item.question)
          );
          return [...older, ...prev];
        });
      })
      .catch(() => {
        // Non-fatal if history endpoint is unavailable
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (thread.current && messages.length > 0) {
      thread.current.scrollTop = thread.current.scrollHeight;
    }
  }, [messages]);

  function close() {
    setOpen(false);
    setShowSources(false);
    button.current?.focus();
  }

  function toggleCitations(id: string) {
    setExpandedCitations((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? defaultCitationsOpen),
    }));
  }

  async function handleClearHistory() {
    setMessages([]);
    setExpandedCitations({});
    try {
      await api.clearAnswerHistory();
    } catch {
      // Non-fatal
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || pending) return;

    const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPending(true);
    setDraft('');
    setShowSources(false);
    setMessages((prev) => [...prev, { id: msgId, question, pending: true }]);

    try {
      const targetScope = selection.ids.length
        ? `${selection.ids.length} selected doc${selection.ids.length === 1 ? '' : 's'}`
        : 'All Workspace Docs';
      const response = await startTask<AskResponse>({
        title: question,
        category: 'ask',
        targetScope,
        route: '/ask',
        initialStage: 'Answering question based on documents...',
        executor: async (updateProgress) => {
          updateProgress(15, 'Searching documents...', `Searching for: "${question.slice(0, 45)}..."`);
          let currentPct = 15;
          const progressInterval = setInterval(() => {
            if (currentPct < 85) {
              currentPct += 7;
              updateProgress(
                currentPct,
                currentPct < 50 ? 'Searching documents...' : 'Generating answer based on documents...',
                'Analyzing documents'
              );
            }
          }, 350);

          try {
            const res = await api.ask(question, selection.ids.length ? selection.ids : undefined);
            updateProgress(100, 'Answer ready', `Completed in ${res.retrieval_latency_ms}ms`);
            return res;
          } finally {
            clearInterval(progressInterval);
          }
        },
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, answer: response, pending: false } : m))
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Could not get an answer. Your question is ready to retry.';
      setDraft(question);
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, error: errMsg, pending: false } : m))
      );
    } finally {
      setPending(false);
    }
  }

  const lastQuestion = messages.length > 0 ? messages[messages.length - 1].question : '';

  return (
    <div
      className="quick-ask fixed z-40 flex flex-col items-end gap-2.5"
      onKeyDown={(event) => {
        if (open && event.key === 'Escape') {
          event.stopPropagation();
          close();
        }
      }}
    >
      {open && (
        <section
          id="quick-ask-panel"
          role="dialog"
          aria-label="Quick Ask Clario"
          className="quick-panel flex min-h-0 flex-col overflow-hidden rounded-clario border border-clario-border bg-white shadow-elevated"
        >
          {/* Clario Navy Header */}
          <header className="flex shrink-0 items-center justify-between gap-2 bg-clario-navy px-4 py-3 text-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <img src="/favicon.svg" alt="Clario" width="20" height="20" className="shrink-0" />
              <h2 className="text-sm font-semibold leading-tight tracking-tight text-white truncate">
                Ask Clario
              </h2>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {messages.length > 0 && !pending && (
                <button
                  type="button"
                  aria-label="Clear quick chat"
                  title="Clear conversation"
                  onClick={handleClearHistory}
                  className="rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <RotateCcw size={14} />
                </button>
              )}
              <button
                type="button"
                aria-label="Expand to Ask Clario"
                title="Open full conversation"
                disabled={pending}
                onClick={() => onExpand(draft.trim() || lastQuestion)}
                className="rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40"
              >
                <Maximize2 size={15} />
              </button>
              <button
                type="button"
                aria-label="Close quick chat"
                title="Close"
                onClick={close}
                className="rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          {/* Controlled Document Scope Selector */}
          <div className="shrink-0 border-b border-clario-border bg-slate-50/90">
            <button
              type="button"
              onClick={() => setShowSources((prev) => !prev)}
              aria-expanded={showSources}
              className="flex w-full items-center justify-between px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100/80 transition-colors"
            >
              <span className="truncate">
                {selection.ids.length
                  ? `${selection.ids.length} document${selection.ids.length === 1 ? '' : 's'} selected`
                  : 'Choose documents · Entire workspace'}
              </span>
              <ChevronDown
                size={14}
                className={`shrink-0 text-slate-400 transition-transform duration-150 ${showSources ? 'rotate-180' : ''}`}
              />
            </button>
            {showSources && (
              <div className="max-h-40 overflow-y-auto border-t border-slate-200 bg-white px-4 py-2.5">
                <AskSources documents={documents} selection={selection} error={sourceError} disabled={pending} />
              </div>
            )}
          </div>

          {/* Scrollable Message Thread matching AskPage conversation design */}
          <div ref={thread} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-5 bg-white">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <div className="rounded-clario border border-clario-border bg-slate-50/80 p-3.5 text-xs leading-relaxed text-slate-600">
                  Ask a question about your indexed documents to get cited answers, or jump straight to passage search.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onSearch();
                  }}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900 transition-colors shadow-subtle"
                >
                  <Search size={13} className="text-slate-500" />
                  Search passages
                </button>
              </div>
            ) : (
              <>
                {messages.map((msg) => {
                  const isCitationsOpen = expandedCitations[msg.id] ?? defaultCitationsOpen;
                  return (
                    <div key={msg.id} className="space-y-3.5">
                      {/* User message: right-aligned light bubble matching AskPage */}
                      <div className="flex justify-end pl-6">
                        <div className="rounded-2xl bg-slate-100 text-slate-800 border border-slate-200/80 px-3.5 py-2 shadow-2xs max-w-[88%]">
                          <p className="whitespace-pre-wrap break-words text-xs sm:text-[13px] text-slate-800 leading-relaxed font-normal">
                            {msg.question}
                          </p>
                        </div>
                      </div>

                      {/* Clario message: left-aligned with Clario logo & dark navy bubble */}
                      {(msg.pending || msg.error || msg.answer) && (
                        <div className="flex gap-2.5 items-start">
                          <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5 p-1">
                            <img src="/favicon.svg" alt="Clario" className="w-full h-full object-contain" />
                          </div>

                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 text-xs text-slate-500 pl-0.5">
                              <span className="font-semibold text-slate-800 text-xs">Clario</span>
                              {msg.answer && msg.answer.retrieval_latency_ms > 0 && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  {msg.answer.retrieval_latency_ms}ms
                                </span>
                              )}
                            </div>

                            {msg.pending && (
                              <p role="status" className="text-xs text-slate-500">
                                Clario is answering…
                              </p>
                            )}

                            {msg.error && (
                              <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                {msg.error}
                              </p>
                            )}

                            {msg.answer && (
                              <div className="rounded-2xl bg-[#182235] text-slate-200 p-3.5 shadow-sm border border-slate-700/60 space-y-2.5">
                                <div className="text-slate-200 text-xs sm:text-[13px] leading-relaxed max-w-none">
                                  <Markdown invert>{msg.answer.answer}</Markdown>
                                </div>

                                {/* Collapsible Source Citations (hidden by default) */}
                                {msg.answer.citations.length > 0 && (
                                  <div className="pt-2 border-t border-slate-800 text-xs">
                                    <button
                                      type="button"
                                      onClick={() => toggleCitations(msg.id)}
                                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition-colors py-0.5 px-1 rounded hover:bg-slate-800/60 cursor-pointer"
                                      title={isCitationsOpen ? 'Hide sources' : 'Show sources'}
                                    >
                                      <ChevronRight
                                        className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                                          isCitationsOpen ? 'rotate-90' : ''
                                        }`}
                                      />
                                      <span>{msg.answer.citations.length} Sources cited</span>
                                    </button>

                                    {isCitationsOpen && (
                                      <div className="mt-2 pl-2.5 border-l-2 border-slate-700 space-y-1.5">
                                        {msg.answer.citations.map((source) => (
                                          <button
                                            key={source.citation_id}
                                            type="button"
                                            onClick={() => onSource(source)}
                                            className="flex w-full items-center gap-1.5 rounded-md bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-200 transition-colors"
                                          >
                                            <FileText size={12} className="shrink-0 text-slate-400" />
                                            <span className="truncate">
                                              [{source.citation_id}] {source.document_title} · p. {source.page_number}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      onSearch();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900 transition-colors"
                  >
                    <Search size={12} className="text-slate-400" />
                    Search passages
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Input Composer */}
          <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t border-clario-border bg-slate-50 p-3">
            <input
              ref={input}
              aria-label="Quick document question"
              placeholder="Ask about your documents…"
              value={draft}
              readOnly={pending}
              onChange={(event) => setDraft(event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-clario-navy focus:outline-none focus:ring-1 focus:ring-clario-navy/20"
            />
            <button
              type="submit"
              aria-label="Send quick question"
              disabled={pending || !draft.trim()}
              className="rounded-md bg-clario-navy p-2 text-white hover:bg-slate-800 transition-colors disabled:opacity-40 shrink-0"
            >
              <ArrowUp size={16} />
            </button>
          </form>
        </section>
      )}

      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={open ? 'quick-ask-panel' : undefined}
        onClick={() => (open ? close() : setOpen(true))}
        className="quick-pill inline-flex items-center gap-2 rounded-full border border-white/15 bg-clario-navy py-2 pl-2.5 pr-4 text-sm font-semibold text-white shadow-elevated"
      >
        <img src="/favicon.svg" alt="" width="24" height="24" />
        <span>Ask Clario</span>
      </button>
    </div>
  );
}
