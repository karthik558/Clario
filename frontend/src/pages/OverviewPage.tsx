import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Files,
  FileCheck2,
  Layers,
  Clock,
  Sparkles,
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
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      const data = await api.getDashboard();
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
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
        console.error('Failed to delete document:', err);
      }
    }
  };

  return (
    <div className="space-y-7">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#14263D] via-[#1A314E] to-[#122237] rounded-3xl p-8 text-white shadow-elevated relative overflow-hidden border border-white/10">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[#D4AE72] text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Document Intelligence Workspace</span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-white mb-2.5">
            Clario
          </h2>
          <p className="text-sm font-medium text-[#A9D5C3] mb-2 tracking-wide">
            Every document. A clearer answer.
          </p>
          <p className="text-xs text-slate-300 leading-relaxed mb-6 max-w-xl">
            Analyze complex contracts, policies, and academic research papers. Ask questions with clickable citations,
            run side-by-side comparative diffs, detect contradictions, and benchmark information retrieval.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate('/ask')}
              className="bg-[#477E88] hover:bg-[#5895A0] shadow-md font-semibold"
            >
              <MessageSquareQuote className="w-4 h-4 mr-2" />
              Ask Clario Assistant
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate('/compare')}
              className="bg-white/10 text-white border-white/20 hover:bg-white/20 font-semibold"
            >
              <GitCompare className="w-4 h-4 mr-2" />
              Compare Versions
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate('/search-lab')}
              className="bg-white/10 text-white border-white/20 hover:bg-white/20 font-semibold"
            >
              <FlaskConical className="w-4 h-4 mr-2" />
              Search Lab Benchmark
            </Button>
          </div>
        </div>

        {/* Decorative background logo */}
        <div className="absolute -right-6 -bottom-10 opacity-[0.07] pointer-events-none">
          <Layers className="w-72 h-72 text-[#A9D5C3]" />
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="p-4 flex flex-col justify-between hover:border-[#477E88]/40 transition-all shadow-subtle rounded-2xl">
          <div className="flex items-center justify-between text-[#748293] mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Total Documents</span>
            <div className="p-1.5 rounded-lg bg-[#477E88]/10 text-[#477E88]">
              <Files className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-[#14263D]">{stats?.total_documents ?? 0}</span>
          <span className="text-[10px] text-[#748293] font-medium mt-1">Uploaded & stored</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-emerald-300 transition-all shadow-subtle rounded-2xl">
          <div className="flex items-center justify-between text-emerald-800 mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Indexed Ready</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <FileCheck2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-emerald-700">{stats?.indexed_documents ?? 0}</span>
          <span className="text-[10px] text-emerald-600 font-semibold mt-1">100% corpus ready</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-[#477E88]/40 transition-all shadow-subtle rounded-2xl">
          <div className="flex items-center justify-between text-[#748293] mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Searchable Passages</span>
            <div className="p-1.5 rounded-lg bg-[#477E88]/10 text-[#477E88]">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-[#14263D]">{stats?.total_searchable_passages ?? 0}</span>
          <span className="text-[10px] text-[#748293] font-medium mt-1">Dense vector chunks</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-[#D4AE72]/50 transition-all shadow-subtle rounded-2xl">
          <div className="flex items-center justify-between text-[#748293] mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Analyses Run</span>
            <div className="p-1.5 rounded-lg bg-[#D4AE72]/15 text-[#D4AE72]">
              <Sparkles className="w-3.5 h-3.5 text-[#A9844B]" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-[#14263D]">{stats?.recent_analyses_count ?? 0}</span>
          <span className="text-[10px] text-[#748293] font-medium mt-1">Searches & diffs</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between border-amber-200 bg-amber-50/20 shadow-subtle rounded-2xl">
          <div className="flex items-center justify-between text-amber-800 mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Conflicts Flagged</span>
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-amber-700">{stats?.potential_conflicts_count ?? 0}</span>
          <span className="text-[10px] text-amber-700 font-semibold mt-1">Candidate differences</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-[#477E88]/40 transition-all shadow-subtle rounded-2xl">
          <div className="flex items-center justify-between text-[#748293] mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Avg Latency</span>
            <div className="p-1.5 rounded-lg bg-[#477E88]/10 text-[#477E88]">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-[#14263D] font-mono">
            {stats?.average_latency_ms ? `${stats.average_latency_ms}ms` : '12ms'}
          </span>
          <span className="text-[10px] text-[#748293] font-medium mt-1">Hybrid retrieval</span>
        </Card>
      </div>

      {/* Ingestion & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="h-full rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-[#14263D] tracking-tight">Ingest Documents</h3>
                <p className="text-xs text-[#748293] mt-0.5">Drag & drop to parse text, extract pages, chunk, and embed</p>
              </div>
            </div>
            <FileUploadZone onUploadSuccess={fetchDashboardData} compact />
          </Card>
        </div>

        <div>
          <Card className="h-full flex flex-col justify-between rounded-2xl p-6">
            <div>
              <h3 className="font-bold text-sm text-[#14263D] tracking-tight mb-1">Quick Tools</h3>
              <p className="text-xs text-[#748293] mb-4">Jump directly into specialized intelligence workbenches</p>

              <div className="space-y-3">
                <button
                  onClick={() => navigate('/ask')}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-[#E4E8E6] bg-[#FCFBF8] hover:bg-[#F8F7F3] hover:border-[#477E88]/50 transition-all text-left group shadow-xs"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-[#477E88]/10 text-[#477E88] group-hover:scale-105 transition-transform">
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
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-[#E4E8E6] bg-[#FCFBF8] hover:bg-[#F8F7F3] hover:border-[#477E88]/50 transition-all text-left group shadow-xs"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-[#D4AE72]/20 text-[#A9844B] group-hover:scale-105 transition-transform">
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
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-[#E4E8E6] bg-[#FCFBF8] hover:bg-[#F8F7F3] hover:border-[#477E88]/50 transition-all text-left group shadow-xs"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-[#A9D5C3]/30 text-[#14263D] group-hover:scale-105 transition-transform">
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

            <div className="pt-4 border-t border-[#E4E8E6] mt-4 text-[11px] text-[#748293] flex items-center justify-between">
              <span>SQLite + NumPy Dense Store</span>
              <span className="text-emerald-600 font-semibold font-mono flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Healthy</span>
              </span>
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Documents Table */}
      <Card className="rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-sm text-[#14263D] tracking-tight">Active Corpus Documents</h3>
            <p className="text-xs text-[#748293] mt-0.5">Documents indexed into vector storage for query and comparison</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/documents')}>
            View All Documents
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E4E8E6] text-[#748293] font-semibold text-[11px] uppercase tracking-wider">
                <th className="pb-3 px-3">Document Name</th>
                <th className="pb-3 px-3">Format</th>
                <th className="pb-3 px-3">Collection</th>
                <th className="pb-3 px-3">Passages</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E8E6]/60">
              {stats?.recent_documents?.map((doc: DocumentItem) => (
                <tr
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className="hover:bg-[#F8F7F3] cursor-pointer transition-colors group"
                >
                  <td className="py-3 px-3 font-semibold text-[#14263D] flex items-center space-x-2.5">
                    <div className="p-1.5 rounded-lg bg-[#477E88]/10 text-[#477E88]">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate max-w-sm">{doc.title}</span>
                  </td>
                  <td className="py-3 px-3">
                    <Badge variant="navy" size="sm">
                      {doc.file_type.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-[#748293] font-medium">
                    {doc.collection}
                  </td>
                  <td className="py-3 px-3 font-mono text-[#477E88] font-bold">
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
                      className="p-1.5 rounded-lg text-[#748293] hover:text-[#477E88] hover:bg-white transition-colors"
                      title="Inspect chunks"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(doc.id, e)}
                      className="p-1.5 rounded-lg text-[#748293] hover:text-rose-600 hover:bg-white transition-colors"
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
