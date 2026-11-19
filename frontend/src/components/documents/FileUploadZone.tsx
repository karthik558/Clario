import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../ui/Button';

interface FileUploadZoneProps {
  onUploadSuccess: (complete: boolean) => void;
  compact?: boolean;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({ onUploadSuccess, compact = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<{ file: File; title: string }[]>([]);
  const [progress, setProgress] = useState('');
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
    selectFiles(e.dataTransfer.files);
  };

  const selectFiles = (selection: FileList) => {
    if (!selection.length) return;
    const accepted = [];
    const errors = [];
    for (const file of Array.from(selection)) {
      if (!/\.(pdf|docx?|txt|md|xlsx?|csv|json)$/i.test(file.name)) {
        errors.push(`${file.name}: unsupported file format.`);
      } else if (file.size > 50 * 1024 * 1024 || file.size === 0) {
        errors.push(`${file.name}: files must be nonempty and 50 MB or smaller.`);
      } else {
        accepted.push({ file, title: file.name.replace(/\.[^/.]+$/, '') });
      }
    }
    setFiles(accepted);
    setError(errors.join('\n') || null);
    setSuccessMsg(null);
  };

  const handleUpload = async () => {
    if (!files.length || uploading) return;
    setUploading(true);
    setSuccessMsg(null);
    const failed = [];
    const errors = [];
    const tags = tagsInput.split(',').map(tag => tag.trim()).filter(Boolean);
    for (const [index, item] of files.entries()) {
      setProgress(`Uploading ${index + 1} of ${files.length}…`);
      try {
        await api.uploadDocument(item.file, item.title, tags, collection);
      } catch (err) {
        failed.push(item);
        errors.push(`${item.file.name}: ${err instanceof Error ? err.message : 'Upload failed'}`);
      }
    }
    setFiles(failed);
    setError(errors.join('\n') || null);
    setUploading(false);
    const count = files.length - failed.length;
    if (!failed.length) setTagsInput('');
    if (count) {
      setSuccessMsg(`${count} document${count === 1 ? '' : 's'} uploaded.`);
      onUploadSuccess(failed.length === 0);
    }
  };

  return (
    <div className="w-full">
      {!files.length ? (
        <div
          role="button" tabIndex={0} aria-label="Choose documents to upload"
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
            type="file" multiple
            ref={fileInputRef}
            className="hidden"
            accept=".pdf,.docx,.doc,.txt,.md,.xlsx,.xls,.csv,.json"
            onChange={(e) => {
              if (e.target.files) selectFiles(e.target.files);
              e.target.value = "";
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
          <ul className="mb-4 divide-y divide-slate-200">
            {files.map((item, index) => (
              <li key={index} className="flex items-start gap-3 py-3">
                <FileText className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
                <label className="min-w-0 flex-1 text-xs text-slate-600">
                  <span className="block break-all font-semibold">{item.file.name}</span>
                  Document title
                  <input disabled={uploading} value={item.title}
                    onChange={e => setFiles(files.map((row, i) => i === index ? { ...row, title: e.target.value } : row))}
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900" />
                </label>
                <button aria-label={`Remove ${item.file.name}`} disabled={uploading}
                  onClick={() => setFiles(files.filter((_, i) => i !== index))} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors">
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Collection
              </label>
              <input
                type="text"
                disabled={uploading} aria-label="Collection" value={collection}
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
                disabled={uploading} aria-label="Tags" value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="compliance, 2024, audit"
                className="w-full text-xs px-3 py-2 rounded-md border border-slate-200 bg-white focus:outline-none focus:border-slate-900 text-slate-900"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2">
            <Button variant="outline" size="sm" onClick={() => { setFiles([]); setError(null); setSuccessMsg(null); }} disabled={uploading}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleUpload} loading={uploading}>
              {uploading ? progress : files.length === 1 ? 'Upload & Ingest' : `Upload ${files.length} documents`}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span role="alert" className="whitespace-pre-line break-all">{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mt-3 p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span role="status">{successMsg}</span>
        </div>
      )}
    </div>
  );
};
