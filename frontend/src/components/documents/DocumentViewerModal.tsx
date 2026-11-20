import React, { useState, useEffect, useMemo } from 'react';
import {
  Download,
  FileText,
  Layers,
  Hash,
  Bookmark,
  ExternalLink,
  BarChart2,
  Search,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  MessageSquare,
  Tag,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Markdown } from '../ui/Markdown';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import { DocumentDetail, WordAnalysisResponse } from '../../types';
import { WordAnalysisVisualizer } from '../analytics/WordAnalysisVisualizer';

interface DocumentViewerModalProps {
  documentId: string | null;
  highlightChunkId?: string;
  highlightPage?: number;
  onClose: () => void;
}

type AnnotationType = 'approved' | 'flagged' | 'exception';

interface ChunkAnnotation {
  type?: AnnotationType;
  note?: string;
  updatedAt?: string;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  documentId,
  highlightChunkId,
  highlightPage,
  onClose,
}) => {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [wordAnalysis, setWordAnalysis] = useState<WordAnalysisResponse | null>(null);
  const [viewMode, setViewMode] = useState<'passages' | 'analysis'>('passages');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AnnotationType>('all');
  const [activePage, setActivePage] = useState<number | null>(null);
  const [annotations, setAnnotations] = useState<Record<string, ChunkAnnotation>>({});
  const [activeNoteChunkId, setActiveNoteChunkId] = useState<string | null>(null);

  // Load annotations from localStorage
  useEffect(() => {
    if (!documentId) return;
    try {
      const stored = localStorage.getItem(`clario_doc_annotations_${documentId}`);
      if (stored) {
        setAnnotations(JSON.parse(stored));
      } else {
        setAnnotations({});
      }
    } catch {
      setAnnotations({});
    }
  }, [documentId]);

  const saveAnnotation = (chunkId: string, type?: AnnotationType, note?: string) => {
    if (!documentId) return;
    const current = annotations[chunkId] || {};
    const next: ChunkAnnotation = {
      ...current,
      type: type !== undefined ? type : current.type,
      note: note !== undefined ? note : current.note,
      updatedAt: new Date().toISOString(),
    };
    const updated = { ...annotations, [chunkId]: next };
    setAnnotations(updated);
    try {
      localStorage.setItem(`clario_doc_annotations_${documentId}`, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save annotation', err);
    }
  };

  useEffect(() => {
    if (!documentId) {
      setDoc(null);
      setWordAnalysis(null);
      return;
    }
    let cancelled = false;
    setDoc(null);
    setWordAnalysis(null);
    const fetchDoc = async () => {
      setLoading(true);
      setError(null);
      try {
        const [docData, analysisData] = await Promise.all([
          api.getDocument(documentId),
          api.getWordAnalysis([documentId]).catch(() => null)
        ]);
        if (!cancelled) {
          setDoc(docData);
          setWordAnalysis(analysisData);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load document');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchDoc();
    return () => { cancelled = true; };
  }, [documentId]);

  useEffect(() => {
    if (!doc) return;
    const target = highlightChunkId ? document.getElementById(`chunk-${highlightChunkId}`) : null;
    target?.scrollIntoView({ block: 'nearest' });
  }, [doc, highlightChunkId]);

  // Derive unique page list
  const pages = useMemo(() => {
    if (!doc) return [];
    const pageMap = new Map<number, number>();
    doc.chunks.forEach((c) => {
      pageMap.set(c.page_number, (pageMap.get(c.page_number) || 0) + 1);
    });
    return Array.from(pageMap.entries()).sort((a, b) => a[0] - b[0]);
  }, [doc]);

  const filteredChunks = useMemo(() => {
    if (!doc) return [];
    return doc.chunks.filter((chunk) => {
      if (activePage !== null && chunk.page_number !== activePage) return false;
      const ann = annotations[chunk.id];
      if (statusFilter !== 'all' && ann?.type !== statusFilter) return false;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const contentMatch = chunk.content.toLowerCase().includes(q);
        const noteMatch = ann?.note?.toLowerCase().includes(q);
        return contentMatch || noteMatch;
      }
      return true;
    });
  }, [doc, activePage, statusFilter, searchFilter, annotations]);

  if (!documentId) return null;

  return (
    <Modal
      isOpen={!!documentId}
      onClose={onClose}
      title={doc?.title || 'Document Inspection'}
      maxWidth="4xl"
    >
      {loading && (
        <div className="py-12 text-center text-xs text-clario-text-secondary">
          Loading document and passage index...
        </div>
      )}

      {error && (
        <div className="p-4 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      )}

      {doc && !loading && (
        <div className="space-y-4">
          {/* Header Metadata Bar */}
          <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 min-w-0">
              <Badge variant="navy" size="md">
                {doc.file_type.toUpperCase()}
              </Badge>
              <span className="text-slate-500 font-mono break-all">{doc.filename}</span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-slate-700 font-medium">{doc.page_count} Pages</span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-slate-700 font-medium">{doc.word_count?.toLocaleString()} Words</span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-slate-900 font-semibold">{doc.chunk_count} Chunks Indexed</span>
            </div>

            <div className="flex items-center space-x-2">
              <a
                href={api.getDocumentFileUrl(doc.id)}
                download={doc.filename}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-800 hover:bg-slate-100 transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Download Original</span>
              </a>
            </div>
          </div>

          {/* View Mode Toggle: Passages vs Word Analysis */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('passages')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-2 ${
                  viewMode === 'passages'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Interactive Passage Canvas ({doc.chunks.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('analysis')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-2 ${
                  viewMode === 'analysis'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Word & Lexical Analysis</span>
              </button>
            </div>

            {viewMode === 'passages' && (
              <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                Showing {filteredChunks.length} of {doc.chunks.length} passages
              </span>
            )}
          </div>

          {viewMode === 'analysis' && wordAnalysis ? (
            <WordAnalysisVisualizer data={wordAnalysis} />
          ) : (
            <div className="space-y-3">
              {/* Passage Toolbar: Filter by Page, Search & Annotation Status */}
              <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-md space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  {/* Search within document */}
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Search within this document's passages..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-slate-800 shadow-2xs"
                    />
                  </div>

                  {/* Filter by Annotation Status */}
                  <div className="flex items-center gap-1.5 shrink-0 text-xs">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <button
                      type="button"
                      onClick={() => setStatusFilter('all')}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                        statusFilter === 'all'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      All Passages
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('flagged')}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                        statusFilter === 'flagged'
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
                      }`}
                    >
                      Flagged
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('approved')}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                        statusFilter === 'approved'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
                      }`}
                    >
                      Approved
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('exception')}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                        statusFilter === 'exception'
                          ? 'bg-slate-800 text-white shadow-2xs'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      Exception
                    </button>
                  </div>
                </div>

                {/* Page Navigation Scrub Strip */}
                {pages.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 text-xs">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1">
                      Jump to Page:
                    </span>
                    <button
                      type="button"
                      onClick={() => setActivePage(null)}
                      className={`px-2 py-0.5 rounded text-[10.5px] font-medium shrink-0 transition-all ${
                        activePage === null
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      All Pages ({doc.page_count})
                    </button>
                    {pages.map(([pageNum, chunkCount]) => (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => {
                          setActivePage(pageNum);
                          const firstChunk = doc.chunks.find((c) => c.page_number === pageNum);
                          if (firstChunk) {
                            setTimeout(() => {
                              document.getElementById(`chunk-${firstChunk.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }, 50);
                          }
                        }}
                        className={`px-2 py-0.5 rounded text-[10.5px] font-medium shrink-0 transition-all flex items-center gap-1 ${
                          activePage === pageNum
                            ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        <span>P.{pageNum}</span>
                        <span className={`text-[9px] px-1 rounded-full ${activePage === pageNum ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-500'}`}>
                          {chunkCount}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Chunks List */}
              {filteredChunks.length === 0 ? (
                <div className="p-8 text-center text-xs text-clario-text-secondary bg-slate-50 rounded-md border border-slate-200">
                  No passages match your active search or filter criteria.
                </div>
              ) : (
                filteredChunks.map((chunk) => {
                  const isTarget = highlightChunkId ? highlightChunkId === chunk.id : highlightPage === chunk.page_number;
                  const ann = annotations[chunk.id] || {};
                  const isNoteOpen = activeNoteChunkId === chunk.id;

                  return (
                    <div
                      key={chunk.id}
                      id={`chunk-${chunk.id}`}
                      className={`p-4 rounded-md border transition-all ${
                        isTarget
                          ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-200 shadow-card'
                          : ann.type === 'flagged'
                          ? 'border-amber-300 bg-amber-50/30'
                          : ann.type === 'approved'
                          ? 'border-emerald-300 bg-emerald-50/20'
                          : ann.type === 'exception'
                          ? 'border-slate-400 bg-slate-50/60'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {/* Chunk Header */}
                      <div className="flex flex-wrap items-center justify-between pb-2 mb-2 border-b border-clario-border/60 text-xs gap-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-clario-navy flex items-center space-x-1">
                            <Layers className="w-3 h-3 text-clario-text-secondary" />
                            <span>Chunk #{chunk.chunk_index + 1}</span>
                          </span>
                          <Badge variant="sage" size="sm">
                            Page {chunk.page_number}
                          </Badge>
                          <span className="text-[11px] font-mono text-clario-text-secondary">
                            {chunk.token_count} tokens
                          </span>
                        </div>

                        {/* Interactive Annotation Controls */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => saveAnnotation(chunk.id, ann.type === 'approved' ? undefined : 'approved')}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all flex items-center gap-1 ${
                              ann.type === 'approved'
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700'
                            }`}
                            title="Mark passage as approved standard clause"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Approved</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => saveAnnotation(chunk.id, ann.type === 'flagged' ? undefined : 'flagged')}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all flex items-center gap-1 ${
                              ann.type === 'flagged'
                                ? 'bg-amber-600 text-white shadow-2xs'
                                : 'bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700'
                            }`}
                            title="Flag passage for legal counsel review"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>Flag</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => saveAnnotation(chunk.id, ann.type === 'exception' ? undefined : 'exception')}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all flex items-center gap-1 ${
                              ann.type === 'exception'
                                ? 'bg-slate-800 text-white shadow-2xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            }`}
                            title="Mark as approved commercial exception"
                          >
                            <ShieldAlert className="w-3 h-3" />
                            <span>Exception</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveNoteChunkId(isNoteOpen ? null : chunk.id)}
                            className={`p-1 rounded text-slate-500 hover:text-slate-900 transition-colors ${
                              ann.note ? 'text-clario-navy bg-slate-100' : 'hover:bg-slate-100'
                            }`}
                            title={ann.note ? `Note: ${ann.note}` : 'Add counsel annotation note'}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Passage Markdown Content */}
                      <div className="select-text">
                        <Markdown>{chunk.content}</Markdown>
                      </div>

                      {/* Expandable Annotation Note Editor */}
                      {(isNoteOpen || ann.note) && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                            <span>Counsel Annotation & Redline Note</span>
                            {ann.updatedAt && (
                              <span className="font-mono text-[9px] text-slate-400">
                                {new Date(ann.updatedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={ann.note || ''}
                            onChange={(e) => saveAnnotation(chunk.id, undefined, e.target.value)}
                            placeholder="Add legal memo, exception reason, or counterparty redline note..."
                            className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-800 shadow-2xs"
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
