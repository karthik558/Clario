import { PageHeader } from '../components/layout/PageHeader';
import { workspaceDate } from '../utils/date';
import { Select } from '../components/ui/Select';
import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Plus,
  Calendar,
  Layers,
  ShieldCheck,
  Eye,
  Trash2,
  FileCheck,
  Cpu,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';
import { useBackgroundTasks } from '../context/BackgroundTaskContext';
import { ReportItem, DocumentItem } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Markdown } from '../components/ui/Markdown';
import { Modal } from '../components/ui/Modal';

const REPORT_TYPE_LABELS: Record<string, string> = {
  comparative: 'Comparative Version Analysis',
  summary: 'Document Intelligence Summary',
  contradictions: 'Contradiction & Compliance Findings',
  contradiction_remediation: 'Contradiction & Remediation Playbook',
  contradiction_executive_matrix: 'Executive Risk & Contradiction Matrix',
  compliance_governance: 'Compliance & Governance Posture Audit',
  search_benchmark: 'Retrieval & Search Telemetry Benchmark',
  research_dossier: 'Comprehensive Research Dossier',
};

const formatReportTypeLabel = (type: string) =>
  REPORT_TYPE_LABELS[type] || type.replace(/_/g, ' ');

export const ReportsPage: React.FC = () => {
  const { startTask, activeTasks, setIsDrawerOpen } = useBackgroundTasks();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [clearing] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);

  const activeReportTask = activeTasks.find((t) => t.category === 'report');

  const [error, setError] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [reportType, setReportType] = useState('comparative');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [customNotes, setCustomNotes] = useState('');
  const [useAi, setUseAi] = useState<boolean>(() => {
    try {
      return localStorage.getItem('clario_critique_use_ai') === 'true';
    } catch {
      return false;
    }
  });

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [reportsData, docsData] = await Promise.all([
        api.getReports(),
        api.getDocuments()
      ]);
      setReports(reportsData);
      setDocuments(docsData);
      if (docsData.length > 0) {
        setSelectedDocIds((prev) => (prev.length > 0 ? prev : docsData.slice(0, 2).map((d) => d.id)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The report could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  interface ReportDeleteTarget {
    type: 'single' | 'all';
    reportId?: string;
    reportTitle?: string;
  }
  const [deleteTarget, setDeleteTarget] = useState<ReportDeleteTarget | null>(null);
  const [deletingReport, setDeletingReport] = useState(false);

  const handleClearAllReports = () => {
    setDeleteTarget({ type: 'all' });
  };

  const handleDeleteReport = (reportId: string, reportTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget({ type: 'single', reportId, reportTitle });
  };

  const executeReportDelete = async () => {
    if (!deleteTarget) return;
    setDeletingReport(true);
    setError('');
    try {
      if (deleteTarget.type === 'all') {
        await api.clearAllReports();
        setReports([]);
        setSelectedReport(null);
      } else if (deleteTarget.reportId) {
        await api.deleteReport(deleteTarget.reportId);
        if (selectedReport?.id === deleteTarget.reportId) setSelectedReport(null);
        setReports(prev => prev.filter(r => r.id !== deleteTarget.reportId));
      }
      setDeleteTarget(null);
    } catch {
      setError(deleteTarget.type === 'all' ? 'Failed to clear reports. Please try again.' : 'Could not delete report.');
    } finally {
      setDeletingReport(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setError('');
    const reportTitle = title.trim();
    const docScope = selectedDocIds.length > 0 ? `${selectedDocIds.length} Document(s)` : 'Entire Workspace';

    // Close modal immediately so the user is never locked in while compiling
    setShowGenerateModal(false);
    setGenerating(true);

    try {
      await startTask<ReportItem>({
        title: `PDF Dossier: ${reportTitle}`,
        category: 'report',
        targetScope: docScope,
        route: '/reports#dossiers-grid',
        initialStage: 'Compiling cross-document telemetry and PDF...',
        executor: async (updateProgress) => {
          updateProgress(20, 'Aggregating cross-document findings and risk matrices...', `Analyzing ${docScope}`);
          if (useAi) {
            updateProgress(55, 'Synthesizing executive summary and strategic recommendations with AI...', 'Running executive intelligence synthesis');
          }
          updateProgress(80, 'Compiling and certifying PDF document dossier...', 'Formatting printable PDF layout');
          const report = await api.createReport({
            title: reportTitle,
            report_type: reportType,
            document_ids: selectedDocIds,
            custom_notes: customNotes,
            use_ai: useAi
          });
          updateProgress(100, 'PDF Dossier generated', 'Report ready for download');
          return report;
        }
      }).then((report) => {
        setSelectedReport(report);
        setTitle('');
        setCustomNotes('');
        fetchReports();
      });
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'The report could not be generated.');
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title="Reports" description="Export documents, comparisons, findings, and reviewer notes as a PDF.">
        <div className="flex flex-wrap items-center gap-2">
          {reports.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAllReports}
              disabled={clearing}
              className="text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {clearing ? 'Clearing…' : 'Clear All Reports'}
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setTitle(`Executive Intelligence Audit - ${new Date().toLocaleDateString()}`);
              setShowGenerateModal(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Generate New Report
          </Button>
        </div>
      </PageHeader>

      {/* Top Metric Cards - Matching Overview and Documents design */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Compiled Reports
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <FileCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {loading ? '—' : reports.length}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Executive PDF dossiers
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Indexed Documents
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {loading ? '—' : documents.length}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Available for report synthesis
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Comparative & Risk Audits
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {loading
              ? '—'
              : reports.filter((r) =>
                  ['comparative', 'research_dossier', 'contradiction_executive_matrix'].includes(r.report_type)
                ).length}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Multi-document intelligence dossiers
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              PDF Exports Ready
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {loading ? '—' : reports.filter((r) => r.pdf_available).length}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Clario branded PDF dossiers
          </span>
        </Card>
      </div>

      {error && !showGenerateModal && <p role="alert" className="rounded-md p-3 text-sm text-rose-800 bg-rose-50">{error}</p>}

      {/* Active Background PDF Compilation Banner */}
      {activeReportTask && (
        <Card className="p-3.5 bg-amber-50/80 border border-amber-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700 shrink-0" />
              <span className="font-bold text-amber-950 uppercase tracking-wider text-[11px]">
                PDF Dossier Compilation In Progress
              </span>
              <span className="text-amber-800 font-medium">— {activeReportTask.stage}</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="font-mono font-bold text-amber-900">{activeReportTask.progress}%</span>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="text-[11px] underline text-amber-900 font-semibold hover:text-amber-950 ml-2"
              >
                View Live Status
              </button>
            </div>
          </div>
          <div className="w-full h-1 bg-amber-200/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-700 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(8, activeReportTask.progress)}%` }}
            />
          </div>
        </Card>
      )}

      {/* Reports Grid */}
      <div id="dossiers-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 scroll-mt-6 transition-all duration-300">
        {loading ? (
          <div className="col-span-full text-center py-12 text-xs text-clario-text-secondary">
            Loading generated dossiers...
          </div>
        ) : reports.length === 0 ? (
          <Card className="col-span-full p-8 text-center bg-white">
            <FileText className="w-8 h-8 text-clario-text-muted mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-clario-text mb-1">No reports generated yet</h4>
            <p className="text-xs text-clario-text-secondary max-w-sm mx-auto mb-4">
              Compile cross-document findings and export structured PDF executive dossiers.
            </p>
            <Button variant="secondary" size="sm" onClick={() => setShowGenerateModal(true)}>
              Generate First Report
            </Button>
          </Card>
        ) : (
          reports.map((rep) => (
            <Card
              key={rep.id}
              hoverEffect
              onClick={() => setSelectedReport(rep)}
              className="flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-teal-700 truncate">
                    {formatReportTypeLabel(rep.report_type)}
                  </span>
                  {rep.pdf_available && (
                    <span className="text-[10.5px] font-semibold text-emerald-700 shrink-0">
                      PDF Ready
                    </span>
                  )}
                </div>

                <h3 className="font-semibold text-sm text-clario-navy tracking-tight mb-2 line-clamp-1">
                  {rep.title}
                </h3>

                <p className="text-xs text-clario-text-secondary line-clamp-3 mb-4 leading-relaxed">
                  {rep.executive_summary}
                </p>
              </div>

              {/* Bottom Actions */}
              <div
                className="pt-3 border-t border-clario-border flex items-center justify-between text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[10px] text-clario-text-muted flex items-center space-x-1">
                  <Calendar className="w-3 h-3" />
                  <span>{workspaceDate(rep.created_at).toLocaleDateString()}</span>
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedReport(rep)}
                    className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    title="View Interactive Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {rep.pdf_available && (
                    <a
                      href={api.getReportDownloadUrl(rep.id)}
                      download={`Clario_${rep.title}.pdf`}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-clario-navy text-white hover:bg-clario-navy-light text-[11px] font-medium transition-colors shadow-xs"
                      title="Download PDF"
                    >
                      <Download className="w-3 h-3" />
                      <span>PDF</span>
                    </a>
                  )}

                  <button
                    onClick={(e) => handleDeleteReport(rep.id, rep.title, e)}
                    className="p-1.5 rounded-md text-clario-text-secondary hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete Report"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Generation Modal */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title="Generate Official Intelligence Report"
        maxWidth="lg"
      >
        <form onSubmit={handleGenerate} className="space-y-4 text-xs">
          {error && <p role="alert" className="text-rose-800">{error}</p>}
          <div>
            <label htmlFor="title" className="block text-[11px] font-semibold text-clario-navy uppercase mb-1">
              Report Title
            </label>
            <input id="title" type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full text-xs px-3 py-2 rounded-md border border-slate-200 bg-white focus:outline-none focus:border-slate-900 text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="reportType" className="block text-[11px] font-semibold text-slate-900 uppercase mb-1">
              Report Template Type
            </label>
            <Select id="reportType" value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-md border border-slate-200 bg-white focus:outline-none focus:border-slate-900 text-slate-900"
            >
              <option value="comparative">Comparative Version Analysis</option>
              <option value="summary">Document Intelligence Summary</option>
              <option value="contradictions">Contradiction & Compliance Findings</option>
              <option value="contradiction_remediation">Contradiction & Remediation Playbook</option>
              <option value="contradiction_executive_matrix">Executive Risk & Contradiction Matrix</option>
              <option value="compliance_governance">Compliance & Governance Posture Audit</option>
              <option value="search_benchmark">Recorded Search Performance Benchmark</option>
              <option value="research_dossier">Comprehensive Research Dossier</option>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-slate-900 uppercase">
                Document Scope ({selectedDocIds.length > 0 ? `${selectedDocIds.length} selected` : 'all documents'})
              </label>
              {documents.length > 0 && (
                <div className="flex items-center gap-2 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setSelectedDocIds(documents.map((d) => d.id))}
                    className="text-clario-navy hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedDocIds([])}
                    className="text-slate-500 hover:text-slate-800 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 rounded-md border border-slate-200 bg-slate-50">
              {documents.map((d) => {
                const isChecked = selectedDocIds.includes(d.id);
                return (
                  <label key={d.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        if (isChecked) {
                          setSelectedDocIds(selectedDocIds.filter((id) => id !== d.id));
                        } else {
                          setSelectedDocIds([...selectedDocIds, d.id]);
                        }
                      }}
                      className="rounded-md text-slate-900 focus:ring-slate-900"
                    />
                    <span className="text-xs text-slate-700 truncate">{d.title}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="customNotes" className="block text-[11px] font-semibold text-slate-900 uppercase mb-1">
              Custom Auditor Notes / Context
            </label>
            <textarea id="customNotes" value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Conducted ahead of 2026 compliance audit review."
              className="w-full text-xs px-3 py-2 rounded-md border border-slate-200 bg-white focus:outline-none focus:border-slate-900 text-slate-900"
            />
          </div>

          <div className="pt-1">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={useAi}
                onChange={(e) => setUseAi(e.target.checked)}
                className="rounded-md border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <Cpu className="w-3.5 h-3.5 text-slate-600" />
              <span>Synthesize Detailed Intelligence & Strategy with AI (Takes extra time for full coverage)</span>
            </label>
          </div>

          <div className="pt-3 border-t border-clario-border flex justify-end space-x-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setShowGenerateModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={generating}>
              {generating ? 'Compiling in Background...' : 'Compile Report & PDF'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Interactive Report Preview Modal */}
      {selectedReport && (
        <Modal
          isOpen={!!selectedReport}
          onClose={() => setSelectedReport(null)}
          title={selectedReport.title}
          maxWidth="2xl"
        >
          <div className="space-y-5 text-xs">
            {/* Website-Style Branded Header */}
            <div className="rounded-lg bg-clario-navy text-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <img src="/clario.webp" alt="Clario" className="h-5 w-auto object-contain" />
                  <span className="text-[10px] text-slate-400 border-l border-slate-700 pl-3">
                    Every document. A clearer answer.
                  </span>
                </div>
                <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-300">
                  <span className="font-semibold text-teal-300 uppercase tracking-wider">
                    {formatReportTypeLabel(selectedReport.report_type)}
                  </span>
                  <span>•</span>
                  <span>Compiled {workspaceDate(selectedReport.created_at).toLocaleString()}</span>
                </div>
              </div>

              {selectedReport.pdf_available && (
                <a
                  href={api.getReportDownloadUrl(selectedReport.id)}
                  download={`Clario_${selectedReport.title}.pdf`}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white text-clario-navy rounded-md text-xs font-semibold hover:bg-slate-100 shadow-xs shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </a>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-clario-navy text-xs uppercase tracking-wider mb-1.5">
                Executive Summary
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-md border border-slate-200 whitespace-pre-line">
                {selectedReport.executive_summary}
              </p>
            </div>

            {/* AI Synthesis Sections */}
            {selectedReport.content?.ai_sections && (
              <div className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
                <h4 className="font-semibold text-clario-navy text-xs uppercase tracking-wider">
                  AI Strategic Synthesis
                </h4>
                {selectedReport.content.ai_sections.cross_document_insights?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-700 mb-1">Cross-Document Insights</p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700">
                      {selectedReport.content.ai_sections.cross_document_insights.map((ins: string, idx: number) => (
                        <li key={idx}>{ins}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedReport.content.ai_sections.risk_conclusions && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-700 mb-1">Risk & Governance Conclusions</p>
                    <p className="text-slate-700 leading-relaxed">{selectedReport.content.ai_sections.risk_conclusions}</p>
                  </div>
                )}
                {selectedReport.content.ai_sections.strategic_recommendations?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-700 mb-1">Strategic Recommendations</p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700">
                      {selectedReport.content.ai_sections.strategic_recommendations.map((rec: string, idx: number) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Multi-Document Comparative Matrix */}
            {selectedReport.content?.comparative_matrix?.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-clario-navy text-xs uppercase tracking-wider">
                  Cross-Document Clause Comparison Matrix
                </h4>
                <div className="overflow-x-auto rounded-md border border-slate-200">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead className="bg-clario-navy text-white">
                      <tr>
                        <th className="p-2 font-semibold">Document</th>
                        <th className="p-2 font-semibold">Pages</th>
                        <th className="p-2 font-semibold">Liability</th>
                        <th className="p-2 font-semibold">Indemnity</th>
                        <th className="p-2 font-semibold">Breach SLA</th>
                        <th className="p-2 font-semibold">AI / Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {selectedReport.content.comparative_matrix.map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 font-semibold text-clario-navy">{row.document_title}</td>
                          <td className="p-2 tabular-nums text-slate-600">{row.pages}</td>
                          <td className="p-2 text-slate-700">{row.liability}</td>
                          <td className="p-2 text-slate-700">{row.indemnity}</td>
                          <td className="p-2 text-slate-700">{row.breach_sla}</td>
                          <td className="p-2 text-slate-700">{row.data_ai}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Knowledge Graph & Risk & Compliance Snapshots */}
            {(selectedReport.content?.graph_summary || selectedReport.content?.risk_summary || selectedReport.content?.compliance_summary) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {selectedReport.content?.graph_summary && (
                  <div className="p-3 rounded-md border border-slate-200 bg-slate-50 space-y-1">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-clario-navy">Knowledge Graph</p>
                    <p className="text-slate-700">
                      {selectedReport.content.graph_summary.total_documents} docs · {selectedReport.content.graph_summary.total_topics} topics · {selectedReport.content.graph_summary.total_edges} edges
                    </p>
                    {selectedReport.content.graph_summary.top_topics?.length > 0 && (
                      <p className="text-[11px] text-slate-500">
                        Core concepts: {selectedReport.content.graph_summary.top_topics.slice(0, 4).join(', ')}
                      </p>
                    )}
                  </div>
                )}
                {selectedReport.content?.risk_summary && (
                  <div className="p-3 rounded-md border border-slate-200 bg-slate-50 space-y-1">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-clario-navy">Portfolio Risk</p>
                    <p className="text-sm font-bold text-clario-navy tabular-nums">
                      {selectedReport.content.risk_summary.composite_score}/100 ({selectedReport.content.risk_summary.composite_grade})
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Scored across {selectedReport.content.risk_summary.documents?.length || 0} document(s)
                    </p>
                  </div>
                )}
                {selectedReport.content?.compliance_summary && (
                  <div className="p-3 rounded-md border border-slate-200 bg-slate-50 space-y-1">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-clario-navy">Compliance Readiness</p>
                    <p className="text-sm font-bold text-clario-navy tabular-nums">
                      {selectedReport.content.compliance_summary.overall_score}% Overall
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {selectedReport.content.compliance_summary.frameworks?.length || 0} frameworks evaluated
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Remediation Actions Playbook */}
            {selectedReport.content?.remediation_actions?.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-clario-navy text-xs uppercase tracking-wider">
                  Prioritized Remediation Playbook
                </h4>
                <div className="space-y-2">
                  {selectedReport.content.remediation_actions.map((act: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-md border border-slate-200 bg-white space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-clario-navy">{act.finding}</span>
                        <span className="text-[10px] font-bold uppercase text-rose-700">{act.severity} · {act.owner}</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed">{act.recommended_redline}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedReport.content?.findings_summary?.length > 0 && (
              <div>
                <h4 className="font-semibold text-clario-navy text-xs uppercase tracking-wider mb-2">
                  Contradiction & Risk Findings
                </h4>
                <div className="space-y-2">
                  {selectedReport.content.findings_summary.map((f: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-md border border-clario-border bg-white">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-clario-navy">[{f.category}] {f.title}</span>
                        <span className="text-[10px] font-bold uppercase text-amber-700 flex items-center gap-1 shrink-0">
                          <AlertTriangle className="w-3 h-3" />
                          {f.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-clario-text-secondary mb-1">Review status: {f.status}</p>
                      {f.evidence_a && <p className="text-xs text-slate-600">{f.evidence_a}</p>}
                      {f.evidence_b && <p className="text-xs text-slate-600 mt-1">{f.evidence_b}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedReport.content?.obligations_summary?.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-clario-navy text-xs uppercase tracking-wider">
                  Key Contractual Obligations & Windows
                </h4>
                <div className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
                  {selectedReport.content.obligations_summary.map((ob: any, idx: number) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between gap-3 text-[11px]">
                      <div>
                        <p className="font-semibold text-clario-navy">{ob.title}</p>
                        <p className="text-slate-500">{ob.document_title} · {ob.obligated_party}</p>
                      </div>
                      <span className="font-mono text-slate-700 shrink-0">{ob.due_date_or_window}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <section className="space-y-2">
              <h4 className="font-semibold text-clario-navy text-xs uppercase tracking-wider">Documents in this report</h4>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                {selectedReport.content?.documents_analyzed?.map((doc: any) => (
                  <li key={doc.id}>{doc.title} · {doc.pages} pages</li>
                ))}
              </ul>
            </section>
            {selectedReport.content?.comparisons?.map((item: any, index: number) => (
              <section key={index} className="space-y-1.5 border-t border-clario-border pt-3">
                <h4 className="font-semibold text-clario-navy">{item.title}</h4>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{item.summary}</p>
              </section>
            ))}
            {selectedReport.content?.source_excerpts?.map((item: any, index: number) => (
              <section key={index} className="space-y-2 border-t border-clario-border pt-3">
                <h4 className="font-semibold text-clario-navy">{item.document_title} · Page {item.page}</h4>
                <Markdown>{item.text}</Markdown>
              </section>
            ))}
            {selectedReport.content?.retrieval_runs?.map((item: any, index: number) => (
              <section key={index} className="space-y-1 border-t border-clario-border pt-3">
                <h4 className="font-semibold text-clario-navy">{item.query}</h4>
                <p>{item.mode} · {item.latency_ms} ms · {item.result_count} results</p>
              </section>
            ))}
            {selectedReport.content?.custom_notes && (
              <section className="space-y-2 border-t border-clario-border pt-3">
                <h4 className="font-semibold text-clario-navy">Reviewer notes</h4>
                <p className="text-xs whitespace-pre-wrap text-slate-700">{selectedReport.content.custom_notes}</p>
              </section>
            )}

            <div>
              <h4 className="font-semibold text-clario-navy text-xs uppercase tracking-wider mb-1">
                Methodology & Rigor
              </h4>
              <p className="text-[11px] text-clario-text-secondary leading-relaxed">
                {selectedReport.content?.methodology}
              </p>
            </div>

            <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
              <span className="font-semibold block mb-0.5">Report Scope & Verification Note:</span>
              {selectedReport.content?.limitations}
            </div>

            {/* Website-Style Branded Footer */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
              <span>© 2026 Clario • Document Intelligence Platform</span>
              <span>Verified Evidence Dossier</span>
            </div>
          </div>
        </Modal>
      )}

      {/* Website-Style Delete Report Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !deletingReport && setDeleteTarget(null)}
        title={deleteTarget?.type === 'all' ? 'Clear All Reports' : 'Delete Report'}
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            {deleteTarget?.type === 'all'
              ? 'Are you sure you want to clear all generated reports? This will remove all previous dossiers.'
              : `Are you sure you want to delete "${deleteTarget?.reportTitle || 'this report'}"? This action cannot be undone.`}
          </p>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              disabled={deletingReport}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={deletingReport}
              onClick={executeReportDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white border-transparent"
            >
              {deletingReport ? 'Deleting…' : deleteTarget?.type === 'all' ? 'Clear all reports' : 'Delete report'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
