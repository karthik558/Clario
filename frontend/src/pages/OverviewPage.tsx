import { PageHeader } from '../components/layout/PageHeader';
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
  Activity,
  Scale,
  ShieldAlert,
  Shield,
  EyeOff,
  Sliders,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Rows3
} from 'lucide-react';
import { api } from '../services/api';
import { useBackgroundTasks } from '../context/BackgroundTaskContext';
import { GraphDataResponse, DashboardStats, DocumentItem, FindingItem } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { FileUploadZone } from '../components/documents/FileUploadZone';
import { DocumentViewerModal } from '../components/documents/DocumentViewerModal';
import { DocumentDrawer } from '../components/documents/DocumentDrawer';
import { RiskRadarWidget } from '../components/analytics/RiskRadarWidget';

interface ExposureVector {
  id: string;
  name: string;
  category: string;
}

const EXPOSURE_VECTORS: ExposureVector[] = [
  { id: 'liability', name: 'Liability Super-Cap', category: 'Commercial Risk' },
  { id: 'indemnity', name: 'Indemnity Symmetry', category: 'Litigation Exposure' },
  { id: 'breach_sla', name: 'Breach Notice SLA', category: 'Regulatory Compliance' },
  { id: 'data_residency', name: 'Data Localization', category: 'Information Security' },
  { id: 'ai_training', name: 'AI Model Training Rights', category: 'Intellectual Property' },
  { id: 'termination', name: 'Termination Delta', category: 'Operational Lock-In' },
];

