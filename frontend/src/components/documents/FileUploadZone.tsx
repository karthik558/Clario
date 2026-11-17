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
    const validExts = ['pdf', 'docx', 'doc', 'txt', 'md'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!validExts.includes(ext)) {
      setError(`Unsupported format ".${ext}". Please upload PDF, DOCX, TXT, or MD documents.`);
      return;
    }
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
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl transition-all cursor-pointer text-center ${
            compact ? 'p-6' : 'p-8'
          } ${
            isDragging
              ? 'border-clario-teal bg-clario-sage-light/20 scale-[1.01]'
              : 'border-clario-border hover:border-clario-teal/50 hover:bg-clario-ivory-card'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf,.docx,.doc,.txt,.md"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileSelected(e.target.files[0]);
              }
            }}
          />
          <div className="w-12 h-12 rounded-xl bg-clario-teal/10 text-clario-teal flex items-center justify-center mx-auto mb-3 shadow-xs">
            <UploadCloud className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-clario-text tracking-tight mb-1">
            Drag & drop documents here, or <span className="text-clario-teal underline">browse</span>
          </h4>
          <p className="text-xs text-clario-text-secondary">
            Supported formats: PDF, DOCX, TXT, Markdown (Max 50MB per file)
          </p>
          <div className="mt-3 flex items-center justify-center space-x-2 text-[11px] text-clario-text-muted">
            <span className="px-2 py-0.5 rounded bg-clario-ivory border border-clario-border">PDF Extraction</span>
            <span className="px-2 py-0.5 rounded bg-clario-ivory border border-clario-border">Vector Chunking</span>
            <span className="px-2 py-0.5 rounded bg-clario-ivory border border-clario-border">Automatic Provenance</span>
          </div>
        </div>
      ) : (
        <div className="border border-clario-teal/40 rounded-2xl p-5 bg-clario-ivory-card shadow-subtle animate-in fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-clario-border mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-clario-teal/15 text-clario-teal flex items-center justify-center">
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
                className="w-full text-xs px-3 py-2 rounded-lg border border-clario-border bg-white focus:outline-none focus:border-clario-teal"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-clario-text-secondary mb-1">
                Collection
              </label>
              <input
                type="text"
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                placeholder="e.g. Policies, Contracts"
                className="w-full text-xs px-3 py-2 rounded-lg border border-clario-border bg-white focus:outline-none focus:border-clario-teal"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-clario-text-secondary mb-1">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="compliance, 2024, audit"
                className="w-full text-xs px-3 py-2 rounded-lg border border-clario-border bg-white focus:outline-none focus:border-clario-teal"
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
        <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
    </div>
  );
};
