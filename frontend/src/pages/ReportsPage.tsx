import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Plus,
  Calendar,
  Sparkles,
  Layers,
  ShieldCheck,
  Eye,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';
import { ReportItem, DocumentItem } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

export const ReportsPage: React.FC = () => {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [reportType, setReportType] = useState('comparative');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [customNotes, setCustomNotes] = useState('');

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
        setSelectedDocIds(docsData.slice(0, 2).map((d) => d.id));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setGenerating(true);
    try {
      await api.createReport({
        title,
        report_type: reportType,
        document_ids: selectedDocIds,
        custom_notes: customNotes
      });
      setShowGenerateModal(false);
      setTitle('');
      setCustomNotes('');
      fetchReports();
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-clario-text tracking-tight flex items-center space-x-2">
            <span>Intelligence Reports & Dossiers</span>
            <Badge variant="navy" size="sm">PDF Export Ready</Badge>
          </h2>
          <p className="text-xs text-clario-text-secondary">
            Generate publication-quality executive summaries, comparative audits, and methodology reports
          </p>
        </div>

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

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <span>{new Date(rep.created_at).toLocaleDateString()}</span>
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedReport(rep)}
                    className="p-1.5 rounded text-clario-text-secondary hover:text-clario-teal hover:bg-clario-ivory transition-colors"
                    title="View Interactive Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {rep.pdf_available && (
                    <a
                      href={api.getReportDownloadUrl(rep.id)}
                      download={`Clario_${rep.title}.pdf`}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-clario-navy text-white hover:bg-clario-navy-light text-[11px] font-medium transition-colors shadow-xs"
                      title="Download PDF"
                    >
                      <Download className="w-3 h-3" />
                      <span>PDF</span>
                    </a>
                  )}
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
          <div>
            <label className="block text-[11px] font-semibold text-clario-navy uppercase mb-1">
              Report Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full text-xs px-3 py-2 rounded-lg border border-clario-border bg-white focus:outline-none focus:border-clario-teal"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-clario-navy uppercase mb-1">
              Report Template Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-clario-border bg-white focus:outline-none focus:border-clario-teal"
            >
              <option value="comparative">Comparative Version Analysis</option>
              <option value="summary">Document Intelligence Summary</option>
              <option value="contradictions">Contradiction & Compliance Findings</option>
              <option value="search_benchmark">Search & Retrieval Benchmark Report</option>
              <option value="research_dossier">Comprehensive Research Dossier</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-clario-navy uppercase mb-1">
              Scope (Select Analysed Documents)
            </label>
            <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 rounded-lg border border-clario-border bg-clario-ivory">
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
                      className="rounded text-clario-teal focus:ring-clario-teal"
                    />
                    <span className="text-xs text-clario-text truncate">{d.title}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-clario-navy uppercase mb-1">
              Custom Auditor Notes / Context
            </label>
            <textarea
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Conducted ahead of 2024 compliance audit review."
              className="w-full text-xs px-3 py-2 rounded-lg border border-clario-border bg-white focus:outline-none focus:border-clario-teal"
            />
          </div>

          <div className="pt-3 border-t border-clario-border flex justify-end space-x-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setShowGenerateModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={generating}>
              {generating ? 'Compiling PDF...' : 'Compile Report & PDF'}
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
                  Compiled on {new Date(selectedReport.created_at).toLocaleString()}
                </p>
              </div>

              {selectedReport.pdf_available && (
                <a
                  href={api.getReportDownloadUrl(selectedReport.id)}
                  download={`Clario_${selectedReport.title}.pdf`}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-clario-navy text-white rounded-lg text-xs font-medium hover:bg-clario-navy-light shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download ReportLab PDF</span>
                </a>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-clario-navy text-xs uppercase tracking-wider mb-1">
                Executive Summary
              </h4>
              <p className="text-xs text-clario-text leading-relaxed bg-clario-ivory p-3.5 rounded-xl border border-clario-border">
                {selectedReport.executive_summary}
              </p>
            </div>

            {selectedReport.content?.findings_summary && (
              <div>
                <h4 className="font-semibold text-clario-navy text-xs uppercase tracking-wider mb-2">
                  Verified Evidence Findings
                </h4>
                <div className="space-y-2">
                  {selectedReport.content.findings_summary.map((f: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg border border-clario-border bg-white">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-clario-navy">[{f.category}] {f.title}</span>
                        <Badge variant={f.severity === 'high' ? 'red' : 'gold'} size="sm">{f.severity}</Badge>
                      </div>
                      {f.evidence_a && <p className="text-[11px] text-clario-text-secondary italic">"{f.evidence_a}"</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="font-semibold text-clario-navy text-xs uppercase tracking-wider mb-1">
                Methodology & Rigor
              </h4>
              <p className="text-[11px] text-clario-text-secondary leading-relaxed">
                {selectedReport.content?.methodology}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
              <span className="font-semibold block mb-0.5">Academic Limitations:</span>
              {selectedReport.content?.limitations}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