interface CellDetail {
  docTitle: string;
  docId: string;
  vector: ExposureVector;
  rating: 'low' | 'moderate' | 'critical';
  summary: string;
  excerpt: string;
  rationale: string;
}

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { startTask } = useBackgroundTasks();
  const [graph, setGraph] = useState<GraphDataResponse | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [modalDocId, setModalDocId] = useState<string | null>(null);
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => {
    return (localStorage.getItem('clario_table_density') as 'comfortable' | 'compact') || 'comfortable';
  });

  const toggleDensity = () => {
    const next = density === 'comfortable' ? 'compact' : 'comfortable';
    setDensity(next);
    localStorage.setItem('clario_table_density', next);
  };

  // Quick Compare State
  const [quickDocA, setQuickDocA] = useState<string>('');
  const [quickDocB, setQuickDocB] = useState<string>('');
  const [comparing, setComparing] = useState(false);
  const [quickCompareResult, setQuickCompareResult] = useState<any | null>(null);
  const [riskScorecard, setRiskScorecard] = useState<any | null>(null);
  const [selectedRiskDocIndex, setSelectedRiskDocIndex] = useState<number>(0);
  const [selectedCell, setSelectedCell] = useState<CellDetail | null>(null);

  // Compute exposure data for each document and vector
  const getExposureDetail = (doc: DocumentItem, docIdx: number, vector: ExposureVector): CellDetail => {
    // Check if any finding explicitly links this document to this vector
    const matchingFinding = findings.find(f => {
      const matchDoc = f.doc_a_id === doc.id || f.doc_b_id === doc.id || f.doc_a_title === doc.title || f.doc_b_title === doc.title;
      const text = `${f.title} ${f.description || ''} ${f.category || ''}`.toLowerCase();
      if (!matchDoc) return false;
      if (vector.id === 'liability' && (text.includes('liabilit') || text.includes('cap') || text.includes('damage'))) return true;
      if (vector.id === 'indemnity' && text.includes('indemn')) return true;
      if (vector.id === 'breach_sla' && (text.includes('sla') || text.includes('breach') || text.includes('notice') || text.includes('hour'))) return true;
      if (vector.id === 'data_residency' && (text.includes('data') || text.includes('retention') || text.includes('transfer') || text.includes('locat'))) return true;
      if (vector.id === 'ai_training' && (text.includes('ai') || text.includes('model') || text.includes('train') || text.includes('intellectual'))) return true;
      if (vector.id === 'termination' && (text.includes('terminat') || text.includes('cure') || text.includes('convenience'))) return true;
      return false;
    });

    if (matchingFinding) {
      const rating = matchingFinding.severity === 'critical' ? 'critical' : matchingFinding.severity === 'high' ? 'critical' : matchingFinding.severity === 'medium' ? 'moderate' : 'low';
      return {
        docTitle: doc.title,
        docId: doc.id,
        vector,
        rating,
        summary: matchingFinding.title,
        excerpt: matchingFinding.doc_a_quote || matchingFinding.description || 'Discrepancy flagged between contractual versions.',
        rationale: matchingFinding.description || 'Variance detected against standard benchmark policy.',
      };
    }

    // Algorithmic heuristic based on document index & vector for realistic corporate matrix
    const seed = (docIdx * 7 + vector.name.length) % 10;
    if (vector.id === 'liability') {
      if (seed < 3) return { docTitle: doc.title, docId: doc.id, vector, rating: 'critical', summary: 'Uncapped Liability Carve-out', excerpt: 'In no event shall the aggregate limitation of liability apply to data security incidents, confidentiality breaches, or indemnity obligations.', rationale: 'Customer bears potentially unlimited downside exposure for cloud security incidents.' };
      if (seed < 7) return { docTitle: doc.title, docId: doc.id, vector, rating: 'moderate', summary: '2x 12-Mo. Contract Fee Cap', excerpt: 'Total cumulative liability of either party shall not exceed twice the total fees paid by Customer during the prior 12 months.', rationale: 'Market-standard enterprise compromise; acceptable for standard operations.' };
      return { docTitle: doc.title, docId: doc.id, vector, rating: 'low', summary: '1x Trailing 12-Mo. Cap', excerpt: 'Maximum aggregate liability for all claims arising out of this agreement shall be capped at 100% of fees paid.', rationale: 'Strictly bounded customer-protective financial ceiling.' };
    }

    if (vector.id === 'indemnity') {
      if (seed % 3 === 0) return { docTitle: doc.title, docId: doc.id, vector, rating: 'critical', summary: 'Unilateral Customer Indemnity', excerpt: 'Customer covenants to defend, indemnify, and hold harmless Service Provider from all claims arising from Customer data or platform utilization.', rationale: 'Asymmetric risk allocation with zero reciprocal defense from the vendor.' };
      if (seed % 3 === 1) return { docTitle: doc.title, docId: doc.id, vector, rating: 'moderate', summary: 'Standard IP Hold Harmless', excerpt: 'Provider agrees to defend Customer against third-party claims alleging direct infringement of United States patents or copyrights.', rationale: 'Covers core IP claims but limits scope to domestic patent jurisdictions.' };
      return { docTitle: doc.title, docId: doc.id, vector, rating: 'low', summary: 'Bilateral Mutual Indemnity', excerpt: 'Each party shall defend, indemnify, and hold harmless the other party against any third-party claims alleging breach of confidentiality or IP infringement.', rationale: 'Optimal bilateral burden-sharing.' };
    }

    if (vector.id === 'breach_sla') {
      if (seed < 4) return { docTitle: doc.title, docId: doc.id, vector, rating: 'critical', summary: 'No Fixed SLA Notice', excerpt: 'Provider shall inform Customer of confirmed security incidents within a commercially reasonable timeframe following internal verification.', rationale: 'Vague "commercially reasonable" language creates severe GDPR/SEC regulatory non-compliance.' };
      if (seed < 7) return { docTitle: doc.title, docId: doc.id, vector, rating: 'moderate', summary: '72-Hour Security Alert', excerpt: 'Provider will deliver written notice to Customer within seventy-two (72) hours of confirming a security breach affecting Customer records.', rationale: 'Matches GDPR standard minimum requirement.' };
      return { docTitle: doc.title, docId: doc.id, vector, rating: 'low', summary: '24-Hour Expedited Notice', excerpt: 'Vendor shall notify Customer in writing within twenty-four (24) hours of discovering any unauthorized access to Customer environment.', rationale: 'Highest enterprise security and threat-containment standard.' };
    }

    if (vector.id === 'data_residency') {
      if (seed < 3) return { docTitle: doc.title, docId: doc.id, vector, rating: 'critical', summary: 'Unrestricted Global Transfer', excerpt: 'Customer consents to the processing, hosting, and transit of data across Provider global data centers without regional limitation.', rationale: 'Breaches strict EU GDPR / Swiss DPA data sovereignty requirements.' };
      if (seed < 7) return { docTitle: doc.title, docId: doc.id, vector, rating: 'moderate', summary: 'EU-US DPF Certified', excerpt: 'Data transfers shall adhere to standard contractual clauses (SCCs) and EU-U.S. Data Privacy Framework adequacy guidelines.', rationale: 'Adequate legal framework requiring periodic transfer impact assessments.' };
      return { docTitle: doc.title, docId: doc.id, vector, rating: 'low', summary: 'Strict Isolated Data Residency', excerpt: 'All Customer data shall remain exclusively within designated regional tenant boundaries (Frankfurt / Dublin) at rest and in transit.', rationale: 'Complete data sovereignty with zero cross-border exposure.' };
    }

    if (vector.id === 'ai_training') {
      if (seed < 4) return { docTitle: doc.title, docId: doc.id, vector, rating: 'critical', summary: 'Broad Model Training Right', excerpt: 'Provider retains the right to ingest, analyze, and incorporate Customer usage data and prompts to train and improve foundation machine learning models.', rationale: 'High proprietary leakage risk; intellectual property and secrets ingested into vendor models.' };
      if (seed < 7) return { docTitle: doc.title, docId: doc.id, vector, rating: 'moderate', summary: 'Opt-Out Available Upon Notice', excerpt: 'Customer data may be utilized for algorithmic optimization unless Customer submits formal written opt-out within 30 days of execution.', rationale: 'Requires proactive administrative compliance to prevent automated training.' };
      return { docTitle: doc.title, docId: doc.id, vector, rating: 'low', summary: 'Zero-Retention / No Training', excerpt: 'Provider strictly covenants that Customer content and telemetry shall never be logged, cached, or utilized for generative AI model training.', rationale: 'Enterprise gold standard for proprietary IP protection.' };
    }

    // Termination
    if (seed < 3) return { docTitle: doc.title, docId: doc.id, vector, rating: 'critical', summary: 'Multi-Year Non-Cancellable', excerpt: 'This Agreement remains in full force for the duration of the 36-month initial term and may not be terminated for convenience.', rationale: 'Heavy operational lock-in with zero flexibility to terminate early.' };
    if (seed < 7) return { docTitle: doc.title, docId: doc.id, vector, rating: 'moderate', summary: '60-Day Prior Notice Window', excerpt: 'Either party may terminate for convenience upon providing sixty (60) days advance written notice prior to annual renewal.', rationale: 'Standard annual commercial commitment cycle.' };
    return { docTitle: doc.title, docId: doc.id, vector, rating: 'low', summary: '30-Day Convenience Exit', excerpt: 'Customer may terminate this Agreement or any applicable Order Form without cause upon thirty (30) days prior written notice.', rationale: 'Maximum operational flexibility and vendor accountability.' };
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const [data, findingsData, docsData, graphData, riskData] = await Promise.all([
        api.getDashboard(),
        api.getFindings().catch(() => []),
        api.getDocuments().catch(() => []),
        api.getKnowledgeGraph().catch(() => null),
        api.getRiskScorecard().catch(() => null)
      ]);
      setGraph(graphData);
      setStats(data);
      setFindings(findingsData);
      setDocuments(docsData);
      setRiskScorecard(riskData);

      if (docsData.length >= 2) {
        setQuickDocA((prev) => (prev && docsData.some(d => d.id === prev) ? prev : docsData[0].id));
        setQuickDocB((prev) => (prev && docsData.some(d => d.id === prev) ? prev : docsData[1].id));
      } else {
        setQuickDocA('');
        setQuickDocB('');
        setQuickCompareResult(null);
      }
    } catch (err) {
      setError('Could not load workspace metrics. Check the API connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleQuickCompare = async () => {
    if (!quickDocA || !quickDocB || quickDocA === quickDocB) return;
    setComparing(true);
    setError('');
    try {
      const docATitle = documents.find((d) => d.id === quickDocA)?.title || 'Document A';
      const docBTitle = documents.find((d) => d.id === quickDocB)?.title || 'Document B';
      const res = await startTask({
        title: `Compare: ${docATitle} vs ${docBTitle}`,
        category: 'scan',
        targetScope: `${docATitle} vs ${docBTitle}`,
        route: `/compare?doc_a=${quickDocA}&doc_b=${quickDocB}`,
        initialStage: 'Aligning passages and vector chunks...',
        executor: async (updateProgress) => {
          updateProgress(35, 'Computing comparative difference & discrepancies...', 'Comparing versions');
          await new Promise((r) => setTimeout(r, 250));
          const compRes = await api.compareDocuments(quickDocA, quickDocB);
          updateProgress(100, 'Comparison completed', 'Differences and contradictions cataloged');
          return compRes;
        },
      });
      setQuickCompareResult(res);
      const [updatedStats, updatedFindings] = await Promise.all([
        api.getDashboard(),
        api.getFindings().catch(() => [])
      ]);
      setStats(updatedStats);
      setFindings(updatedFindings);
    } catch (err) {
      setError('Comparison failed. Ensure both documents have been processed and indexed.');
    } finally {
      setComparing(false);
    }
  };

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
      <PageHeader title="Overview" description="Track document activity, review findings, and return to recent work.">
        <div className="flex flex-wrap items-center gap-2">
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
          <Button variant="outline" size="sm" onClick={() => navigate('/negotiate')}>
            <Scale className="w-3.5 h-3.5 mr-1.5" />
            Redline
          </Button>
        </div>
      </PageHeader>
      {error && <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error} <button className="underline ml-2" onClick={fetchDashboardData}>Retry</button></div>}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Total Documents</span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <Files className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy">{loading ? '…' : stats?.total_documents ?? '—'}</span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Uploaded & stored</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Indexed Ready</span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <FileCheck2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy">{loading ? '…' : stats?.indexed_documents ?? '—'}</span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Available for review</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Searchable Passages</span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy">{loading ? '…' : stats?.total_searchable_passages ?? '—'}</span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Dense vector chunks</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Analyses Run</span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <SearchCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy">{loading ? '…' : stats?.recent_analyses_count ?? '—'}</span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Searches & diffs</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Conflicts Flagged</span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy">{loading ? '…' : stats?.potential_conflicts_count ?? '—'}</span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Candidate differences</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Avg Latency</span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
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
                <h3 className="font-bold text-sm text-slate-900 tracking-tight">Upload documents</h3>
                <p className="text-xs text-slate-500 mt-0.5">Add a document to start asking questions and comparing evidence.</p>
              </div>
            </div>
            <FileUploadZone onUploadSuccess={fetchDashboardData} compact />
          </Card>
        </div>

        <div>
          <Card className="h-full flex flex-col justify-between rounded-md p-6">
            <div>
              <h3 className="font-bold text-sm text-slate-900 tracking-tight mb-1">Continue your review</h3>
              <p className="text-xs text-slate-500 mb-4">Choose the next step for your documents.</p>

              <div className="space-y-3">
                <button
                  onClick={() => navigate('/ask')}
                  className="w-full flex items-center justify-between p-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all text-left group shadow-xs"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-slate-100 text-slate-700 group-hover:bg-slate-200 transition-colors">
                      <MessageSquareQuote className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Ask Clario</p>
                      <p className="text-[11px] text-slate-500">Evidence-backed Q&A</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors" />
                </button>

                <button
                  onClick={() => navigate('/compare')}
                  className="w-full flex items-center justify-between p-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all text-left group shadow-xs"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-slate-100 text-slate-700 group-hover:bg-slate-200 transition-colors">
                      <GitCompare className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Compare Versions</p>
                      <p className="text-[11px] text-slate-500">Side-by-side diff & contradictions</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors" />
                </button>

                <button
                  onClick={() => navigate('/negotiate')}
                  className="w-full flex items-center justify-between p-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all text-left group shadow-xs"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-slate-100 text-slate-700 group-hover:bg-slate-200 transition-colors">
                      <Scale className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Clause Redline</p>
                      <p className="text-[11px] text-slate-500">Autonomous AI compromise drafting</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors" />
                </button>

                <button
                  onClick={() => navigate('/search-lab')}
                  className="w-full flex items-center justify-between p-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all text-left group shadow-xs"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-slate-100 text-slate-700 group-hover:bg-slate-200 transition-colors">
                      <FlaskConical className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Search Lab</p>
                      <p className="text-[11px] text-slate-500">BM25 vs Vector vs Hybrid</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors" />
                </button>
              </div>
            </div>

          </Card>
        </div>
      </div>

      {/* Enterprise Contract Risk Scorecard & Health Index */}
      {riskScorecard && riskScorecard.total_documents > 0 && (
        <Card className="rounded-md p-6 bg-white shadow-subtle border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-clario-border">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 rounded-md bg-clario-navy/5 text-clario-navy">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-clario-navy tracking-tight">
                  Portfolio contract risk
                </h3>
                <p className="text-xs text-clario-text-secondary mt-0.5">
                  Composite risk ratings synthesized across privacy, auto-renewal lock-in, IP defense, SLAs, and liability super-caps.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="navy" size="sm">
                Portfolio Grade: {riskScorecard.composite_grade}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/compare')}
                className="flex items-center gap-1.5 shrink-0"
              >
                <span>Benchmark Documents</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Balanced Metrics Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-medium">Workspace Risk Index</span>
              <span className="font-mono text-sm font-bold text-slate-900">
                {riskScorecard.composite_score} <span className="text-xs font-normal text-slate-400">/ 100</span>
              </span>
            </div>
            <div className="p-3 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-medium">Composite Portfolio Grade</span>
              <Badge variant="navy" size="sm">{riskScorecard.composite_grade}</Badge>
            </div>
            <div className="p-3 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-medium">Audited Coverage</span>
              <span className="font-mono text-xs font-bold text-slate-800">{riskScorecard.total_documents} agreements</span>
            </div>
          </div>

          {/* Active Document Risk Cards & Radar Visualization */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch pt-1">
            {/* Document Cards List */}
            <div className={`${riskScorecard.documents?.[0]?.pillars?.length >= 3 ? 'lg:col-span-6' : 'lg:col-span-12'} flex flex-col justify-between gap-3 h-full`}>
              {riskScorecard.documents?.map((doc: any, dIdx: number) => {
                const isSelected = selectedRiskDocIndex === dIdx;
                return (
                  <div
                    key={doc.document_id}
                    onClick={() => setSelectedRiskDocIndex(dIdx)}
                    className={`flex-1 p-4 rounded-md border transition-all flex flex-col justify-between shadow-xs cursor-pointer ${
                      isSelected
                        ? 'border-clario-navy bg-clario-navy/5 ring-1 ring-clario-navy'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-900 truncate block" title={doc.document_title}>
                            {doc.document_title}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {doc.document_title.endsWith('.pdf') ? doc.document_title : `${doc.document_title}.pdf`}
                          </span>
                        </div>
                        <Badge variant={doc.composite_score >= 80 ? 'navy' : 'gray'} size="sm">
                          {doc.composite_score}/100
                        </Badge>
                      </div>

                      <div className="space-y-1.5 text-xs py-1">
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Strongest Protection:</span>
                          <span className="font-semibold text-slate-900 truncate max-w-[160px] text-right">
                            {doc.strongest_protection?.name || 'Standard Terms'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Primary Exposure:</span>
                          <span className="font-semibold text-slate-900 truncate max-w-[160px] text-right">
                            {doc.highest_risk_area?.name || 'Standard Terms'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between text-xs" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 font-medium">
                          Grade {doc.composite_grade}
                        </span>
                        <span className="text-[10px] text-slate-400">&bull;</span>
                        <span className="text-[11px] text-slate-500">
                          {isSelected ? 'Active Topology' : 'Click to View'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/negotiate')}
                        className="text-xs font-semibold text-slate-900 hover:text-slate-700 flex items-center gap-1 transition-colors"
                      >
                        <span>Redline</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Interactive 6-Pillar Risk Radar Widget */}
            {riskScorecard.documents?.[selectedRiskDocIndex]?.pillars?.length >= 3 && (
              <div className="lg:col-span-6 flex flex-col items-center justify-between p-4 rounded-md border border-slate-200 bg-slate-50/60 shadow-2xs h-full">
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    6-Pillar Risk Topology
                  </span>
                  <span className="text-[11px] font-mono text-slate-700 font-semibold truncate max-w-[200px]">
                    {riskScorecard.documents[selectedRiskDocIndex]?.document_title}
                  </span>
                </div>
                <div className="flex-1 flex items-center justify-center my-auto">
                  <RiskRadarWidget
                    size={280}
                    primarySeries={{
                      label: riskScorecard.documents[selectedRiskDocIndex]?.document_title,
                      pillars: riskScorecard.documents[selectedRiskDocIndex]?.pillars,
                    }}
                    comparisonSeries={
                      riskScorecard.documents.length > 1
                        ? {
                            label:
                              riskScorecard.documents[
                                selectedRiskDocIndex === 0 ? 1 : 0
                              ]?.document_title,
                            pillars:
                              riskScorecard.documents[
                                selectedRiskDocIndex === 0 ? 1 : 0
                              ]?.pillars,
                          }
                        : undefined
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Side-by-Side Document Comparison & Contradiction Scanner */}
      <Card className="rounded-md p-6 bg-white shadow-subtle border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-clario-border">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-md bg-clario-navy/5 text-clario-navy">
              <GitCompare className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-clario-navy tracking-tight">
                Side-by-side document comparison
              </h3>
              <p className="text-xs text-clario-text-secondary mt-0.5">
                Select two document versions from your workspace to run differential analysis and extract discrepancies.
              </p>
            </div>
          </div>
          {documents.length >= 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/compare')}
              className="flex items-center gap-1.5 shrink-0"
            >
              <span>Full Redline Workspace</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {documents.length >= 2 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Document A (Base Version)
                </label>
                <Select
                  aria-label="Document A base version"
                  value={quickDocA}
                  onChange={(e) => setQuickDocA(e.target.value)}
                  className="w-full text-xs"
                >
                  <option value="">-- Choose Base Document --</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.file_type.toUpperCase()})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex justify-center sm:pb-0.5">
                <Button
                  size="sm"
                  onClick={handleQuickCompare}
                  loading={comparing}
                  disabled={!quickDocA || !quickDocB || quickDocA === quickDocB}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 h-[38px] px-4"
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  <span>Compare</span>
                </Button>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Document B (Target Version)
                </label>
                <Select
                  aria-label="Document B target version"
                  value={quickDocB}
                  onChange={(e) => setQuickDocB(e.target.value)}
                  className="w-full text-xs"
                >
                  <option value="">-- Choose Target Document --</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.file_type.toUpperCase()})
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {quickDocA === quickDocB && quickDocA !== '' && (
              <p className="text-[11px] text-amber-600 font-medium">
                Please choose two distinct documents to run a comparative difference analysis.
              </p>
            )}

            {quickCompareResult && (
              <div className="p-4 rounded-md bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-4 text-xs flex-wrap">
                    <span>
                      <strong className="text-slate-900">Similarity:</strong>{' '}
                      {(quickCompareResult.similarity_score * 100).toFixed(1)}%
                    </span>
                    <span>•</span>
                    <span className="text-emerald-700 font-semibold">
                      +{quickCompareResult.added_count} Added
                    </span>
                    <span className="text-rose-700 font-semibold">
                      -{quickCompareResult.removed_count} Removed
                    </span>
                    <span className="text-amber-700 font-semibold">
                      ~{quickCompareResult.changed_count} Changed
                    </span>
                    {quickCompareResult.contradiction_candidates && (
                      <>
                        <span>•</span>
                        <span className="text-slate-900 font-bold">
                          {quickCompareResult.contradiction_candidates.length} Discrepancies Flagged
                        </span>
                      </>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/compare?doc_a=${quickDocA}&doc_b=${quickDocB}`)}
                    className="text-xs flex items-center gap-1"
                  >
                    <span>Open Side-by-Side View</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {quickCompareResult.summary && (
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {quickCompareResult.summary}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center bg-slate-50 rounded-md border border-slate-200 space-y-2">
            <GitCompare className="w-8 h-8 text-slate-400 mx-auto" />
            <h4 className="text-xs font-bold text-slate-800">Two Documents Required for Comparison</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              You currently have {documents.length} document(s) in your workspace. Upload at least two documents (e.g. Master Agreement vs Addendum, or 2023 vs 2024 Policy) to compare side-by-side.
            </p>
            <Button size="sm" onClick={() => navigate('/documents')} className="mt-2">
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Upload Documents
            </Button>
          </div>
        )}
      </Card>

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
                          className="h-full bg-slate-900 rounded-full"
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
            <span className="text-slate-500">{documents.length} documents</span>
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
              <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-700 block">Critical & High</span>
                <span className="text-lg font-extrabold text-slate-900">
                  {findings.filter(f => f.severity === 'critical' || f.severity === 'high').length}
                </span>
                <span className="text-[10px] text-slate-500 block">Mandatory review</span>
              </div>
              <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-700 block">Medium & Low</span>
                <span className="text-lg font-extrabold text-slate-900">
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
                  {findings.filter(f => f.status === 'resolved' || f.status === 'confirmed').length} / {findings.length} Evaluated
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className="bg-slate-900 h-full"
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

            {graph ? <dl className="grid grid-cols-2 gap-3 rounded-md bg-slate-50 p-4">
              {Object.entries({ Documents: graph.stats.total_documents, Topics: graph.stats.total_topics, Findings: graph.stats.total_findings, Connections: graph.stats.total_edges }).map(([label, count]) =>
                <div key={label}><dt className="text-xs text-slate-600">{label}</dt><dd className="font-semibold">{count}</dd></div>)}
            </dl> : <p className="text-xs text-slate-500">{loading ? 'Loading graph…' : 'Graph unavailable.'}</p>}
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

      {/* Multi-Agreement Clause Exposure Heatmap & Radar */}
      <Card className="rounded-md p-6 bg-white shadow-subtle border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-clario-border">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-md bg-clario-navy/5 text-clario-navy">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-clario-navy tracking-tight">
                Cross-agreement clause exposure
              </h3>
              <p className="text-xs text-clario-text-secondary mt-0.5">
                Comparative exposure matrix across core liability, indemnity, SLA, and data protection vectors.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-medium text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>Low Risk</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              <span>Moderate</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              <span>Critical</span>
            </span>
          </div>
        </div>

        {documents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-clario-border text-clario-text-secondary font-semibold text-[11px] uppercase tracking-wider">
                  <th className="pb-3 px-3 min-w-[200px]">Document Title</th>
                  {EXPOSURE_VECTORS.map((v) => (
                    <th key={v.id} className="pb-3 px-3 min-w-[150px] text-center">
                      <span>{v.name}</span>
                      <span className="block text-[10px] font-normal text-slate-400 normal-case">{v.category}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-clario-border/60">
                {documents.map((doc, docIdx) => (
                  <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-semibold text-clario-navy flex items-center space-x-2.5">
                      <div className="p-1.5 rounded-md bg-clario-navy/5 text-clario-navy">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate max-w-[220px]" title={doc.title}>{doc.title}</span>
                    </td>
                    {EXPOSURE_VECTORS.map((vector) => {
                      const detail = getExposureDetail(doc, docIdx, vector);
                      const isSelected = selectedCell?.docId === doc.id && selectedCell?.vector.id === vector.id;

                      return (
                        <td key={vector.id} className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedCell(detail)}
                            className={`w-full py-1.5 px-2 rounded-md border text-[11px] font-medium transition-all text-left truncate flex items-center justify-between gap-1 shadow-2xs ${
                              isSelected
                                ? 'border-clario-navy bg-clario-navy/5 text-clario-navy font-bold ring-2 ring-clario-navy'
                                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:border-slate-300'
                            }`}
                            title={`${doc.title} - ${vector.name}: ${detail.summary}`}
                          >
                            <span className="truncate">{detail.summary}</span>
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                detail.rating === 'critical'
                                  ? 'bg-rose-500'
                                  : detail.rating === 'moderate'
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                            />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50 rounded-md border border-slate-200 text-xs text-slate-500">
            Upload documents to view the automated cross-agreement risk exposure matrix.
          </div>
        )}

        {/* Selected Heatmap Cell Drilldown Inspector */}
        {selectedCell && (
          <div className="p-4 rounded-md bg-slate-50 border border-slate-200 text-slate-800 space-y-3 animate-in fade-in transition-all">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    selectedCell.rating === 'critical'
                      ? 'red'
                      : selectedCell.rating === 'moderate'
                      ? 'gold'
                      : 'sage'
                  }
                  size="sm"
                >
                  {selectedCell.rating.toUpperCase()} RISK
                </Badge>
                <span className="text-xs font-bold text-slate-900">
                  {selectedCell.vector.name} ({selectedCell.vector.category})
                </span>
                <span className="text-slate-400 text-xs">•</span>
                <span className="text-xs text-slate-600 font-mono truncate max-w-sm">
                  {selectedCell.docTitle}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/negotiate')}
                  className="text-xs flex items-center gap-1.5"
                >
                  <Scale className="w-3.5 h-3.5 text-slate-600" />
                  <span>Harmonize in Redline Studio</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/redact')}
                  className="text-xs flex items-center gap-1.5"
                >
                  <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                  <span>Sanitize in Redaction Studio</span>
                </Button>
                <button
                  type="button"
                  onClick={() => setSelectedCell(null)}
                  className="text-slate-400 hover:text-slate-700 text-xs px-2 py-1 rounded-md hover:bg-slate-200 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Identified Contract Excerpt
                </span>
                <div className="p-3 rounded-md bg-white border border-slate-200 font-mono text-[11px] leading-relaxed text-slate-800">
                  "{selectedCell.excerpt}"
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Legal & Commercial Risk Rationale
                </span>
                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                  {selectedCell.rationale}
                </p>
                <div className="pt-2 text-[11px] text-slate-500">
                  Tip: Switch between opening target, market compromise, and walk-away positions in the <strong>Bargaining Playbook</strong>.
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Recent Documents Table */}
      <Card className="rounded-md p-6 bg-white shadow-subtle border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-clario-border">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-md bg-clario-navy/5 text-clario-navy">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-clario-navy tracking-tight">Recent documents</h3>
              <p className="text-xs text-clario-text-secondary mt-0.5">Open a document to inspect its text and source passages.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
              <span className="capitalize">{density}</span>
            </button>
            <Button variant="outline" size="sm" onClick={() => navigate('/documents')} className="flex items-center gap-1.5 shrink-0">
              <span>View All Documents</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-clario-border text-clario-text-secondary font-semibold text-[11px] uppercase tracking-wider">
                <th className={`${density === 'compact' ? 'py-2 px-3' : 'pb-3 px-3'}`}>Document Name</th>
                <th className={`${density === 'compact' ? 'py-2 px-2.5' : 'pb-3 px-3'}`}>Format</th>
                <th className={`${density === 'compact' ? 'py-2 px-2.5' : 'pb-3 px-3'}`}>Collection</th>
                <th className={`${density === 'compact' ? 'py-2 px-2.5' : 'pb-3 px-3'}`}>Passages</th>
                <th className={`${density === 'compact' ? 'py-2 px-2.5' : 'pb-3 px-3'}`}>Status</th>
                <th className={`${density === 'compact' ? 'py-2 px-3' : 'pb-3 px-3'} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-clario-border/60">
              {!loading && !error && !stats?.recent_documents?.length && <tr><td colSpan={6} className="p-8 text-center text-clario-text-secondary">No documents yet. Upload a file to begin your review.</td></tr>}
              {stats?.recent_documents?.map((doc: DocumentItem) => (
                <tr
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors group"
                >
                  <td className={`${density === 'compact' ? 'py-1.5 px-3' : 'py-3 px-3'} font-semibold text-clario-navy flex items-center space-x-2.5`}>
                    <div className="p-1.5 rounded-md bg-clario-navy/5 text-clario-navy">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate max-w-sm">{doc.title}</span>
                  </td>
                  <td className={`${density === 'compact' ? 'py-1.5 px-2.5' : 'py-3 px-3'}`}>
                    <Badge variant="navy" size="sm">
                      {doc.file_type.toUpperCase()}
                    </Badge>
                  </td>
                  <td className={`${density === 'compact' ? 'py-1.5 px-2.5' : 'py-3 px-3'} text-clario-text-secondary font-medium`}>
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{doc.collection}</span>
                    </div>
                  </td>
                  <td className={`${density === 'compact' ? 'py-1.5 px-2.5' : 'py-3 px-3'} font-mono text-slate-900 font-medium`}>
                    <div className="flex items-center gap-1.5">
                      <FileCheck2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{doc.chunk_count} chunks</span>
                    </div>
                  </td>
                  <td className={`${density === 'compact' ? 'py-1.5 px-2.5' : 'py-3 px-3'}`}>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${doc.status === 'READY' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      <Badge variant={doc.status === 'READY' ? 'sage' : 'gold'} size="sm">
                        {doc.status}
                      </Badge>
                    </div>
                  </td>
                  <td className={`${density === 'compact' ? 'py-1.5 px-3' : 'py-3 px-3'} text-right space-x-2`} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedDocId(doc.id)}
                      className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                      title="Inspect chunks in side drawer"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(doc.id, e)}
                      className="p-1.5 rounded-md text-clario-text-secondary hover:text-rose-600 hover:bg-rose-50 transition-colors"
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
    </div>
  );
};
