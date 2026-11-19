import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Maximize2,
  FileText,
  Search,
  Download,
  Layers,
  MessageSquareQuote,
  BarChart2,
  Copy,
  Check
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Markdown } from '../ui/Markdown';
import { api } from '../../services/api';
import { DocumentDetail, DocumentItem, WordAnalysisResponse } from '../../types';
import { WordAnalysisVisualizer } from '../analytics/WordAnalysisVisualizer';

const PassageMarkdown = React.memo(Markdown);

interface DocumentDrawerProps {
  documentId: string | null;
  summary?: DocumentItem;
  onClose: () => void;
  onExpandToModal?: () => void;
}

export const DocumentDrawer: React.FC<DocumentDrawerProps> = ({
  documentId,
  summary,
  onClose,
  onExpandToModal,
}) => {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [wordAnalysis, setWordAnalysis] = useState<WordAnalysisResponse | null>();
  const [activeTab, setActiveTab] = useState<'passages' | 'analysis'>('passages');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copiedChunkId, setCopiedChunkId] = useState<string | null>(null);

  useEffect(() => {
    setDoc(null);
    setWordAnalysis(undefined);
    setError(null);
    setSearchQuery('');
    if (!documentId) return;

    let cancelled = false;
    api.getDocument(documentId)
      .then(detail => { if (!cancelled) React.startTransition(() => setDoc(detail)); })
      .catch(err => { if (!cancelled) setError(err.message || 'Failed to load document'); });

    api.getWordAnalysis([documentId])
      .then(analysis => { if (!cancelled) setWordAnalysis(analysis); })
      .catch(() => { if (!cancelled) setWordAnalysis(null); });

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && documentId) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [documentId, onClose]);

  const filteredChunks = useMemo(() => {
    if (!doc || !doc.chunks) return [];
    if (!searchQuery.trim()) return doc.chunks;
    const query = searchQuery.toLowerCase();
    return doc.chunks.filter((c) => (c.content || '').toLowerCase().includes(query));
  }, [doc, searchQuery]);

  const handleCopyChunk = (chunkId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedChunkId(chunkId);
    setTimeout(() => setCopiedChunkId(null), 2000);
  };

  if (!documentId) return null;

  const metadata = doc?.id === documentId ? doc : summary;
  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/20 z-40 side-drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out Drawer */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-xl md:max-w-2xl bg-white border-l border-slate-200 shadow-2xl flex flex-col side-drawer-panel"
        role="dialog"
        aria-label={metadata?.title || 'Document Source Drawer'}
      >
        {/* Single Unified Drawer Header */}
        <div className="p-4 border-b border-slate-200 bg-white shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 truncate tracking-tight">
                  {metadata?.title ? metadata.title.replace(/_/g, ' ') : error ? 'Document preview' : 'Loading document…'}
                </h2>
                {metadata && (
                  <Badge variant="navy" size="sm">
                    {metadata.file_type.toUpperCase()}
                  </Badge>
                )}
              </div>
              {metadata && (
                <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                  {metadata.page_count} pages &bull; {metadata.word_count.toLocaleString()} words &bull; {metadata.chunk_count} passages
                </p>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {metadata && (
                <a
                  href={`/ask?document=${metadata.id}`}
                  className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  title="Ask Clario about this document"
                >
                  <MessageSquareQuote className="w-4 h-4" />
                </a>
              )}
              {metadata && (
                <a
                  href={api.getDocumentFileUrl(metadata.id)}
                  download={metadata.filename}
                  className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  title="Download original file"
                >
                  <Download className="w-4 h-4" />
                </a>
              )}
              {onExpandToModal && (
                <button
                  onClick={onExpandToModal}
                  className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  title="Expand to full modal"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-1"
                title="Close drawer (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sub-bar: Tabs & Search within the same header */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-1 border border-slate-200 p-0.5 rounded-md bg-slate-50">
              <button
                onClick={() => setActiveTab('passages')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  activeTab === 'passages'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>Passages{metadata && ` (${metadata.chunk_count})`}</span>
              </button>
              <button
                onClick={() => setActiveTab('analysis')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  activeTab === 'analysis'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Lexical Analysis</span>
              </button>
            </div>

            {activeTab === 'passages' && (
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search passages..."
                  className="w-full text-xs pl-8 pr-2.5 py-1.5 rounded-md border border-slate-200 bg-white focus:outline-none focus:border-slate-900 text-slate-900 placeholder:text-slate-400"
                />
              </div>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" aria-busy={!doc && !error}>
          {error && (
            <div className="p-4 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          {doc && activeTab === 'passages' && (
            <div className="space-y-3">

              {filteredChunks.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  {searchQuery ? 'No passages match your search.' : 'No passages available.'}
                </div>
              ) : (
                filteredChunks.map((chunk, idx) => (
                  <div
                    key={chunk.id || idx}
                    className="p-3.5 rounded-md bg-white border border-slate-200 shadow-subtle hover:border-slate-300 transition-all text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-700">Passage #{idx + 1}</span>
                        {chunk.page_number && (
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-mono">
                            Page {chunk.page_number}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleCopyChunk(chunk.id || String(idx), chunk.content)}
                        className="text-slate-400 hover:text-slate-700 flex items-center gap-1 text-[10px] font-medium transition-colors"
                        title="Copy passage text"
                      >
                        {copiedChunkId === (chunk.id || String(idx)) ? (
                          <>
                            <Check className="w-3 h-3 text-slate-700" />
                            <span className="text-slate-700 font-semibold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="text-slate-700 leading-relaxed font-sans text-xs select-text">
                      <PassageMarkdown>{chunk.content}</PassageMarkdown>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {doc && activeTab === 'analysis' && (
            <div className="space-y-4">
              {wordAnalysis === undefined ? (
                <p role="status" className="text-xs text-slate-500">Loading lexical analysis…</p>
              ) : wordAnalysis ? (
                <WordAnalysisVisualizer
                  data={wordAnalysis}
                />
              ) : (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Lexical analysis is not available for this document.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
};
