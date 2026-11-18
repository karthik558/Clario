import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowUp, BookOpen, Maximize2, MessageCircle, Search, X } from 'lucide-react';
import { api } from '../../services/api';
import type { AskResponse, CitationItem } from '../../types';
import { Markdown } from '../ui/Markdown';

import { AskSources, useAskDocuments, type useAskSelection } from '../documents/AskSources';

interface Props {
  selection: ReturnType<typeof useAskSelection>;
  onExpand: (draft: string) => void;
  onSearch: () => void;
  onSource: (citation: CitationItem) => void;
}

export function QuickAsk({ selection, onExpand, onSearch, onSource }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const { documents, error: sourceError } = useAskDocuments(open);
  const [sentQuestion, setSentQuestion] = useState('');
  const thread = useRef<HTMLDivElement>(null);
  useEffect(() => { if (thread.current) thread.current.scrollTop = 0; }, [sentQuestion]);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  function close() {
    setOpen(false);
    button.current?.focus();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || pending) return;
    setPending(true);
    setSentQuestion(question);
    setAnswer(null);
    setDraft('');
    setError('');
    try {
      setAnswer(await api.ask(question, selection.ids.length ? selection.ids : undefined));
    } catch (err) {
      setDraft(question);
      setError(err instanceof Error ? err.message : 'Could not get an answer. Your question is ready to retry.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="quick-ask fixed z-20 flex flex-col items-end gap-2" onKeyDown={event => {
      if (open && event.key === 'Escape') { event.stopPropagation(); close(); }
    }}>
      {open && <section id="quick-ask-panel" role="dialog" aria-label="Quick Ask Clario" className="quick-panel flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-elevated">
        <header className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
          <MessageCircle size={18} /><h2 className="flex-1 font-semibold">Ask Clario</h2>
          <button aria-label="Expand to Ask Clario" title="Open full conversation" disabled={pending} onClick={() => onExpand(draft)} className="rounded-md p-2 hover:bg-slate-100 disabled:opacity-40"><Maximize2 size={16} /></button>
          <button aria-label="Close quick chat" onClick={close} className="rounded-md p-2 hover:bg-slate-100"><X size={17} /></button>
        </header>
        <details className="shrink-0 max-h-[30%] overflow-auto border-b px-4 py-2 text-xs">
          <summary className="cursor-pointer font-semibold">{selection.ids.length ? `${selection.ids.length} document${selection.ids.length === 1 ? '' : 's'} selected` : 'Choose documents · Entire workspace'}</summary>
          <div className="py-2"><AskSources documents={documents} selection={selection} error={sourceError} disabled={pending} /></div>
        </details>
        <div ref={thread} className="min-h-0 overflow-y-auto px-4 py-4">
          {sentQuestion && <p className="mb-3 ml-auto w-fit max-w-full break-words rounded-lg bg-clario-navy px-3 py-2 text-sm text-white">{sentQuestion}</p>}
          {answer ? <>
            <Markdown>{answer.answer}</Markdown>
            {answer.citations.length > 0 && <p className="mt-3 text-xs text-slate-500">{answer.mode}</p>}
            {answer.citations.map(source => <button key={source.citation_id} onClick={() => onSource(source)} className="mt-2 block max-w-full truncate text-left text-xs font-medium underline">[{source.citation_id}] {source.document_title} · p. {source.page_number}</button>)}
          </> : !sentQuestion && <p className="text-sm text-slate-600">Ask a question about your indexed documents, or search for a passage.</p>}
          <button onClick={() => { close(); onSearch(); }} className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs hover:bg-slate-50"><Search size={14} />Search passages</button>
        </div>
        {pending && <p role="status" className="px-4 pb-2 text-xs text-slate-600">Clario is answering…</p>}
        {error && <p role="alert" className="px-4 pb-2 text-xs text-rose-700">{error}</p>}
        <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t bg-slate-50 p-3">
          <input ref={input} aria-label="Quick document question" placeholder="Ask about your documents…" value={draft} readOnly={pending} onChange={event => setDraft(event.target.value)} className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-base sm:text-sm" />
          <button aria-label="Send quick question" disabled={pending || !draft.trim()} className="rounded-full bg-clario-navy p-2.5 text-white disabled:opacity-40"><ArrowUp size={16} /></button>
        </form>
      </section>}
      <button ref={button} aria-expanded={open} aria-controls={open ? 'quick-ask-panel' : undefined} onClick={() => open ? close() : setOpen(true)} className="quick-pill inline-flex items-center gap-2 rounded-full border border-white/20 bg-clario-navy py-2 pl-2 pr-4 text-sm font-semibold text-white shadow-elevated">
        <span className="rounded-full bg-white/10 p-1.5"><BookOpen size={16} /></span>Ask Clario
      </button>
    </div>
  );
}
