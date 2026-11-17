import React, { useState, useEffect } from 'react';
import { Download, FileText, Layers, Hash, Bookmark, ExternalLink } from 'lucide-react';
import { Markdown } from '../ui/Markdown';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import { DocumentDetail } from '../../types';

interface DocumentViewerModalProps {
  documentId: string | null;
  highlightChunkId?: string;
  highlightPage?: number;
  onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  documentId,
  highlightChunkId,
  highlightPage,
  onClose,
}) => {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    if (!documentId) {
      setDoc(null);
      return;
    }
    let cancelled = false;
    setDoc(null);
    const fetchDoc = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getDocument(documentId);
        if (!cancelled) setDoc(data);
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
          <div className="p-4 rounded-md bg-clario-ivory border border-clario-border flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 min-w-0">
              <Badge variant="navy" size="md">
                {doc.file_type.toUpperCase()}
              </Badge>
              <span className="text-clario-text-secondary font-mono break-all">{doc.filename}</span>
              <span className="text-clario-text-muted">&bull;</span>
              <span className="text-clario-text font-medium">{doc.page_count} Pages</span>
              <span className="text-clario-text-muted">&bull;</span>
              <span className="text-clario-text font-medium">{doc.word_count} Words</span>
              <span className="text-clario-text-muted">&bull;</span>
              <span className="text-clario-teal font-semibold">{doc.chunk_count} Chunks Indexed</span>
            </div>

            <div className="flex items-center space-x-2">
              <a
                href={api.getDocumentFileUrl(doc.id)}
                download={doc.filename}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-clario-border rounded-md text-xs font-medium text-clario-text hover:bg-clario-ivory transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-clario-teal" />
                <span>Download Original</span>
              </a>
            </div>
          </div>

          <h4 className="text-sm font-semibold text-clario-navy border-b border-clario-border pb-3">Source passages ({doc.chunks.length})</h4>
          {doc.chunks.length === 0 && <p className="text-sm text-clario-text-secondary">No extracted passages are available for this document.</p>}
            <div className="space-y-3">
              {doc.chunks.map((chunk) => {
                const isTarget = highlightChunkId ? highlightChunkId === chunk.id : highlightPage === chunk.page_number;
                return (
                  <div
                    key={chunk.id}
                    id={`chunk-${chunk.id}`}
                    className={`p-4 rounded-md border transition-all ${
                      isTarget
                        ? 'border-clario-gold bg-amber-50/50 ring-2 ring-clario-gold/20 shadow-card'
                        : 'border-clario-border bg-white hover:border-clario-teal/30'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-clario-border/60 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-clario-navy flex items-center space-x-1">
                          <Layers className="w-3 h-3 text-clario-teal" />
                          <span>Chunk #{chunk.chunk_index + 1}</span>
                        </span>
                        <Badge variant="sage" size="sm">
                          Page {chunk.page_number}
                        </Badge>
                        <span className="text-[11px] font-mono text-clario-text-secondary">
                          {chunk.token_count} tokens
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-clario-text-muted">
                        ID: {chunk.id.slice(0, 8)}...
                      </span>
                    </div>

                    <Markdown>{chunk.content}</Markdown>
                  </div>
                );
              })}
            </div>
        </div>
      )}
    </Modal>
  );
};
