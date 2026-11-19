import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Eye,
  Download,
  FileText,
  Files,
  Layers,
  Calendar,
  CheckCircle2,
  AlertCircle,
  MessageSquareQuote,
  GitCompare,
  LayoutGrid,
  List,
  X,
  HardDrive
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { workspaceDate } from '../utils/date';
import { Select } from '../components/ui/Select';
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
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const fetchDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getDocuments();
      setDocuments(data);
    } catch {
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
      } catch {
        setError('Failed to clear documents.');
      } finally {
        setClearing(false);
      }
    }
  };

  const handleDelete = async (docId: string, title: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      try {
        await api.deleteDocument(docId);
        fetchDocuments();
      } catch {
        setError('Could not delete the document. Please retry.');
      }
    }
  };

  // Derive unique collections across all documents
  const collections = useMemo(
    () => Array.from(new Set(documents.map((d) => d.collection).filter(Boolean))) as string[],
    [documents]
  );

  // Derive summary metrics
  const totalChunks = useMemo(
    () => documents.reduce((acc, d) => acc + (d.chunk_count || 0), 0),
    [documents]
  );
  const totalWords = useMemo(
    () => documents.reduce((acc, d) => acc + (d.word_count || 0), 0),
    [documents]
  );
  const totalBytes = useMemo(
    () => documents.reduce((acc, d) => acc + (d.file_size || 0), 0),
    [documents]
  );
  const readyCount = useMemo(
    () => documents.filter((d) => d.status === 'READY').length,
    [documents]
  );
  const errorCount = useMemo(
    () => documents.filter((d) => d.status === 'ERROR').length,
    [documents]
  );

  const filteredDocuments = documents.filter((doc) =>
    (!search || `${doc.title} ${doc.filename}`.toLowerCase().includes(search.toLowerCase())) &&
    (!statusFilter || doc.status === statusFilter) &&
    (!collectionFilter || doc.collection === collectionFilter)
  );

  const isFiltering = Boolean(search || statusFilter || collectionFilter);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setCollectionFilter('');
  };

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="p-4 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={fetchDocuments} className="text-xs font-semibold text-rose-700 underline hover:text-rose-900">
            Retry
          </button>
        </div>
      )}

      {/* Top Page Header */}
      <PageHeader
        title="Document library"
        description="Manage your enterprise files, inspect indexed passages, and coordinate contract intelligence."
      >
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
            className="shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            {showUploadZone ? 'Close Upload' : 'Upload Documents'}
          </Button>
        </div>
      </PageHeader>

      {/* Metric Summary Cards - Matched directly to / Overview Page design */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Total Documents</span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <Files className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {loading ? '—' : documents.length}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Active corpus files
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Indexed Passages</span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {loading ? '—' : totalChunks.toLocaleString()}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Dense vector + BM25 chunks
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Corpus Volume</span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <HardDrive className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {loading ? '—' : `${(totalBytes / 1024).toFixed(0)} KB`}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            {loading ? '—' : `${totalWords.toLocaleString()} words indexed`}
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Indexing Health</span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {loading ? '—' : `${readyCount}/${documents.length}`}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            {errorCount > 0 ? `${errorCount} with errors` : '100% operational'}
          </span>
        </Card>
      </div>

      {/* Collapsible Upload Zone */}
      {showUploadZone && (
        <Card className="animate-in fade-in border-slate-200 bg-white p-6 shadow-card">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-sm text-slate-900 tracking-tight">Upload new documents</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Support for PDF, DOCX, TXT, Excel (XLSX, XLS), and Markdown files with automatic chunking and indexing.
              </p>
            </div>
            <button
              onClick={() => setShowUploadZone(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              title="Close upload"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <FileUploadZone
            onUploadSuccess={(complete) => {
              fetchDocuments();
              if (complete) setShowUploadZone(false);
            }}
          />
        </Card>
      )}

      {/* Search, Filter and View Mode Toolbar */}
      <Card className="p-4 bg-white border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents by name or filename..."
              className="w-full text-xs pl-9 pr-8 py-2 rounded-md border border-slate-200 bg-white focus:outline-none focus:border-slate-900 text-slate-900 placeholder:text-slate-400 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns and View Switcher */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-1.5 text-xs text-clario-text-secondary">
              <Filter className="w-3.5 h-3.5" />
              <span>Status:</span>
              <Select
                aria-label="Document status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-white border border-slate-200 text-slate-800 rounded-md px-2.5 py-1.5 focus:outline-none hover:border-slate-300 transition-colors"
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
                  className="text-xs bg-white border border-slate-200 text-slate-800 rounded-md px-2.5 py-1.5 focus:outline-none hover:border-slate-300 transition-colors"
                >
                  <option value="">All Collections</option>
                  {collections.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </div>
            )}

            {isFiltering && (
              <button
                onClick={clearFilters}
                className="text-xs text-clario-navy hover:underline font-medium px-2 py-1"
              >
                Reset filters
              </button>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center border border-slate-200 rounded-md p-0.5 bg-slate-50 shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md text-xs transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Grid view"
                aria-label="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md text-xs transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Table view"
                aria-label="Table view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Content: Loading, Empty, Grid, or Table */}
      {loading ? (
        <div className="py-20 text-center bg-white rounded-md border border-slate-200">
          <div className="w-8 h-8 border-2 border-clario-navy border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-medium text-slate-600">Loading document library…</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-md border border-slate-200 p-8 shadow-subtle">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <FileText className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-900 mb-1">No documents found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5 leading-relaxed">
            {isFiltering
              ? 'No documents matched your active search and filter criteria. Try resetting your filters.'
              : 'Upload your first contract or policy document to begin semantic search and evidence-backed Q&A.'}
          </p>
          {isFiltering ? (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Reset Filters
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setShowUploadZone(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Upload First Document
            </Button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* High-Density Table View (Matching / OverviewPage table design) */
        <Card className="rounded-md p-0 overflow-hidden bg-white border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Document</th>
                  <th className="py-3 px-3">Format</th>
                  <th className="py-3 px-3">Collection</th>
                  <th className="py-3 px-3">Passages</th>
                  <th className="py-3 px-3">Word Count</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocuments.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-md bg-clario-navy/5 text-clario-navy shrink-0 group-hover:bg-clario-navy/10 transition-colors">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 group-hover:text-clario-navy transition-colors truncate max-w-md">
                            {doc.title}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono truncate max-w-xs">
                            {doc.filename}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant="navy" size="sm">
                        {doc.file_type.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      {doc.collection ? (
                        <Badge variant="gray" size="sm">
                          {doc.collection}
                        </Badge>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      {doc.chunk_count} chunks
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-mono">
                      {doc.word_count?.toLocaleString() ?? 0} words
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={doc.status === 'READY' ? 'sage' : doc.status === 'ERROR' ? 'red' : 'gold'} size="sm">
                        {doc.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end space-x-1">
                        <a
                          href={`/ask?document=${doc.id}`}
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors inline-block"
                          title="Ask Clario about this document"
                        >
                          <MessageSquareQuote className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={`/compare?docA=${doc.id}`}
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors inline-block"
                          title="Compare with another document"
                        >
                          <GitCompare className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={api.getDocumentFileUrl(doc.id)}
                          download={doc.filename}
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors inline-block"
                          title="Download original file"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => setSelectedDocId(doc.id)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="Inspect chunks and passages"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(doc.id, doc.title, e)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* Modernized Card Grid View (Refined typography & clean metric strips) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => (
            <Card
              key={doc.id}
              hoverEffect
              onClick={() => setSelectedDocId(doc.id)}
              className="flex flex-col justify-between p-5 border border-slate-200 bg-white hover:border-slate-300 shadow-subtle group transition-all"
            >
              <div>
                {/* Card Header: Type Badge, Collection, Status */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="navy" size="sm">
                      {doc.file_type.toUpperCase()}
                    </Badge>
                    {doc.collection && (
                      <Badge variant="gray" size="sm">
                        {doc.collection}
                      </Badge>
                    )}
                  </div>
                  <Badge variant={doc.status === 'READY' ? 'sage' : doc.status === 'ERROR' ? 'red' : 'gold'} size="sm">
                    {doc.status}
                  </Badge>
                </div>

                {/* Title & Filename */}
                <h3 className="font-semibold text-sm text-slate-900 group-hover:text-clario-navy tracking-tight mb-1 line-clamp-1 transition-colors">
                  {doc.title}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono truncate mb-4">
                  {doc.filename}
                </p>

                {/* Clean Metrics Strip */}
                <div className="grid grid-cols-4 gap-1 p-2.5 rounded-md bg-slate-50 border border-slate-100 text-center mb-4">
                  <div>
                    <span className="block font-mono font-bold text-slate-900 text-xs">{doc.chunk_count}</span>
                    <span className="text-[10px] text-slate-500 font-medium">chunks</span>
                  </div>
                  <div>
                    <span className="block font-mono font-bold text-slate-900 text-xs">{doc.page_count}</span>
                    <span className="text-[10px] text-slate-500 font-medium">pages</span>
                  </div>
                  <div>
                    <span className="block font-mono font-bold text-slate-900 text-xs">{doc.word_count.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-500 font-medium">words</span>
                  </div>
                  <div>
                    <span className="block font-mono font-bold text-slate-900 text-xs">{(doc.file_size / 1024).toFixed(0)} KB</span>
                    <span className="text-[10px] text-slate-500 font-medium">size</span>
                  </div>
                </div>

                {/* Optional Tags */}
                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {doc.tags.map((t, idx) => (
                      <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Card Actions */}
              <div
                className="pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Calendar className="w-3 h-3" />
                  <span>{workspaceDate(doc.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <a
                    href={`/ask?document=${doc.id}`}
                    className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors inline-block"
                    title="Ask Clario about this document"
                  >
                    <MessageSquareQuote className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={`/compare?docA=${doc.id}`}
                    className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors inline-block"
                    title="Compare with another document"
                  >
                    <GitCompare className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={api.getDocumentFileUrl(doc.id)}
                    download={doc.filename}
                    className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors inline-block"
                    title="Download original file"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => setSelectedDocId(doc.id)}
                    className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    title="Inspect passages"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(doc.id, doc.title, e)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Document Inspector Modal */}
      <DocumentViewerModal
        documentId={selectedDocId}
        onClose={() => setSelectedDocId(null)}
      />
    </div>
  );
};
