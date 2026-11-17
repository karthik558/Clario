import React, { useState, useEffect } from 'react';
import { Search, X, FileText, ArrowRight, Clock, Sparkles } from 'lucide-react';
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSearch = async (searchQuery: string) => {
    setQuery(searchQuery);
    if (!searchQuery.trim()) {
      setResults([]);
      setLatency(null);
      return;
    }

    setLoading(true);
    try {
      const res = await api.search(searchQuery, mode, 5);
      setResults(res.results || []);
      setLatency(res.latency_ms);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-clario-navy/50 backdrop-blur-xs p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-elevated border border-clario-border overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-clario-border bg-clario-ivory-card">
          <Search className="w-5 h-5 text-clario-teal shrink-0 mr-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search keywords, clauses, obligations, or research..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-clario-text placeholder-clario-text-muted focus:outline-none"
          />
          {query && (
            <button onClick={() => handleSearch('')} className="p-1 text-clario-text-muted hover:text-clario-text mr-2">
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Mode Switcher */}
          <div className="flex bg-white rounded-lg p-0.5 border border-clario-border text-xs">
            <button
              onClick={() => { setMode('hybrid'); if (query) handleSearch(query); }}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                mode === 'hybrid' ? 'bg-clario-teal text-white' : 'text-clario-text-secondary hover:text-clario-text'
              }`}
            >
              Hybrid
            </button>
            <button
              onClick={() => { setMode('bm25'); if (query) handleSearch(query); }}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                mode === 'bm25' ? 'bg-clario-teal text-white' : 'text-clario-text-secondary hover:text-clario-text'
              }`}
            >
              BM25
            </button>
            <button
              onClick={() => { setMode('vector'); if (query) handleSearch(query); }}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                mode === 'vector' ? 'bg-clario-teal text-white' : 'text-clario-text-secondary hover:text-clario-text'
              }`}
            >
              Vector
            </button>
          </div>
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="text-center py-8 text-xs text-clario-text-secondary">
              Searching passage index...
            </div>
          )}

          {!loading && results.length > 0 && (
            <>
              <div className="flex items-center justify-between text-[11px] text-clario-text-secondary px-1">
                <span>{results.length} passages retrieved</span>
                {latency !== null && (
                  <span className="flex items-center space-x-1 font-mono text-clario-teal">
                    <Clock className="w-3 h-3" />
                    <span>{latency} ms</span>
                  </span>
                )}
              </div>

              {results.map((r) => (
                <div
                  key={r.chunk_id}
                  onClick={() => {
                    if (onSelectResult) onSelectResult(r);
                    onClose();
                  }}
                  className="p-3 rounded-xl border border-clario-border hover:border-clario-teal/50 hover:bg-clario-ivory transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-3.5 h-3.5 text-clario-teal shrink-0" />
                      <span className="font-semibold text-xs text-clario-navy">{r.document_title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-clario-sage-light text-clario-navy font-medium">
                        Page {r.page_number}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-clario-text-secondary">
                      Score: {r.score}
                    </span>
                  </div>
                  <p className="text-xs text-clario-text leading-relaxed line-clamp-2">
                    {r.snippet}
                  </p>
                </div>
              ))}
            </>
          )}

          {!loading && query && results.length === 0 && (
            <div className="text-center py-8 text-xs text-clario-text-secondary">
              No matching passages found for "{query}".
            </div>
          )}

          {!query && (
            <div className="py-6 text-center">
              <Sparkles className="w-6 h-6 text-clario-gold mx-auto mb-2" />
              <p className="text-xs font-medium text-clario-text">Instant Cross-Document Retrieval</p>
              <p className="text-[11px] text-clario-text-secondary max-w-sm mx-auto mt-1">
                Type queries such as "retention period", "limitation of liability", or "differential privacy".
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-clario-ivory border-t border-clario-border flex items-center justify-between text-[11px] text-clario-text-secondary">
          <div className="flex items-center space-x-3">
            <span>Press <kbd className="px-1 py-0.5 bg-white border border-clario-border rounded font-mono">ESC</kbd> to close</span>
          </div>
          <span className="text-clario-teal font-medium">Clario Universal Index</span>
        </div>
      </div>
    </div>
  );
};
