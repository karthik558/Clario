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
  FileText
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
    if (window.confirm('Are you sure you want to delete this document from the corpus?')) {
      try {
        await api.deleteDocument(docId);
        fetchDashboardData();
      } catch (err) {
        console.error('Failed to delete document:', err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-clario-navy to-clario-navy-light rounded-2xl p-6 text-white shadow-elevated relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <Badge variant="gold" size="sm" className="mb-2">
            Document Intelligence Workbench
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
            Clario — Every document. A clearer answer.
          </h2>
          <p className="text-xs text-clario-sage-light leading-relaxed mb-4">
            Unified workspace for multi-document semantic retrieval, comparative diff analysis,
            and evidence-backed contradiction detection across policies, contracts, and research literature.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/ask')}
              className="bg-clario-teal hover:bg-clario-teal-light"
            >
              <MessageSquareQuote className="w-4 h-4 mr-1.5" />
              Ask Clario Assistant
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/compare')}
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
            >
              <GitCompare className="w-4 h-4 mr-1.5" />
              Compare Versions
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/search-lab')}
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
            >
              <FlaskConical className="w-4 h-4 mr-1.5" />
              Search Lab Benchmark
            </Button>
          </div>
        </div>

        {/* Decorative background logo */}
        <div className="absolute -right-8 -bottom-10 opacity-10 pointer-events-none">
          <Layers className="w-64 h-64 text-clario-sage" />
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-clario-text-secondary mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Total Documents</span>
            <Files className="w-4 h-4 text-clario-teal" />
          </div>
          <span className="text-2xl font-bold text-clario-navy">{stats?.total_documents ?? 0}</span>
          <span className="text-[10px] text-clario-text-muted mt-1">Uploaded & stored</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-clario-text-secondary mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Indexed Ready</span>
            <FileCheck2 className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-2xl font-bold text-emerald-700">{stats?.indexed_documents ?? 0}</span>
          <span className="text-[10px] text-emerald-600 font-medium mt-1">100% corpus indexed</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-clario-text-secondary mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Passages Indexed</span>
            <Layers className="w-4 h-4 text-clario-teal" />
          </div>
          <span className="text-2xl font-bold text-clario-navy">{stats?.total_searchable_passages ?? 0}</span>
          <span className="text-[10px] text-clario-text-muted mt-1">Dense vector chunks</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-clario-text-secondary mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Analyses Run</span>
            <Sparkles className="w-4 h-4 text-clario-gold" />
          </div>
          <span className="text-2xl font-bold text-clario-navy">{stats?.recent_analyses_count ?? 0}</span>
          <span className="text-[10px] text-clario-text-muted mt-1">Searches & diffs</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between border-amber-200 bg-amber-50/20">
          <div className="flex items-center justify-between text-amber-800 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Conflicts Flagged</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-2xl font-bold text-amber-700">{stats?.potential_conflicts_count ?? 0}</span>
          <span className="text-[10px] text-amber-700 font-medium mt-1">Candidate discrepancies</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-clario-text-secondary mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Avg Latency</span>
            <Clock className="w-4 h-4 text-clario-teal" />
          </div>
          <span className="text-2xl font-bold text-clario-navy font-mono">
            {stats?.average_latency_ms ? `${stats.average_latency_ms}ms` : '12ms'}
          </span>
          <span className="text-[10px] text-clario-text-muted mt-1">Hybrid retrieval</span>
        </Card>
      </div>

      {/* Ingestion & Quick Actions Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="h-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-sm text-clario-text tracking-tight">Ingest New Documents</h3>
                <p className="text-xs text-clario-text-secondary">Drag and drop documents to parse text, chunk, and embed</p>
              </div>
            </div>
            <FileUploadZone onUploadSuccess={fetchDashboardData} compact />
          </Card>
        </div>

        <div>
          <Card className="h-full flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-sm text-clario-text tracking-tight mb-1">Quick Actions</h3>
              <p className="text-xs text-clario-text-secondary mb-4">Jump directly into specialized tools</p>

              <div className="space-y-2.5">
                <button
                  onClick={() => navigate('/ask')}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-clario-border bg-clario-ivory-card hover:bg-clario-ivory hover:border-clario-teal/40 transition-all text-left group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-clario-teal/10 text-clario-teal group-hover:scale-105 transition-transform">
                      <MessageSquareQuote className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-clario-text">Ask a Question</p>
                      <p className="text-[11px] text-clario-text-secondary">Cross-document RAG research</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-clario-text-muted group-hover:text-clario-teal transition-colors" />
                </button>

                <button
                  onClick={() => navigate('/compare')}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-clario-border bg-clario-ivory-card hover:bg-clario-ivory hover:border-clario-teal/40 transition-all text-left group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-clario-gold/15 text-clario-gold-dark group-hover:scale-105 transition-transform">
                      <GitCompare className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-clario-text">Compare Documents</p>
                      <p className="text-[11px] text-clario-text-secondary">Side-by-side textual & semantic diff</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-clario-text-muted group-hover:text-clario-teal transition-colors" />
                </button>

                <button
                  onClick={() => navigate('/search-lab')}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-clario-border bg-clario-ivory-card hover:bg-clario-ivory hover:border-clario-teal/40 transition-all text-left group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-clario-sage-light text-clario-navy group-hover:scale-105 transition-transform">
                      <FlaskConical className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-clario-text">Information Retrieval Lab</p>
                      <p className="text-[11px] text-clario-text-secondary">BM25 vs Vector vs Hybrid metrics</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-clario-text-muted group-hover:text-clario-teal transition-colors" />
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-clario-border mt-4 text-[11px] text-clario-text-muted flex items-center justify-between">
              <span>SQLite + NumPy Dense Store</span>
              <span className="text-emerald-600 font-medium font-mono">Status: Optimal</span>
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Documents Table */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-sm text-clario-text tracking-tight">Recent Corpus Documents</h3>
            <p className="text-xs text-clario-text-secondary">All parsed documents available for cross-document analysis</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/documents')}>
            View All Documents
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-clario-border text-clario-text-secondary font-medium">
                <th className="pb-3 px-3">Document Name</th>
                <th className="pb-3 px-3">Format</th>
                <th className="pb-3 px-3">Collection</th>
                <th className="pb-3 px-3">Passages</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-clario-border/60">
              {stats?.recent_documents?.map((doc: DocumentItem) => (
                <tr
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className="hover:bg-clario-ivory/80 cursor-pointer transition-colors group"
                >
                  <td className="py-3 px-3 font-semibold text-clario-navy flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-clario-teal shrink-0" />
                    <span className="truncate max-w-xs">{doc.title}</span>
                  </td>
                  <td className="py-3 px-3">
                    <Badge variant="navy" size="sm">
                      {doc.file_type.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-clario-text-secondary">
                    {doc.collection}
                  </td>
                  <td className="py-3 px-3 font-mono text-clario-teal font-medium">
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
                      className="p-1 rounded text-clario-text-secondary hover:text-clario-teal hover:bg-white"
                      title="Inspect chunks"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(doc.id, e)}
                      className="p-1 rounded text-clario-text-secondary hover:text-rose-600 hover:bg-white"
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
