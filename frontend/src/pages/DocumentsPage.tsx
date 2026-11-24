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
  HardDrive,
  CheckSquare,
  Square,
  FileSpreadsheet,
  FileCode,
  Rows3,
  SlidersHorizontal,
  FolderSync
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
import { DocumentDrawer } from '../components/documents/DocumentDrawer';
import { Modal } from '../components/ui/Modal';

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('');
  const [smartPreset, setSmartPreset] = useState<'all' | 'policies' | 'long' | 'short'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => {
    return (localStorage.getItem('clario_table_density') as 'comfortable' | 'compact') || 'comfortable';
  });
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [modalDocId, setModalDocId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const toggleDensity = () => {
    const next = density === 'comfortable' ? 'compact' : 'comfortable';
    setDensity(next);
    localStorage.setItem('clario_table_density', next);
  };

  const handleSyncFolder = async () => {
    setSyncing(true);
    setError('');
    try {
      await api.syncDocumentsFolder();
      await fetchDocuments();
    } catch {
      setError('Could not sync documents directory.');
    } finally {
      setSyncing(false);
    }
  };

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

  interface DeleteTarget {
    type: 'single' | 'all';
    docId?: string;
    docTitle?: string;
  }
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleOpenClearAll = () => {
    setDeleteTarget({ type: 'all' });
  };

  const handleOpenDeleteSingle = (docId: string, title: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteTarget({ type: 'single', docId, docTitle: title });
  };

  const executeDelete = async (deleteFromDisk: boolean) => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      if (deleteTarget.type === 'all') {
        await api.clearAllDocuments(deleteFromDisk);
      } else if (deleteTarget.docId) {
        await api.deleteDocument(deleteTarget.docId, deleteFromDisk);
      }
      setDeleteTarget(null);
      await fetchDocuments();
    } catch {
      setError(
        deleteTarget.type === 'all'
          ? 'Failed to clear documents.'
          : 'Could not delete the document. Please retry.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleExportJSON = () => {
    const selected = documents.filter((d) => selectedDocIds.includes(d.id));
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clario-documents-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const selected = documents.filter((d) => selectedDocIds.includes(d.id));
    const headers = ['ID', 'Title', 'Filename', 'Format', 'Collection', 'Chunks', 'Word Count', 'Status', 'Created At'];
    const rows = selected.map((d) => [
      d.id,
      `"${(d.title || '').replace(/"/g, '""')}"`,
      `"${(d.filename || '').replace(/"/g, '""')}"`,
      d.file_type,
      `"${(d.collection || '').replace(/"/g, '""')}"`,
      d.chunk_count || 0,
      d.word_count || 0,
      d.status,
      d.created_at || ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clario-documents-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelectAll = () => {
    if (selectedDocIds.length === filteredDocuments.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(filteredDocuments.map((d) => d.id));
    }
  };

  const toggleSelectDoc = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkCompare = () => {
    if (selectedDocIds.length === 2) {
      window.location.href = `/compare?doc_a=${selectedDocIds[0]}&doc_b=${selectedDocIds[1]}`;
    } else if (selectedDocIds.length >= 3) {
      window.location.href = `/compare?mode=multi&docs=${selectedDocIds.join(',')}`;
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

  const filteredDocuments = documents.filter((doc) => {
    if (search && !`${doc.title} ${doc.filename}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && doc.status !== statusFilter) return false;
    if (collectionFilter && doc.collection !== collectionFilter) return false;
    if (smartPreset === 'policies' && !`${doc.title} ${doc.filename}`.toLowerCase().includes('policy')) return false;
    if (smartPreset === 'long' && (doc.page_count || 0) < 20) return false;
    if (smartPreset === 'short' && (doc.page_count || 0) >= 20) return false;
    return true;
  });

  const isFiltering = Boolean(search || statusFilter || collectionFilter || smartPreset !== 'all');

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setCollectionFilter('');
    setSmartPreset('all');
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
              disabled={deleting}
              onClick={handleOpenClearAll}
              className="text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Clear All
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={syncing}
            onClick={handleSyncFolder}
            className="shadow-2xs text-slate-700 hover:text-slate-900 border-slate-200"
            title="Scan the documents/ folder in project root for files"
          >
            <FolderSync className="w-3.5 h-3.5 mr-1.5" />
            {syncing ? 'Syncing…' : 'Sync Folder'}
          </Button>
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

      {/* Metric Summary Cards */}
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
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-700" />
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

            {/* Density Switcher */}
            <button
              onClick={toggleDensity}
              className={`px-2.5 py-1.5 rounded-md border text-xs transition-colors flex items-center gap-1.5 shrink-0 ${
                density === 'compact'
                  ? 'bg-slate-100 text-slate-900 border-slate-300 font-semibold'
                  : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
              }`}
              title={density === 'compact' ? 'Switch to Comfortable density' : 'Switch to Compact density'}
              aria-label="Table density"
            >
              <Rows3 className="w-3.5 h-3.5" />
              <span className="capitalize hidden sm:inline">{density}</span>
            </button>

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

        {/* Smart Presets Filter Row */}
        <div className="flex items-center gap-1.5 pt-2.5 flex-wrap text-xs">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3 text-slate-600" />
            <span>Smart Filters:</span>
          </span>
          <button
            type="button"
            onClick={() => setSmartPreset('all')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              smartPreset === 'all'
                ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            All Files ({documents.length})
          </button>
          <button
            type="button"
            onClick={() => setSmartPreset('policies')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              smartPreset === 'policies'
                ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Enterprise Policies
          </button>
          <button
            type="button"
            onClick={() => setSmartPreset('long')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              smartPreset === 'long'
                ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Comprehensive Agreements (&ge;20 Pages)
          </button>
          <button
            type="button"
            onClick={() => setSmartPreset('short')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              smartPreset === 'short'
                ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Schedules & Addenda (&lt;20 Pages)
          </button>
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
              : 'Upload your first contract or policy document, or place files into the documents/ folder and click Sync Folder.'}
          </p>
          {isFiltering ? (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Reset Filters
            </Button>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Button variant="primary" size="sm" onClick={() => setShowUploadZone(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                Upload First Document
              </Button>
              <Button variant="outline" size="sm" disabled={syncing} onClick={handleSyncFolder}>
                <FolderSync className="w-3.5 h-3.5 mr-1.5" />
                {syncing ? 'Syncing…' : 'Sync Folder'}
              </Button>
            </div>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* High-Density Table View (Matching / OverviewPage table design) */
        <Card className="rounded-md p-0 overflow-hidden bg-white border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                  <th className={`${density === 'compact' ? 'py-2 px-3' : 'py-3 px-3'} w-8`}>
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-slate-700 flex items-center transition-colors"
                      title={selectedDocIds.length === filteredDocuments.length ? 'Deselect all' : 'Select all'}
                      aria-label="Toggle select all documents"
                    >
                      {filteredDocuments.length > 0 && selectedDocIds.length === filteredDocuments.length ? (
                        <CheckSquare className="w-4 h-4 text-clario-navy" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                    </button>
                  </th>
                  <th className={density === 'compact' ? 'py-2 px-3' : 'py-3 px-4'}>Document</th>
                  <th className={density === 'compact' ? 'py-2 px-2.5' : 'py-3 px-3'}>Format</th>
                  <th className={density === 'compact' ? 'py-2 px-2.5' : 'py-3 px-3'}>Collection</th>
                  <th className={density === 'compact' ? 'py-2 px-2.5' : 'py-3 px-3'}>Passages</th>
                  <th className={density === 'compact' ? 'py-2 px-2.5' : 'py-3 px-3'}>Word Count</th>
                  <th className={density === 'compact' ? 'py-2 px-2.5' : 'py-3 px-3'}>Status</th>
                  <th className={`${density === 'compact' ? 'py-2 px-3' : 'py-3 px-4'} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocuments.map((doc) => {
                  const isSelected = selectedDocIds.includes(doc.id);
                  return (
                    <tr
                      key={doc.id}
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`cursor-pointer transition-colors group ${
                        isSelected ? 'bg-clario-navy/5 hover:bg-clario-navy/10' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td
                        className={`${density === 'compact' ? 'py-1.5 px-3' : 'py-3 px-3'} w-8`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => toggleSelectDoc(doc.id, e)}
                          className="text-slate-400 hover:text-slate-700 flex items-center transition-colors"
                          aria-label={`Select ${doc.title}`}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-clario-navy" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />
                          )}
                        </button>
                      </td>
                      <td className={density === 'compact' ? 'py-1.5 px-3' : 'py-3 px-4'}>
                        <div className="flex items-center space-x-3">
                          <div className="p-2 rounded-md bg-clario-navy/5 text-clario-navy shrink-0 group-hover:bg-clario-navy/10 transition-colors">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 group-hover:text-clario-navy transition-colors truncate max-w-md">
                              {doc.title.replace(/_/g, ' ')}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono truncate max-w-xs">
                              {doc.filename}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className={density === 'compact' ? 'py-1.5 px-2.5' : 'py-3 px-3'}>
                        <Badge variant="navy" size="sm">
                          {doc.file_type.toUpperCase()}
                        </Badge>
                      </td>
                      <td className={density === 'compact' ? 'py-1.5 px-2.5' : 'py-3 px-3'}>
                        {doc.collection ? (
                          <Badge variant="gray" size="sm">
                            {doc.collection}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                      <td className={`${density === 'compact' ? 'py-1.5 px-2.5' : 'py-3 px-3'} font-mono font-bold text-slate-900`}>
                        {doc.chunk_count} chunks
                      </td>
                      <td className={`${density === 'compact' ? 'py-1.5 px-2.5' : 'py-3 px-3'} text-slate-600 font-mono`}>
                        {doc.word_count?.toLocaleString() ?? 0} words
                      </td>
                      <td className={density === 'compact' ? 'py-1.5 px-2.5' : 'py-3 px-3'}>
                        <Badge variant={doc.status === 'READY' ? 'sage' : doc.status === 'ERROR' ? 'red' : 'gold'} size="sm">
                          {doc.status}
                        </Badge>
                      </td>
                      <td className={`${density === 'compact' ? 'py-1.5 px-3' : 'py-3 px-4'} text-right`} onClick={(e) => e.stopPropagation()}>
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
                            title="Inspect passages in side drawer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleOpenDeleteSingle(doc.id, doc.title, e)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* Modernized Card Grid View (Refined typography & clean metric strips) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => {
            const isSelected = selectedDocIds.includes(doc.id);
            return (
              <Card
                key={doc.id}
                hoverEffect
                onClick={() => setSelectedDocId(doc.id)}
                className={`flex flex-col justify-between p-5 border bg-white shadow-subtle group transition-all cursor-pointer ${
                  isSelected ? 'border-clario-navy ring-1 ring-clario-navy/30' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Card Header: Checkbox, Type Badge, Collection, Status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => toggleSelectDoc(doc.id, e)}
                        className="p-1 -ml-1 text-slate-400 hover:text-slate-700 transition-colors"
                        title={isSelected ? 'Deselect document' : 'Select document'}
                        aria-label={`Select ${doc.title}`}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-clario-navy" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />
                        )}
                      </button>
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
                    {doc.title.replace(/_/g, ' ')}
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
                      title="Inspect passages in side drawer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleOpenDeleteSingle(doc.id, doc.title, e)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Floating Bottom Bulk Action Toolbar */}
      {selectedDocIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-md shadow-2xl px-4 py-2.5 flex items-center gap-3 border border-slate-700 animate-in slide-in-from-bottom-4 text-xs font-sans">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
            <span className="font-medium text-slate-200">
              {selectedDocIds.length === 1 ? '1 document selected' : `${selectedDocIds.length} documents selected`}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportJSON}
              className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors flex items-center gap-1.5 font-medium"
              title="Export selected metadata as JSON"
            >
              <FileCode className="w-3.5 h-3.5 text-slate-300" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors flex items-center gap-1.5 font-medium"
              title="Export selected rows as CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-300" />
              <span>Export CSV</span>
            </button>
            {selectedDocIds.length >= 2 && (
              <button
                onClick={handleBulkCompare}
                className="px-2.5 py-1.5 rounded-md bg-clario-navy hover:bg-slate-800 text-white transition-colors flex items-center gap-1.5 font-semibold border border-slate-600"
                title={
                  selectedDocIds.length === 2
                    ? 'Compare the 2 selected documents side by side'
                    : `Compare ${selectedDocIds.length} selected documents in benchmark matrix`
                }
              >
                <GitCompare className="w-3.5 h-3.5 text-slate-200" />
                <span>
                  {selectedDocIds.length === 2
                    ? 'Compare Side-by-Side'
                    : `Compare Matrix (${selectedDocIds.length})`}
                </span>
              </button>
            )}
            <button
              onClick={() => setSelectedDocIds([])}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Split-Screen Document Source Drawer */}
      <DocumentDrawer
        summary={documents.find(doc => doc.id === selectedDocId)}
        documentId={selectedDocId}
        onClose={() => setSelectedDocId(null)}
        onExpandToModal={() => {
          setModalDocId(selectedDocId);
          setSelectedDocId(null);
        }}
      />

      {/* Full-Screen Document Inspector Modal */}
      <DocumentViewerModal
        documentId={modalDocId}
        onClose={() => setModalDocId(null)}
      />

      {/* Website-Style Delete / Clear Options Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title={deleteTarget?.type === 'all' ? 'Clear Document Workspace' : `Remove "${deleteTarget?.docTitle}"`}
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            {deleteTarget?.type === 'all'
              ? 'Choose how you would like to clear documents from your workspace.'
              : `Choose how you would like to delete or unindex "${deleteTarget?.docTitle}".`}
          </p>

          <div className="space-y-3 pt-1">
            {/* Option 1: Remove from Library Only */}
            <div className="rounded-md border border-slate-200 p-4 hover:border-slate-300 transition-colors bg-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h5 className="text-sm font-semibold text-slate-900">
                    Delete just from document library
                  </h5>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Removes indexed citations and metadata from Clario, but keeps the physical files safe in your <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">documents/</code> directory. You can re-import them anytime by clicking Sync Folder.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={deleting}
                  onClick={() => executeDelete(false)}
                  className="shrink-0 text-slate-700 hover:text-slate-900 border-slate-200"
                >
                  {deleting ? 'Removing…' : 'Remove from library'}
                </Button>
              </div>
            </div>

            {/* Option 2: Delete from Project Directory */}
            <div className="rounded-md border border-rose-200/80 bg-rose-50/40 p-4 hover:border-rose-300 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h5 className="text-sm font-semibold text-rose-900">
                    Delete from project directory
                  </h5>
                  <p className="text-xs text-rose-700/80 mt-1 leading-relaxed">
                    Permanently deletes the physical files from the <code className="bg-rose-100 px-1 py-0.5 rounded text-rose-800">documents/</code> folder on disk and wipes all database indices. This action cannot be undone.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={deleting}
                  onClick={() => executeDelete(true)}
                  className="shrink-0 bg-rose-600 hover:bg-rose-700 text-white border-transparent"
                >
                  {deleting ? 'Deleting…' : 'Delete from disk'}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
