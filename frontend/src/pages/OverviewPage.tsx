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
  Bot,
  BarChart3,
  Network,
  Activity
} from 'lucide-react';
import { api } from '../services/api';
import { DashboardStats, DocumentItem, FindingItem } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { FileUploadZone } from '../components/documents/FileUploadZone';
import { DocumentViewerModal } from '../components/documents/DocumentViewerModal';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const [data, findingsData] = await Promise.all([
        api.getDashboard(),
        api.getFindings().catch(() => [])
      ]);
      setStats(data);
      setFindings(findingsData);
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
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-clario-border">
        <div>
          <h2 className="text-xl font-bold text-clario-navy tracking-tight">Overview</h2>
          <p className="text-xs text-clario-text-secondary">Workspace metrics, document status, and recent activity</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button size="sm" onClick={() => navigate('/documents')}>
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Upload
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/ask')}>
            <MessageSquareQuote className="w-3.5 h-3.5 mr-1.5" />
            Ask Clario
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/compare')}>
            <GitCompare className="w-3.5 h-3.5 mr-1.5" />
            Compare
          </Button>
        </div>
      </div>
      {error && <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error} <button className="underline ml-2" onClick={fetchDashboardData}>Retry</button></div>}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Total Documents</span>
            <div className="p-1.5 rounded bg-slate-100 text-slate-700">
              <Files className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-clario-navy">{loading ? '…' : stats?.total_documents ?? '—'}</span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Uploaded & stored</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Indexed Ready</span>
            <div className="p-1.5 rounded bg-slate-100 text-slate-700">
              <FileCheck2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-clario-navy">{loading ? '…' : stats?.indexed_documents ?? '—'}</span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Available for review</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Searchable Passages</span>
            <div className="p-1.5 rounded bg-slate-100 text-slate-700">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-clario-navy">{loading ? '…' : stats?.total_searchable_passages ?? '—'}</span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Dense vector chunks</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Analyses Run</span>
            <div className="p-1.5 rounded bg-slate-100 text-slate-700">
              <SearchCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-clario-navy">{loading ? '…' : stats?.recent_analyses_count ?? '—'}</span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Searches & diffs</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Conflicts Flagged</span>
            <div className="p-1.5 rounded bg-slate-100 text-slate-700">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-clario-navy">{loading ? '…' : stats?.potential_conflicts_count ?? '—'}</span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Candidate differences</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Avg Latency</span>
            <div className="p-1.5 rounded bg-slate-100 text-slate-700">
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
                  className="w-full flex items-center justify-between p-3.5 rounded-md border border-[#E4E8E6] bg-[#FCFBF8] hover:bg-[#F8F7F3] hover:border-slate-300 transition-all text-left group shadow-xs"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded bg-slate-100 text-slate-700 group-hover:bg-slate-200 transition-colors">
                      <MessageSquareQuote className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#14263D]">Ask Clario</p>
                      <p className="text-[11px] text-[#748293]">Evidence-backed Q&A</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#14263D] transition-colors" />
                </button>

                <button
                  onClick={() => navigate('/compare')}
                  className="w-full flex items-center justify-between p-3.5 rounded-md border border-[#E4E8E6] bg-[#FCFBF8] hover:bg-[#F8F7F3] hover:border-slate-300 transition-all text-left group shadow-xs"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded bg-slate-100 text-slate-700 group-hover:bg-slate-200 transition-colors">
                      <GitCompare className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#14263D]">Compare Versions</p>
                      <p className="text-[11px] text-[#748293]">Side-by-side diff & contradictions</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#14263D] transition-colors" />
                </button>

                <button
                  onClick={() => navigate('/search-lab')}
                  className="w-full flex items-center justify-between p-3.5 rounded-md border border-[#E4E8E6] bg-[#FCFBF8] hover:bg-[#F8F7F3] hover:border-slate-300 transition-all text-left group shadow-xs"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded bg-slate-100 text-slate-700 group-hover:bg-slate-200 transition-colors">
                      <FlaskConical className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#14263D]">Search Lab</p>
                      <p className="text-[11px] text-[#748293]">BM25 vs Vector vs Hybrid</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#14263D] transition-colors" />
                </button>
              </div>
            </div>

          </Card>
        </div>
      </div>

      {/* Visual Analytics & Intelligence Graphs Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graph 1: Document Chunk & Volume Topology */}
        <Card className="rounded-md p-5 bg-white shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-clario-border">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-clario-navy" />
                <h4 className="text-xs font-bold text-clario-navy uppercase tracking-wider">
                  Corpus Passage Distribution
                </h4>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {stats?.total_searchable_passages || 0} Chunks Total
              </span>
            </div>

            <p className="text-xs text-clario-text-secondary mb-3">
              Passage density across ingested regulatory and enterprise policy documents:
            </p>

            <div className="space-y-3">
              {stats?.recent_documents && stats.recent_documents.length > 0 ? (
                stats.recent_documents.slice(0, 4).map((doc) => {
                  const maxChunks = Math.max(...stats.recent_documents.map(d => d.chunk_count), 1);
                  const pct = Math.round((doc.chunk_count / maxChunks) * 100);
                  return (
                    <div key={doc.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-clario-navy truncate max-w-[180px]">
                          {doc.title}
                        </span>
                        <span className="font-mono text-[11px] text-slate-700 font-semibold">
                          {doc.chunk_count} chunks
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#14263D] rounded-full"
                          style={{ width: `${Math.max(pct, 12)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-slate-400 py-6 text-center">
                  Upload documents to view passage density.
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Vector Chunk Size: 1,000 chars</span>
            <button
              onClick={() => navigate('/documents')}
              className="text-clario-navy font-semibold hover:underline flex items-center gap-1"
            >
              <span>Manage Docs</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </Card>

        {/* Graph 2: Contradiction Severity & Risk Matrix */}
        <Card className="rounded-md p-5 bg-white shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-clario-border">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-slate-700" />
                <h4 className="text-xs font-bold text-clario-navy uppercase tracking-wider">
                  Contradiction Severity Matrix
                </h4>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {findings.length} Discrepancies
              </span>
            </div>

            <p className="text-xs text-clario-text-secondary mb-3">
              Automated breakdown of contractual inconsistencies by severity level:
            </p>

            {/* Severity Stacked Metrics */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-700 block">Critical & High</span>
                <span className="text-lg font-extrabold text-[#14263D]">
                  {findings.filter(f => f.severity === 'critical' || f.severity === 'high').length}
                </span>
                <span className="text-[10px] text-slate-500 block">Mandatory review</span>
              </div>
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-700 block">Medium & Low</span>
                <span className="text-lg font-extrabold text-[#14263D]">
                  {findings.filter(f => f.severity === 'medium' || f.severity === 'low').length}
                </span>
                <span className="text-[10px] text-slate-500 block">Informational</span>
              </div>
            </div>

            {/* Status Breakdown Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>Resolution Progress</span>
                <span className="font-mono">
                  {findings.filter(f => f.status === 'resolved' || f.status === 'confirmed').length} / {findings.length || 1} Evaluated
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className="bg-[#14263D] h-full"
                  style={{
                    width: `${Math.round(
                      (findings.filter(f => f.status === 'resolved' || f.status === 'confirmed').length /
                        Math.max(findings.length, 1)) *
                        100
                    )}%`,
                  }}
                  title="Resolved / Confirmed"
                />
                <div
                  className="bg-slate-300 h-full"
                  style={{
                    width: `${Math.round(
                      (findings.filter(f => f.status === 'under_review').length /
                        Math.max(findings.length, 1)) *
                        100
                    )}%`,
                  }}
                  title="Under Review"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Human-in-the-Loop Audit</span>
            <button
              onClick={() => navigate('/findings')}
              className="text-clario-navy font-semibold hover:underline flex items-center gap-1"
            >
              <span>Review Findings</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </Card>

        {/* Graph 3: Mini Knowledge Graph Topology Preview */}
        <Card className="rounded-md p-5 bg-white shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-clario-border">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-clario-navy" />
                <h4 className="text-xs font-bold text-clario-navy uppercase tracking-wider">
                  Knowledge Topology
                </h4>
              </div>
              <Badge variant="gray" size="sm">2D Semantic Graph</Badge>
            </div>

            <p className="text-xs text-clario-text-secondary mb-2">
              Cross-document semantic clusters linking policies, obligations, and contradictions:
            </p>

            {/* Embedded SVG Mini Topology */}
            <div className="w-full h-32 rounded bg-[#FAF9F5] border border-slate-200 relative overflow-hidden flex items-center justify-center">
              <svg width="100%" height="100%" viewBox="0 0 280 120" className="pointer-events-none">
                {/* Edges */}
                <line x1="140" y1="60" x2="60" y2="35" stroke="#CBD5E1" strokeWidth="1.2" />
                <line x1="140" y1="60" x2="220" y2="35" stroke="#CBD5E1" strokeWidth="1.2" />
                <line x1="140" y1="60" x2="80" y2="90" stroke="#CBD5E1" strokeWidth="1.2" />
                <line x1="140" y1="60" x2="200" y2="90" stroke="#CBD5E1" strokeWidth="1.2" />
                <line x1="60" y1="35" x2="220" y2="35" stroke="#64748B" strokeWidth="1.5" strokeDasharray="3,3" />

                {/* Nodes */}
                {/* Core Document Node */}
                <circle cx="140" cy="60" r="14" fill="#14263D" stroke="#FFFFFF" strokeWidth="2" />
                <text x="140" y="63" textAnchor="middle" fontSize="7" fill="#FFFFFF" fontWeight="bold">CORPUS</text>

                {/* Topic Node 1 */}
                <circle cx="60" cy="35" r="10" fill="#334155" stroke="#FFFFFF" strokeWidth="1.5" />
                <text x="60" y="38" textAnchor="middle" fontSize="6" fill="#FFFFFF">ZDR</text>

                {/* Topic Node 2 */}
                <circle cx="220" cy="35" r="10" fill="#334155" stroke="#FFFFFF" strokeWidth="1.5" />
                <text x="220" y="38" textAnchor="middle" fontSize="6" fill="#FFFFFF">SLA</text>

                {/* Finding Node 1 */}
                <circle cx="80" cy="90" r="9" fill="#475569" stroke="#FFFFFF" strokeWidth="1.5" />
                <text x="80" y="93" textAnchor="middle" fontSize="6" fill="#FFFFFF">DIFF</text>

                {/* Finding Node 2 */}
                <circle cx="200" cy="90" r="9" fill="#64748B" stroke="#FFFFFF" strokeWidth="1.5" />
                <text x="200" y="93" textAnchor="middle" fontSize="6" fill="#FFFFFF">REV</text>
              </svg>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/graph')}
              className="w-full text-xs flex items-center justify-center gap-1.5 font-medium"
            >
              <Network className="w-3.5 h-3.5 text-clario-navy" />
              <span>Explore Full 2D Knowledge Graph</span>
            </Button>
          </div>
        </Card>
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
                    <div className="p-1.5 rounded-md bg-clario-navy/5 text-clario-navy">
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
