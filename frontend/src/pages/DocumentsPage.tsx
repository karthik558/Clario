import { PageHeader } from '../components/layout/PageHeader';
import { workspaceDate } from '../utils/date';
import { Select } from '../components/ui/Select';
import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Eye,
  Download,
  FileText,
  Layers,
  Calendar,
  Tag,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { DocumentItem } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { FileUploadZone } from '../components/documents/FileUploadZone';
import { DocumentViewerModal } from '../components/documents/DocumentViewerModal';

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('');
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const fetchDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getDocuments();
      setDocuments(data);
    } catch (err) {
      setError('Could not load documents. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to delete ALL documents and their indexed embeddings? This cannot be undone.')) {
      setClearing(true);
      try {
        await api.clearAllDocuments();
        await fetchDocuments();
      } catch (err) {
        setError('Failed to clear documents.');
      } finally {
        setClearing(false);
      }
    }
  };

  const handleDelete = async (docId: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      try {
        await api.deleteDocument(docId);
        fetchDocuments();
      } catch (err) {
        setError('Could not delete the document. Please retry.');
      }
    }
  };

  // Derive unique collections
  const collections = Array.from(new Set(documents.map((d) => d.collection).filter(Boolean)));

  const filteredDocuments = documents.filter(doc =>
    (!search || `${doc.title} ${doc.filename}`.toLowerCase().includes(search.toLowerCase())) &&
    (!statusFilter || doc.status === statusFilter) &&
    (!collectionFilter || doc.collection === collectionFilter));

  return (
    <div className="space-y-6">
      {error && <div role="alert" className="p-4 rounded-md bg-rose-50 text-rose-800 text-sm">{error} <button onClick={fetchDocuments} className="underline">Retry</button></div>}
      {/* Top Action Header */}
      <PageHeader title="Document library" description="Manage your files and inspect the passages available for review.">
        <div className="flex flex-wrap items-center gap-2">
          {documents.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={clearing}
              onClick={handleClearAll}
              className="text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {clearing ? 'Clearing...' : 'Clear All'}
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowUploadZone(!showUploadZone)}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            {showUploadZone ? 'Close Upload' : 'Upload Documents'}
          </Button>
        </div>
      </PageHeader>

      {/* Collapsible Upload Zone */}
      {showUploadZone && (
        <Card className="animate-in fade-in border-slate-200 bg-white">
          <FileUploadZone
            onUploadSuccess={() => {
              fetchDocuments();
              setShowUploadZone(false);
            }}
          />
        </Card>
      )}

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents by name..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-md border border-slate-200 bg-white focus:outline-none focus:border-slate-900 text-slate-900"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center space-x-1.5 text-xs text-clario-text-secondary">
              <Filter className="w-3.5 h-3.5" />
              <span>Status:</span>
              <Select
                aria-label="Document status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-white border border-clario-border text-clario-text rounded-md px-2.5 py-1.5 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="READY">Ready</option>
                <option value="PROCESSING">Processing</option>
                <option value="ERROR">Error</option>
              </Select>
            </div>

            {collections.length > 0 && (
              <div className="flex items-center space-x-1.5 text-xs text-clario-text-secondary">
                <span>Collection:</span>
                <Select
                  aria-label="Document collection"
                  value={collectionFilter}
                  onChange={(e) => setCollectionFilter(e.target.value)}
                  className="text-xs bg-white border border-clario-border text-clario-text rounded-md px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="">All Collections</option>
                  {collections.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Document Grid / Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-xs text-clario-text-secondary">
            Loading corpus documents...
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-md border border-clario-border p-8">
            <FileText className="w-8 h-8 text-clario-text-muted mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-clario-text mb-1">No documents found</h4>
            <p className="text-xs text-clario-text-secondary max-w-sm mx-auto mb-4">
              Upload documents or adjust your filters to view indexed materials.
            </p>
            <Button variant="secondary" size="sm" onClick={() => setShowUploadZone(true)}>
              Upload First Document
            </Button>
          </div>
        ) : (
          filteredDocuments.map((doc) => (
            <Card
              key={doc.id}
              hoverEffect
              onClick={() => setSelectedDocId(doc.id)}
              className="flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="navy" size="sm">
                    {doc.file_type.toUpperCase()}
                  </Badge>
                  <Badge variant={doc.status === 'READY' ? 'sage' : 'gold'} size="sm">
                    {doc.status}
                  </Badge>
                </div>

                <h3 className="font-semibold text-sm text-clario-navy tracking-tight mb-1 line-clamp-1">
                  {doc.title}
                </h3>
                <p className="text-[11px] text-clario-text-secondary font-mono truncate mb-3">
                  {doc.filename}
                </p>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-md border border-slate-200 mb-3">
                  <div>
                    <span className="text-slate-400 block text-[10px]">PAGES</span>
                    <span className="font-semibold text-slate-800">{doc.page_count}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">CHUNKS</span>
                    <span className="font-semibold text-slate-900">{doc.chunk_count}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">WORDS</span>
                    <span className="font-semibold text-slate-800">{doc.word_count}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">SIZE</span>
                    <span className="font-semibold text-slate-800">{(doc.file_size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>

                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {doc.tags.map((t, idx) => (
                      <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div
                className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[10px] text-slate-400">
                  {workspaceDate(doc.created_at).toLocaleDateString()}
                </span>
                <div className="flex items-center space-x-1.5">
                  <a
                    href={api.getDocumentFileUrl(doc.id)}
                    download={doc.filename}
                    className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    title="Download original file"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => setSelectedDocId(doc.id)}
                    className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    title="View passages"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id, doc.title)}
                    className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                    title="Delete document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Document Inspector Modal */}
      <DocumentViewerModal
        documentId={selectedDocId}
        onClose={() => setSelectedDocId(null)}
      />
    </div>
  );
};
