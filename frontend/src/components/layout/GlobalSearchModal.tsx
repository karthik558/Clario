import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  FileText,
  ArrowRight,
  Clock,
  SearchCheck,
  Layers,
  Upload,
  MessageSquareQuote,
  GitCompare,
  Rows3,
  Keyboard,
  ShieldCheck,
  Sliders,
  Calendar,
  Network,
  EyeOff
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { api } from '../../services/api';
import { SearchResultItem, DocumentItem } from '../../types';

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
  const [mode, setMode] = useState<'hybrid' | 'bm25' | 'vector'>(() => {
    try {
      const saved = localStorage.getItem('clario_default_search_mode');
      if (saved === 'bm25' || saved === 'vector' || saved === 'hybrid') return saved;
    } catch {}
    return 'hybrid';
  });
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const requestId = useRef(0);
  const [error, setError] = useState('');

  const navItems = [
    { name: 'Overview', path: '/' },
    { name: 'Document Library', path: '/documents' },
    { name: 'Ask Clario', path: '/ask' },
    { name: 'Compare versions', path: '/compare' },
    { name: 'Knowledge Graph', path: '/graph' },
    { name: 'Findings', path: '/findings' },
    { name: 'Clause Redline', path: '/negotiate' },
    { name: 'Compliance Matrix', path: '/compliance' },
    { name: 'Policy Checker', path: '/policy-checker' },
    { name: 'Redaction Studio', path: '/redact' },
    { name: 'Obligations Timeline', path: '/obligations' },
    { name: 'Red Team Critique', path: '/critique' },
    { name: 'Clause Library', path: '/clauses' },
    { name: 'Executive Briefs', path: '/briefs' },
    { name: 'Reports', path: '/reports' },
    { name: 'Search Lab', path: '/search-lab' },
    { name: 'Settings', path: '/settings' },
  ];

  useEffect(() => {
    if (isOpen) {
      api.getDocuments().then(setDocuments).catch(() => {});
    }
  }, [isOpen]);

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

  const matchingDocs = query.trim()
    ? documents.filter(d => d.title.toLowerCase().includes(query.toLowerCase()) || d.filename.toLowerCase().includes(query.toLowerCase()))
    : [];

  const matchingNav = query.trim().length >= 2
    ? navItems.filter(n => n.name.toLowerCase().includes(query.toLowerCase()) || n.path.toLowerCase().includes(query.toLowerCase()))
    : [];

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Search documents" maxWidth="2xl">
      {/* Search Input Bar */}
      <div className="flex items-center px-4 py-3.5 border-b border-slate-200 bg-white">
        <Search className="w-5 h-5 text-slate-400 shrink-0 mr-3" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search keywords, clauses, obligations, or research..."
          autoFocus
          aria-label="Search passages"
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none focus:outline-none"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => handleSearch('')}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer outline-none focus:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results Body */}
      <div className="max-h-96 overflow-y-auto p-4 space-y-3 bg-white">
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {loading && (
          <div className="text-center py-8 text-xs text-slate-500">
            Searching passage index...
          </div>
        )}

        {/* Quick Navigation Matching */}
        {matchingNav.length > 0 && (
          <div className="space-y-1.5 pb-2 border-b border-slate-100">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block px-1">
              Quick Navigation
            </span>
            <div className="flex flex-wrap gap-1.5">
              {matchingNav.map((n) => (
                <button
                  key={n.path}
                  type="button"
                  onClick={() => { window.location.href = n.path; onClose(); }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-800 transition-colors cursor-pointer outline-none focus:outline-none focus:ring-1 focus:ring-slate-300"
                >
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                  <span>{n.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Matching Document Titles */}
        {matchingDocs.length > 0 && (
          <div className="space-y-1.5 pb-2 border-b border-slate-100">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block px-1">
              Documents
            </span>
            <div className="space-y-1">
              {matchingDocs.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => {
                    if (onSelectResult) {
                      onSelectResult({
                        chunk_id: '',
                        document_id: doc.id,
                        document_title: doc.title,
                        page_number: 1,
                        snippet: `${doc.title} (${doc.file_type.toUpperCase()}) - ${doc.page_count} pages, ${doc.chunk_count} indexed chunks.`,
                        score: 1.0,
                        rank: 1,
                        method: 'document'
                      });
                    }
                    onClose();
                  }}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-100 flex items-center justify-between transition-colors border border-slate-200 bg-white cursor-pointer outline-none focus:outline-none focus:ring-1 focus:ring-slate-300"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-slate-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-900 truncate">{doc.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase font-mono">
                      {doc.file_type}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 shrink-0">Open Document &rarr;</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Matching Passage Chunks */}
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
                className="w-full text-left p-3 rounded-md border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer group bg-white outline-none focus:outline-none focus:ring-1 focus:ring-slate-300"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="font-semibold text-xs text-slate-900">{r.document_title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
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

        {!loading && !error && query && results.length === 0 && matchingDocs.length === 0 && matchingNav.length === 0 && (
          <div className="text-center py-8 text-xs text-slate-500">
            {documents.length === 0
              ? 'No documents in workspace yet. Upload documents in the Document Library to index and search passages.'
              : `No matching passages found for "${query}".`}
          </div>
        )}

        {!query && documents.length === 0 && (
          <div className="py-6 text-center">
            <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-800">Workspace Index is Empty</p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1 mb-3">
              Upload documents in the Document Library to index provisions, citations, and semantic vectors.
            </p>
            <button
              type="button"
              onClick={() => { window.location.href = '/documents'; onClose(); }}
              className="inline-flex items-center px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors cursor-pointer outline-none focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              Go to Document Library
            </button>
          </div>
        )}

        {!query && documents.length > 0 && (
          <div className="py-2 space-y-4">
            {/* Quick Actions Grid */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                Quick Actions
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => { window.location.href = '/ask'; onClose(); }}
                  className="p-2.5 rounded-md border border-slate-200 bg-slate-50/60 hover:bg-slate-100 hover:border-slate-300 text-left transition-colors flex flex-col justify-between group"
                >
                  <MessageSquareQuote className="w-4 h-4 text-slate-500 group-hover:text-clario-navy mb-1.5 transition-colors" />
                  <span className="font-semibold text-xs text-slate-900 group-hover:text-clario-navy">Ask Clario</span>
                  <span className="text-[10px] text-slate-500">Query & verify sources</span>
                </button>
                <button
                  type="button"
                  onClick={() => { window.location.href = '/compare'; onClose(); }}
                  className="p-2.5 rounded-md border border-slate-200 bg-slate-50/60 hover:bg-slate-100 hover:border-slate-300 text-left transition-colors flex flex-col justify-between group"
                >
                  <GitCompare className="w-4 h-4 text-slate-500 group-hover:text-clario-navy mb-1.5 transition-colors" />
                  <span className="font-semibold text-xs text-slate-900 group-hover:text-clario-navy">Compare Matrix</span>
                  <span className="text-[10px] text-slate-500">Side-by-side & matrix</span>
                </button>
                <button
                  type="button"
                  onClick={() => { window.location.href = '/negotiate'; onClose(); }}
                  className="p-2.5 rounded-md border border-slate-200 bg-slate-50/60 hover:bg-slate-100 hover:border-slate-300 text-left transition-colors flex flex-col justify-between group"
                >
                  <ShieldCheck className="w-4 h-4 text-slate-500 group-hover:text-clario-navy mb-1.5 transition-colors" />
                  <span className="font-semibold text-xs text-slate-900 group-hover:text-clario-navy">Redline Studio</span>
                  <span className="text-[10px] text-slate-500">Playbook fallbacks</span>
                </button>
                <button
                  type="button"
                  onClick={() => { window.location.href = '/renewal-planner'; onClose(); }}
                  className="p-2.5 rounded-md border border-slate-200 bg-slate-50/60 hover:bg-slate-100 hover:border-slate-300 text-left transition-colors flex flex-col justify-between group"
                >
                  <Calendar className="w-4 h-4 text-slate-500 group-hover:text-clario-navy mb-1.5 transition-colors" />
                  <span className="font-semibold text-xs text-slate-900 group-hover:text-clario-navy">Renewal Planner</span>
                  <span className="text-[10px] text-slate-500">Notice cutoff deadlines</span>
                </button>
                <button
                  type="button"
                  onClick={() => { window.location.href = '/graph'; onClose(); }}
                  className="p-2.5 rounded-md border border-slate-200 bg-slate-50/60 hover:bg-slate-100 hover:border-slate-300 text-left transition-colors flex flex-col justify-between group"
                >
                  <Network className="w-4 h-4 text-slate-500 group-hover:text-clario-navy mb-1.5 transition-colors" />
                  <span className="font-semibold text-xs text-slate-900 group-hover:text-clario-navy">Knowledge Graph</span>
                  <span className="text-[10px] text-slate-500">2D semantic clusters</span>
                </button>
                <button
                  type="button"
                  onClick={() => { window.location.href = '/redact'; onClose(); }}
                  className="p-2.5 rounded-md border border-slate-200 bg-slate-50/60 hover:bg-slate-100 hover:border-slate-300 text-left transition-colors flex flex-col justify-between group"
                >
                  <EyeOff className="w-4 h-4 text-slate-500 group-hover:text-clario-navy mb-1.5 transition-colors" />
                  <span className="font-semibold text-xs text-slate-900 group-hover:text-clario-navy">Redaction Studio</span>
                  <span className="text-[10px] text-slate-500">PII & sanitization</span>
                </button>
              </div>
            </div>

            {/* Keyword Jump List */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                Popular Provision Searches
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'limitation of liability',
                  'indemnification',
                  'data retention',
                  'breach notification',
                  'termination for convenience',
                  'governing law',
                  'service level credits'
                ].map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => handleSearch(kw)}
                    className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-200 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer outline-none focus:outline-none focus:ring-1 focus:ring-slate-300"
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center space-x-3 text-[11px] text-slate-400">
          <span>Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-md font-mono text-slate-500 shadow-2xs">ESC</kbd> to close</span>
          <span>&bull;</span>
          <span>Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-md font-mono text-slate-500 shadow-2xs">?</kbd> for HUD</span>
        </div>

        {/* Retrieval Mode Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Engine:</span>
          <div className="flex bg-slate-200/80 rounded-md p-0.5 border border-slate-200/80 text-[11px]">
            <button
              type="button"
              aria-pressed={mode === 'hybrid'}
              onClick={() => { setMode('hybrid'); if (query) handleSearch(query, 'hybrid'); }}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer outline-none ${
                mode === 'hybrid' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hybrid
            </button>
            <button
              type="button"
              aria-pressed={mode === 'bm25'}
              onClick={() => { setMode('bm25'); if (query) handleSearch(query, 'bm25'); }}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer outline-none ${
                mode === 'bm25' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              BM25
            </button>
            <button
              type="button"
              aria-pressed={mode === 'vector'}
              onClick={() => { setMode('vector'); if (query) handleSearch(query, 'vector'); }}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer outline-none ${
                mode === 'vector' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vector
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
