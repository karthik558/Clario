import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { DocumentItem } from '../../types';

const storageKey = 'clario.ask.documents';

export function useAskSelection() {
  const [ids, setIds] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(saved) ? saved.filter(id => typeof id === 'string' && id) : [];
    } catch { return []; }
  });
  function select(next: string[]) {
    setIds(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep the current session usable. */ }
  }
  return { ids, select };
}

export function useAskDocuments(active: boolean) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!active) return;
    let current = true;
    setError('');
    api.getDocuments().then(items => {
      if (current) setDocuments(items.filter(item => item.status === 'READY'));
    }).catch(() => { if (current) setError('Could not load document choices.'); });
    return () => { current = false; };
  }, [active]);
  return { documents, error };
}

export function AskSources({ documents, selection, error, disabled }: {
  documents: DocumentItem[];
  selection: ReturnType<typeof useAskSelection>;
  error: string;
  disabled: boolean;
}) {
  const { ids, select } = selection;
  return <fieldset disabled={disabled} className="flex flex-wrap items-center gap-2 text-xs">
    <legend className="mb-2 font-semibold text-slate-700">{ids.length ? `${ids.length} document${ids.length === 1 ? '' : 's'} selected` : 'Sources · Entire workspace'}</legend>
    {error && <span role="alert" className="text-rose-600 text-xs w-full mb-1">{error}</span>}
    <button
      type="button"
      aria-pressed={!ids.length}
      onClick={() => select([])}
      className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-medium border transition-colors shadow-2xs whitespace-nowrap bg-white text-slate-700 border-slate-200 hover:bg-slate-50 aria-pressed:bg-clario-navy aria-pressed:text-white aria-pressed:border-clario-navy"
    >
      Entire Workspace
    </button>
    {documents.map(doc => {
      const isSelected = ids.includes(doc.id);
      return (
        <button
          key={doc.id}
          type="button"
          title={doc.title}
          aria-pressed={isSelected}
          onClick={() => select(isSelected ? ids.filter(id => id !== doc.id) : [...ids, doc.id])}
          className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-medium border transition-colors shadow-2xs truncate max-w-[260px] bg-white text-slate-700 border-slate-200 hover:bg-slate-50 aria-pressed:bg-clario-navy aria-pressed:text-white aria-pressed:border-clario-navy"
        >
          {doc.title}
        </button>
      );
    })}
    {ids.filter(id => !documents.some(doc => doc.id === id)).map(id => (
      <button
        key={id}
        type="button"
        onClick={() => select(ids.filter(other => other !== id))}
        className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-medium border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
      >
        Remove unavailable source
      </button>
    ))}
  </fieldset>;
}
