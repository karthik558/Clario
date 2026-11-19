import { PageHeader } from '../components/layout/PageHeader';
import { workspaceDate } from '../utils/date';
import { Select } from '../components/ui/Select';
import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Plus,
  Calendar,
  SearchCheck,
  Layers,
  ShieldCheck,
  Eye,
  CheckCircle2,
  Trash2,
  BarChart2,
  BookOpen,
  FileCheck,
  Cpu,
  Loader2
} from 'lucide-react';
import { api } from '../services/api';
import { useBackgroundTasks } from '../context/BackgroundTaskContext';
import { ReportItem, DocumentItem, WordAnalysisResponse } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Markdown } from '../components/ui/Markdown';
import { Modal } from '../components/ui/Modal';
import { WordAnalysisVisualizer } from '../components/analytics/WordAnalysisVisualizer';

export const ReportsPage: React.FC = () => {
  const { startTask, activeTasks, setIsDrawerOpen } = useBackgroundTasks();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [wordAnalysis, setWordAnalysis] = useState<WordAnalysisResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'dossiers' | 'word_analysis'>('dossiers');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);

  const activeReportTask = activeTasks.find((t) => t.category === 'report');

  const [error, setError] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [reportType, setReportType] = useState('comparative');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [customNotes, setCustomNotes] = useState('');
  const [useAi, setUseAi] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [reportsData, docsData, wordData] = await Promise.all([
        api.getReports(),
        api.getDocuments(),
        api.getWordAnalysis().catch(() => null)
      ]);
      setReports(reportsData);
      setDocuments(docsData);
      if (wordData) setWordAnalysis(wordData);
      if (docsData.length > 0) {
        setSelectedDocIds(docsData.slice(0, 2).map((d) => d.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The report could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllReports = async () => {
    if (window.confirm('Are you sure you want to clear all generated reports? This will remove all previous dossiers.')) {
      setClearing(true);
      setError('');
      try {
        await api.clearAllReports();
        setReports([]);
        setSelectedReport(null);
      } catch (err) {
        setError('Failed to clear reports. Please try again.');
      } finally {
        setClearing(false);
      }
    }
  };

  const handleDeleteReport = async (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this report?')) {
      try {
        await api.deleteReport(reportId);
        if (selectedReport?.id === reportId) setSelectedReport(null);
        setReports(prev => prev.filter(r => r.id !== reportId));
      } catch (err) {
        setError('Could not delete report.');
      }
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
              Words Analyzed
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {wordAnalysis ? wordAnalysis.total_words.toLocaleString() : '—'}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Across {documents.length} verified file(s)
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Vocabulary Diversity
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {wordAnalysis ? `${wordAnalysis.lexical_density_pct}%` : '—'}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            {wordAnalysis ? `${wordAnalysis.unique_words.toLocaleString()} unique terms` : 'Vocabulary variety'}
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Readability Standard
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <BarChart2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {wordAnalysis ? `${wordAnalysis.flesch_reading_ease}` : '—'}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            {wordAnalysis ? wordAnalysis.reading_level : 'Complexity Index'}
          </span>
        </Card>
      </div>

      {/* View Switcher: Dossiers vs Word Analysis Studio */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('dossiers')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'dossiers'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Executive Dossiers</span>
            <Badge variant={activeTab === 'dossiers' ? 'navy' : 'gray'} size="sm">
              {reports.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('word_analysis')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'word_analysis'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Contract Word Analysis</span>
            <Badge variant={activeTab === 'word_analysis' ? 'navy' : 'gray'} size="sm">
              Visual Studio
            </Badge>
          </button>
        </div>
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

      {activeTab === 'word_analysis' && wordAnalysis ? (
        <WordAnalysisVisualizer data={wordAnalysis} onRefresh={fetchReports} />
      ) : (
        /* Reports Grid */
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
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="teal" size="sm">
                    {rep.report_type.replace('_', ' ').toUpperCase()}
                  </Badge>
                  {rep.pdf_available && (
                    <Badge variant="sage" size="sm">PDF Compiled</Badge>
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
                    onClick={(e) => handleDeleteReport(rep.id, e)}
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
      )}

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
              <option value="search_benchmark">Recorded Search Performance</option>
              <option value="research_dossier">Comprehensive Research Dossier</option>
            </Select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-900 uppercase mb-1">
              Document scope (none selected = all documents)
            </label>
            <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 rounded-md border border-slate-200 bg-slate-50">
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
              placeholder="e.g. Conducted ahead of 2024 compliance audit review."
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
              <span>Synthesize Executive Overview with AI (LLM Analysis)</span>
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
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-clario-border">
              <div>
                <Badge variant="teal" size="sm" className="mb-1">
                  {selectedReport.report_type.replace('_', ' ').toUpperCase()}
                </Badge>
                <p className="text-[11px] text-clario-text-secondary">
                  Compiled on {workspaceDate(selectedReport.created_at).toLocaleString()}
                </p>
              </div>

              {selectedReport.pdf_available && (
                <a
                  href={api.getReportDownloadUrl(selectedReport.id)}
                  download={`Clario_${selectedReport.title}.pdf`}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-clario-navy text-white rounded-md text-xs font-medium hover:bg-clario-navy-light shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </a>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-clario-navy text-xs uppercase tracking-wider mb-1">
                Executive Summary
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-md border border-slate-200">
                {selectedReport.executive_summary}
              </p>
            </div>

            {selectedReport.content?.findings_summary && (
              <div>
                <h4 className="font-semibold text-clario-navy text-xs uppercase tracking-wider mb-2">
                  Saved findings
                </h4>
                <div className="space-y-2">
                  {selectedReport.content.findings_summary.map((f: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-md border border-clario-border bg-white">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-clario-navy">[{f.category}] {f.title}</span>
                        <Badge variant={f.severity === 'high' ? 'red' : 'gold'} size="sm">{f.severity}</Badge>
                      </div>
                      <p className="text-xs text-clario-text-secondary">Review status: {f.status}</p>
                      {f.evidence_a && <p className="text-sm text-clario-text-secondary">{f.evidence_a}</p>}
                      {f.evidence_b && <p className="text-sm text-clario-text-secondary">{f.evidence_b}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <section className="space-y-2">
              <h4 className="font-semibold text-clario-navy">Documents in this report</h4>
              <ul className="list-disc pl-5 space-y-1">{selectedReport.content?.documents_analyzed?.map((doc: any) => <li key={doc.id}>{doc.title} · {doc.pages} pages</li>)}</ul>
            </section>
            {selectedReport.content?.source_excerpts?.map((item: any, index: number) => <section key={index} className="space-y-2 border-t border-clario-border pt-4"><h4 className="font-semibold text-clario-navy">{item.document_title} · Page {item.page}</h4><Markdown>{item.text}</Markdown></section>)}
            {selectedReport.content?.comparisons?.map((item: any, index: number) => <section key={index} className="space-y-2 border-t border-clario-border pt-4"><h4 className="font-semibold text-clario-navy">{item.title}</h4><p className="text-sm leading-relaxed">{item.summary}</p></section>)}
            {selectedReport.content?.retrieval_runs?.map((item: any, index: number) => <section key={index} className="space-y-1 border-t border-clario-border pt-3"><h4 className="font-semibold text-clario-navy">{item.query}</h4><p>{item.mode} · {item.latency_ms} ms · {item.result_count} results</p></section>)}
            {selectedReport.content?.custom_notes && <section className="space-y-2 border-t border-clario-border pt-4"><h4 className="font-semibold text-clario-navy">Reviewer notes</h4><p className="text-sm whitespace-pre-wrap">{selectedReport.content.custom_notes}</p></section>}

            <div>
              <h4 className="font-semibold text-clario-navy text-xs uppercase tracking-wider mb-1">
                Methodology & Rigor
              </h4>
              <p className="text-[11px] text-clario-text-secondary leading-relaxed">
                {selectedReport.content?.methodology}
              </p>
            </div>

            <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
              <span className="font-semibold block mb-0.5">Academic Limitations:</span>
              {selectedReport.content?.limitations}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
