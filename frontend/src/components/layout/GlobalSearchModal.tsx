import React, { useState, useEffect, useRef } from 'react';
import { Search, X, FileText, ArrowRight, Clock, SearchCheck } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { api } from '../../services/api';
import { SearchResultItem } from '../../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult?: (result: SearchResultItem) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectResult,
}) => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'hybrid' | 'bm25' | 'vector'>('hybrid');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const requestId = useRef(0);
  const [error, setError] = useState('');
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSearch = async (searchQuery: string, searchMode = mode) => {
    const currentRequest = ++requestId.current;
    setError('');
    setQuery(searchQuery);
    if (!searchQuery.trim()) {
      setLoading(false);
      setResults([]);
      setLatency(null);
      return;
    }

    setLoading(true);
    try {
      const res = await api.search(searchQuery, searchMode, 5);
      if (currentRequest !== requestId.current) return;
      setResults(res.results || []);
      setLatency(res.latency_ms);
    } catch (err) {
      if (currentRequest === requestId.current) { setResults([]); setError('Search failed. Please try again.'); }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Search documents" maxWidth="2xl">
      {/* Search Input Bar */}
      <div className="flex flex-wrap gap-y-3 items-center px-4 py-3 border-b border-slate-200 bg-white">
        <Search className="w-5 h-5 text-slate-400 shrink-0 mr-3" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search keywords, clauses, obligations, or research..."
          autoFocus
          aria-label="Search passages"
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
        />
        {query && (
          <button aria-label="Clear search" onClick={() => handleSearch('')} className="p-1 text-slate-400 hover:text-slate-600 mr-2">
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Mode Switcher */}
        <div className="flex bg-slate-100 rounded-md p-0.5 border border-slate-200 text-xs">
          <button
            aria-pressed={mode === 'hybrid'}
            onClick={() => { setMode('hybrid'); if (query) handleSearch(query, 'hybrid'); }}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              mode === 'hybrid' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hybrid
          </button>
          <button
            aria-pressed={mode === 'bm25'}
            onClick={() => { setMode('bm25'); if (query) handleSearch(query, 'bm25'); }}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              mode === 'bm25' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            BM25
          </button>
          <button
            aria-pressed={mode === 'vector'}
            onClick={() => { setMode('vector'); if (query) handleSearch(query, 'vector'); }}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              mode === 'vector' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Vector
          </button>
        </div>
      </div>

      {/* Results Body */}
      <div className="max-h-96 overflow-y-auto p-4 space-y-3 bg-white">
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        {loading && (
          <div className="text-center py-8 text-xs text-slate-500">
            Searching passage index...
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span>{results.length} passages retrieved</span>
              {latency !== null && (
                <span className="flex items-center space-x-1 font-mono text-slate-700">
                  <Clock className="w-3 h-3" />
                  <span>{latency} ms</span>
                </span>
              )}
            </div>

            {results.map((r) => (
              <button
                type="button"
                key={r.chunk_id}
                onClick={() => {
                  if (onSelectResult) onSelectResult(r);
                  onClose();
                }}
                className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer group bg-white"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="font-semibold text-xs text-slate-900">{r.document_title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                      Page {r.page_number}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    Score: {r.score}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                  {r.snippet}
                </p>
              </button>
            ))}
          </>
        )}

        {!loading && !error && query && results.length === 0 && (
          <div className="text-center py-8 text-xs text-slate-500">
            No matching passages found for "{query}".
          </div>
        )}

        {!query && (
          <div className="py-6 text-center">
            <SearchCheck className="w-6 h-6 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-800">Instant Cross-Document Retrieval</p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1">
              Type queries such as "retention period", "limitation of liability", or "differential privacy".
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center space-x-3">
          <span>Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-slate-600">ESC</kbd> to close</span>
        </div>
        <span className="text-slate-700 font-medium">Clario Universal Index</span>
      </div>
    </Modal>
  );
};
