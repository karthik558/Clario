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
  return <fieldset disabled={disabled} className="flex flex-wrap gap-2 text-xs">
    <legend className="mb-2 font-semibold">{ids.length ? `${ids.length} document${ids.length === 1 ? '' : 's'} selected` : 'Sources · Entire workspace'}</legend>
    {error && <span role="alert">{error}</span>}
    <button aria-pressed={!ids.length} onClick={() => select([])} className="rounded-md border px-3 py-1.5 aria-pressed:bg-clario-navy aria-pressed:text-white">Entire Workspace</button>
    {documents.map(doc => <button key={doc.id} title={doc.title} aria-pressed={ids.includes(doc.id)}
      onClick={() => select(ids.includes(doc.id) ? ids.filter(id => id !== doc.id) : [...ids, doc.id])}
      className="max-w-full truncate rounded-md border px-3 py-1.5 aria-pressed:bg-clario-navy aria-pressed:text-white">{doc.title}</button>)}
    {ids.filter(id => !documents.some(doc => doc.id === id)).map(id => <button key={id} onClick={() => select(ids.filter(other => other !== id))} className="rounded-md border px-2">Remove unavailable source</button>)}
  </fieldset>;
}
