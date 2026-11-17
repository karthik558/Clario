import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../ui/Button';

interface FileUploadZoneProps {
  onUploadSuccess: () => void;
  compact?: boolean;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({ onUploadSuccess, compact = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [collection, setCollection] = useState('General');
  const [tagsInput, setTagsInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    setError(null);
    setSuccessMsg(null);
    const validExts = ['pdf', 'docx', 'doc', 'txt', 'md', 'xlsx', 'xls', 'csv', 'json'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!validExts.includes(ext)) {
      setError(`Unsupported format ".${ext}". Please upload PDF, DOCX, TXT, MD, Excel (.xlsx, .xls), or CSV documents.`);
      return;
    }
    if (file.size > 50 * 1024 * 1024) { setError('Files must be 50 MB or smaller.'); return; }
    if (file.size === 0) {
      setError('The selected file is empty (0 bytes).');
      return;
    }
    setSelectedFile(file);
    setTitle(file.name.replace(/\.[^/.]+$/, ''));
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);
    try {
      const tags = tagsInput
        ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
        : [];
      await api.uploadDocument(selectedFile, title, tags, collection);
      setSuccessMsg(`"${selectedFile.name}" successfully indexed into Clario.`);
      setSelectedFile(null);
      setTitle('');
      setTagsInput('');
      onUploadSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to process document');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full">
      {!selectedFile ? (
        <div
          role="button" tabIndex={0} aria-label="Choose a document to upload"
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={e => { if (e.target !== fileInputRef.current) fileInputRef.current?.click(); }}
          className={`border-2 border-dashed rounded-md transition-all cursor-pointer text-center ${
            compact ? 'p-6' : 'p-8'
          } ${
            isDragging
              ? 'border-slate-900 bg-slate-100 scale-[1.01]'
              : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf,.docx,.doc,.txt,.md,.xlsx,.xls,.csv,.json"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileSelected(e.target.files[0]);
              }
            }}
          />
          <div className="w-12 h-12 rounded-md bg-slate-100 text-slate-800 flex items-center justify-center mx-auto mb-3 shadow-xs">
            <UploadCloud className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-900 tracking-tight mb-1">
            Drag & drop documents here, or <span className="text-slate-900 underline font-medium">browse</span>
          </h4>
          <p className="text-xs text-slate-500">
            Supported formats: PDF, DOCX, TXT, Markdown, Excel (.xlsx, .xls), CSV (Max 50MB per file)
          </p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-md p-5 bg-white shadow-subtle animate-in fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-clario-border mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-md bg-clario-navy/10 text-clario-navy flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-clario-text truncate max-w-sm">{selectedFile.name}</p>
                <p className="text-[11px] text-clario-text-secondary">
                  {(selectedFile.size / 1024).toFixed(1)} KB &bull; Ready for indexing
                </p>
              </div>
            </div>
            <button
              aria-label="Remove selected file" disabled={uploading}
              onClick={() => setSelectedFile(null)}
              className="p-1 rounded-md text-clario-text-secondary hover:text-clario-text hover:bg-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-[11px] font-medium text-clario-text-secondary mb-1">
                Document Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-md border border-slate-200 bg-white focus:outline-none focus:border-slate-900 text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Collection
              </label>
              <input
                type="text"
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                placeholder="e.g. Policies, Contracts"
                className="w-full text-xs px-3 py-2 rounded-md border border-slate-200 bg-white focus:outline-none focus:border-slate-900 text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="compliance, 2024, audit"
                className="w-full text-xs px-3 py-2 rounded-md border border-slate-200 bg-white focus:outline-none focus:border-slate-900 text-slate-900"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedFile(null)} disabled={uploading}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleUpload} loading={uploading}>
              {uploading ? 'Extracting & Indexing...' : 'Upload & Ingest'}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mt-3 p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
    </div>
  );
};
