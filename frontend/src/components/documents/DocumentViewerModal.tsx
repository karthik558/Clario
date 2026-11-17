import React, { useState, useEffect } from 'react';
import { Download, FileText, Layers, Hash, Bookmark, ExternalLink } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'chunks' | 'raw'>('chunks');

  useEffect(() => {
    if (!documentId) {
      setDoc(null);
      return;
    }
    const fetchDoc = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getDocument(documentId);
        setDoc(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load document');
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [documentId]);

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
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      )}

      {doc && !loading && (
        <div className="space-y-4">
          {/* Header Metadata Bar */}
          <div className="p-4 rounded-xl bg-clario-ivory border border-clario-border flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-3">
              <Badge variant="navy" size="md">
                {doc.file_type.toUpperCase()}
              </Badge>
              <span className="text-clario-text-secondary font-mono">{doc.filename}</span>
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
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-clario-border rounded-lg text-xs font-medium text-clario-text hover:bg-clario-ivory transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-clario-teal" />
                <span>Download Original</span>
              </a>
            </div>
          </div>

          {/* View Tabs */}
          <div className="flex border-b border-clario-border space-x-4 text-xs font-medium">
            <button
              onClick={() => setActiveTab('chunks')}
              className={`pb-2 border-b-2 transition-colors ${
                activeTab === 'chunks'
                  ? 'border-clario-teal text-clario-teal font-semibold'
                  : 'border-transparent text-clario-text-secondary hover:text-clario-text'
              }`}
            >
              Extracted Chunks & Provenance ({doc.chunks.length})
            </button>
          </div>

          {/* Chunks List */}
          {activeTab === 'chunks' && (
            <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
              {doc.chunks.map((chunk) => {
                const isTarget = highlightChunkId === chunk.id || (highlightPage && chunk.page_number === highlightPage);
                return (
                  <div
                    key={chunk.id}
                    id={`chunk-${chunk.id}`}
                    className={`p-4 rounded-xl border transition-all ${
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

                    <p className="text-xs text-clario-text leading-relaxed whitespace-pre-line font-sans">
                      {chunk.content}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
