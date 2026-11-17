import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Files,
  FileCheck2,
  Layers,
  Clock,
  SearchCheck,
  AlertTriangle,
  ArrowUpRight,
  Upload,
  MessageSquareQuote,
  GitCompare,
  FlaskConical,
  Eye,
  Trash2,
  FileText,
  ShieldCheck,
  Bot
} from 'lucide-react';
import { api } from '../services/api';
import { DashboardStats, DocumentItem } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { FileUploadZone } from '../components/documents/FileUploadZone';
import { DocumentViewerModal } from '../components/documents/DocumentViewerModal';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getDashboard();
      setStats(data);
    } catch (err) {
      setError('Could not load workspace metrics. Check the API connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleDelete = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this document from the corpus?')) {
      try {
        await api.deleteDocument(docId);
        fetchDashboardData();
      } catch (err) {
        setError('Could not delete the document. Please try again.');
      }
    }
  };

  return (
    <div className="space-y-7">
      <section className="border-b border-clario-border pb-7">
        <p className="text-xs font-semibold tracking-widest uppercase text-clario-teal mb-3">Document review workspace</p>
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-clario-navy">Understand your documents.<br />Support every decision.</h2>
        <p className="text-sm text-clario-text-secondary leading-relaxed max-w-2xl mt-4">Bring contracts, policies, and research into one place. Find cited answers, compare versions, and turn evidence into reviewable findings.</p>
        <div className="flex flex-wrap gap-3 mt-6">
          <Button onClick={() => navigate('/documents')}><Upload className="w-4 h-4" />Manage documents</Button>
          <Button variant="outline" onClick={() => navigate('/ask')}><MessageSquareQuote className="w-4 h-4" />Ask a question</Button>
          <Button variant="outline" onClick={() => navigate('/compare')}><GitCompare className="w-4 h-4" />Compare versions</Button>
        </div>
      </section>
      {error && <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error} <button className="underline ml-2" onClick={fetchDashboardData}>Retry</button></div>}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card className="p-4 flex flex-col justify-between hover:border-clario-teal/40 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Total Documents</span>
            <div className="p-1.5 rounded-md bg-clario-teal/10 text-clario-teal">
              <Files className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-clario-navy">{loading ? '…' : stats?.total_documents ?? '—'}</span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Uploaded & stored</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-emerald-300 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-emerald-800 mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Indexed Ready</span>
            <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
              <FileCheck2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-emerald-700">{loading ? '…' : stats?.indexed_documents ?? '—'}</span>
          <span className="text-[10px] text-emerald-600 font-semibold mt-1">Available for review</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-teal/40 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Searchable Passages</span>
            <div className="p-1.5 rounded-md bg-clario-teal/10 text-clario-teal">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-clario-navy">{loading ? '…' : stats?.total_searchable_passages ?? '—'}</span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Dense vector chunks</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-gold/50 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Analyses Run</span>
            <div className="p-1.5 rounded-md bg-clario-gold/15 text-clario-gold">
              <SearchCheck className="w-3.5 h-3.5 text-clario-gold-dark" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-clario-navy">{loading ? '…' : stats?.recent_analyses_count ?? '—'}</span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Searches & diffs</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between border-amber-200 bg-amber-50/20 shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-amber-800 mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Conflicts Flagged</span>
            <div className="p-1.5 rounded-md bg-amber-100 text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-amber-700">{loading ? '…' : stats?.potential_conflicts_count ?? '—'}</span>
          <span className="text-[10px] text-amber-700 font-semibold mt-1">Candidate differences</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-teal/40 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Avg Latency</span>
            <div className="p-1.5 rounded-md bg-clario-teal/10 text-clario-teal">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-clario-navy font-mono">
            {stats?.average_latency_ms != null ? `${stats.average_latency_ms}ms` : '—'}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Hybrid retrieval</span>
        </Card>
      </div>

      {/* Ingestion & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="h-full rounded-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-[#14263D] tracking-tight">Upload documents</h3>
                <p className="text-xs text-[#748293] mt-0.5">Add a document to start asking questions and comparing evidence.</p>
              </div>
            </div>
            <FileUploadZone onUploadSuccess={fetchDashboardData} compact />
          </Card>
        </div>

        <div>
          <Card className="h-full flex flex-col justify-between rounded-md p-6">
            <div>
              <h3 className="font-bold text-sm text-[#14263D] tracking-tight mb-1">Continue your review</h3>
              <p className="text-xs text-[#748293] mb-4">Choose the next step for your documents.</p>

              <div className="space-y-3">
                <button
                  onClick={() => navigate('/ask')}
                  className="w-full flex items-center justify-between p-3.5 rounded-md border border-[#E4E8E6] bg-[#FCFBF8] hover:bg-[#F8F7F3] hover:border-[#477E88]/50 transition-all text-left group shadow-xs"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-[#477E88]/10 text-[#477E88] group-hover:scale-105 transition-transform">
                      <MessageSquareQuote className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#14263D]">Ask Clario</p>
                      <p className="text-[11px] text-[#748293]">Evidence-backed Q&A</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#96A3B2] group-hover:text-[#477E88] transition-colors" />
                </button>

                <button
                  onClick={() => navigate('/compare')}
                  className="w-full flex items-center justify-between p-3.5 rounded-md border border-[#E4E8E6] bg-[#FCFBF8] hover:bg-[#F8F7F3] hover:border-[#477E88]/50 transition-all text-left group shadow-xs"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-[#D4AE72]/20 text-[#A9844B] group-hover:scale-105 transition-transform">
                      <GitCompare className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#14263D]">Compare Versions</p>
                      <p className="text-[11px] text-[#748293]">Side-by-side diff & contradictions</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#96A3B2] group-hover:text-[#477E88] transition-colors" />
                </button>

                <button
                  onClick={() => navigate('/search-lab')}
                  className="w-full flex items-center justify-between p-3.5 rounded-md border border-[#E4E8E6] bg-[#FCFBF8] hover:bg-[#F8F7F3] hover:border-[#477E88]/50 transition-all text-left group shadow-xs"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-[#A9D5C3]/30 text-[#14263D] group-hover:scale-105 transition-transform">
                      <FlaskConical className="w-4 h-4 text-[#477E88]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#14263D]">Search Lab</p>
                      <p className="text-[11px] text-[#748293]">BM25 vs Vector vs Hybrid</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#96A3B2] group-hover:text-[#477E88] transition-colors" />
                </button>
              </div>
            </div>

          </Card>
        </div>
      </div>

      {/* Recent Documents Table */}
      <Card className="rounded-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-sm text-clario-navy tracking-tight">Recent documents</h3>
            <p className="text-xs text-clario-text-secondary mt-0.5">Open a document to inspect its text and source passages.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/documents')}>
            View All Documents
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-clario-border text-clario-text-secondary font-semibold text-[11px] uppercase tracking-wider">
                <th className="pb-3 px-3">Document Name</th>
                <th className="pb-3 px-3">Format</th>
                <th className="pb-3 px-3">Collection</th>
                <th className="pb-3 px-3">Passages</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-clario-border/60">
              {!loading && !error && !stats?.recent_documents?.length && <tr><td colSpan={6} className="p-8 text-center text-clario-text-secondary">No documents yet. Upload a file to begin your review.</td></tr>}
              {stats?.recent_documents?.map((doc: DocumentItem) => (
                <tr
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className="hover:bg-clario-ivory cursor-pointer transition-colors group"
                >
                  <td className="py-3 px-3 font-semibold text-clario-navy flex items-center space-x-2.5">
                    <div className="p-1.5 rounded-md bg-clario-teal/10 text-clario-teal">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate max-w-sm">{doc.title}</span>
                  </td>
                  <td className="py-3 px-3">
                    <Badge variant="navy" size="sm">
                      {doc.file_type.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-clario-text-secondary font-medium">
                    {doc.collection}
                  </td>
                  <td className="py-3 px-3 font-mono text-clario-teal font-bold">
                    {doc.chunk_count} chunks
                  </td>
                  <td className="py-3 px-3">
                    <Badge variant={doc.status === 'READY' ? 'sage' : 'gold'} size="sm">
                      {doc.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedDocId(doc.id)}
                      className="p-1.5 rounded-md text-clario-text-secondary hover:text-clario-teal hover:bg-white transition-colors"
                      title="Inspect chunks"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(doc.id, e)}
                      className="p-1.5 rounded-md text-clario-text-secondary hover:text-rose-600 hover:bg-white transition-colors"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        documentId={selectedDocId}
        onClose={() => setSelectedDocId(null)}
      />
    </div>
  );
};
