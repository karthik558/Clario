import { PageHeader } from '../components/layout/PageHeader';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Filter,
  FileText,
  Search,
  Scan,
  Shield,
  Layers,
  Download
} from 'lucide-react';
import { api } from '../services/api';
import { useBackgroundTasks } from '../context/BackgroundTaskContext';
import { ObligationItem, DocumentItem } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';

export const ObligationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { startTask } = useBackgroundTasks();
  const [obligations, setObligations] = useState<ObligationItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchObligations = async (docIds: string[] = selectedDocIds) => {
    try {
      setLoading(true);
      setError('');
      const [oblRes, docs] = await Promise.all([
        api.getObligations(undefined, undefined, docIds.length ? docIds : undefined),
        api.getDocuments().catch(() => [])
      ]);
      setObligations(oblRes.items);
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load obligations', err);
      setError('Could not load obligations from the workspace. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchObligations();
  }, []);

  const handleSelectDoc = (docId: string | null) => {
    const next = docId === null
      ? []
      : selectedDocIds.includes(docId)
      ? selectedDocIds.filter((id) => id !== docId)
      : [...selectedDocIds, docId];
    setSelectedDocIds(next);
    fetchObligations(next);
  };

  const handleScan = async (docIds: string[] = selectedDocIds) => {
    try {
      setScanning(true);
      setError('');
      const scopeLabel = docIds.length > 0 ? `${docIds.length} selected doc(s)` : 'All Workspace Docs';
      const res = await startTask<{ total: number; items: ObligationItem[] }>({
        title: 'Extract Corpus Obligations',
        category: 'scan',
        targetScope: scopeLabel,
        route: '/obligations',
        initialStage: 'Scanning contractual covenants & notice deadlines...',
        executor: async (updateProgress) => {
          updateProgress(25, 'Parsing notice periods and renewal cutoffs...', `Scanning ${scopeLabel}`);
          const result = await api.scanObligations(docIds.length ? docIds : undefined);
          updateProgress(100, 'Obligations extracted', `Found ${result.total} contractual obligations`);
          return result;
        },
      });
      setObligations(res.items);
    } catch (err) {
      console.error('Obligation scan failed', err);
      setError('Obligation extraction failed. Ensure documents are indexed and retry.');
    } finally {
      setScanning(false);
    }
  };

  const exportCalendarHref = (() => {
    const params = new URLSearchParams();
    if (categoryFilter) params.set('category', categoryFilter);
    if (riskFilter) params.set('risk', riskFilter);
    if (selectedDocIds.length > 0) params.set('document_ids', selectedDocIds.join(','));
    const qs = params.toString();
    return `/api/obligations/export-calendar${qs ? `?${qs}` : ''}`;
  })();

  const filteredObligations = obligations.filter((o) => {
    if (categoryFilter && o.category !== categoryFilter) return false;
    if (riskFilter && o.risk_level.toLowerCase() !== riskFilter.toLowerCase()) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        o.title.toLowerCase().includes(q) ||
        o.clause_quote.toLowerCase().includes(q) ||
        o.document_title.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const criticalCount = obligations.filter(
    (o) => o.risk_level === 'Critical' || o.risk_level === 'High'
  ).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader title="Obligations timeline" description="Track commitments, renewal dates, and notice periods across documents.">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/renewal-planner')}
            className="flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Renewal Planner</span>
          </Button>
          <a
            href={exportCalendarHref}
            download="clario-contract-obligations.ics"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-xs"
            title="Download iCalendar (.ics) file to sync with Google Calendar, Outlook, or Apple Calendar"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export Calendar (.ics)</span>
          </a>
          <Button
            size="sm"
            onClick={() => handleScan()}
            loading={scanning}
            className="flex items-center gap-1.5"
          >
            <Scan className="w-3.5 h-3.5" />
            <span>{scanning ? 'Extracting Obligations...' : 'Extract Corpus Obligations'}</span>
          </Button>
        </div>
      </PageHeader>

      {error && (
        <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* KPI Stat Ribbon matching Overview and Documents */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Active Obligations
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {obligations.length}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Across all documents
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              High Risk / Deadlines
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {criticalCount}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Action required
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Notice Windows
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {obligations.filter((o) => o.category === 'Termination & Notice').length}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Auto-renewal gates
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Audited Documents
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {documents.length}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Contractual scope
          </span>
        </Card>
      </div>

      {/* Filter & Search Toolbar */}
      <Card className="p-4 bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center space-x-1.5 text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-semibold uppercase tracking-wider text-[10px]">Filter:</span>
          </div>

          {documents.length > 0 && (
            <Select
              aria-label="Filter by document"
              value={selectedDocIds[0] || ''}
              onChange={(e) => handleSelectDoc(e.target.value || null)}
              className="text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1.5 max-w-[220px]"
            >
              <option value="">All Documents ({documents.length})</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          )}

          <Select
            aria-label="Filter by obligation category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1.5"
          >
            <option value="">All Categories</option>
            <option value="Termination & Notice">Termination & Notice</option>
            <option value="Data & Privacy">Data & Privacy</option>
            <option value="Financial & Payment">Financial & Payment</option>
            <option value="Audit & Inspection">Audit & Inspection</option>
            <option value="Service Level (SLA)">Service Level (SLA)</option>
          </Select>

          <Select
            aria-label="Filter by risk level"
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1.5"
          >
            <option value="">All Risk Levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>

          <div className="relative ml-auto w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search obligations or clauses..."
              className="text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 w-full bg-white text-slate-900"
            />
          </div>
        </div>
      </Card>

      {/* Timeline Stream */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">
            Parsing contractual covenants and deadline timelines...
          </div>
        ) : filteredObligations.length === 0 ? (
          <Card className="p-10 text-center bg-white border border-slate-200">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800 mb-1">
              {documents.length === 0 ? 'No Documents in Workspace' : 'No Obligations Discovered'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              {documents.length === 0
                ? 'Upload contractual agreements or master service agreements in the Document Library to extract renewal windows, notice deadlines, and recurring covenants.'
                : 'No obligations matching the current filters were found in your indexed documents.'}
            </p>
            {documents.length === 0 && (
              <Button variant="secondary" size="sm" onClick={() => navigate('/documents')}>
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                Go to Document Library
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-slate-200 sm:before:left-7">
            {filteredObligations.map((obl, idx) => (
              <div key={obl.id} className="relative flex items-start gap-4 sm:gap-6 pl-2 sm:pl-3">
                {/* Timeline Dot */}
                <div
                  className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-white flex items-center justify-center shrink-0 z-10 shadow-xs ${
                    obl.risk_level === 'Critical'
                      ? 'bg-rose-600 text-white'
                      : obl.risk_level === 'High'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-white'
                  }`}
                >
                  <span className="text-[10px] font-bold font-mono">{idx + 1}</span>
                </div>

                {/* Obligation Card */}
                <Card className="flex-1 p-4 sm:p-5 bg-white border border-slate-200 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900">{obl.title}</span>
                      <Badge
                        variant={
                          obl.risk_level === 'Critical'
                            ? 'red'
                            : obl.risk_level === 'High'
                            ? 'gold'
                            : 'sage'
                        }
                        size="sm"
                      >
                        {obl.risk_level.toUpperCase()}
                      </Badge>
                      <Badge variant="navy" size="sm">
                        {obl.category}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded-md font-medium text-slate-700">
                        {obl.due_date_or_window}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs font-mono text-slate-900 bg-slate-50 p-3 rounded-md border border-slate-200 leading-relaxed whitespace-pre-wrap">
                    "{obl.clause_quote}"
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1">
                    <div className="flex items-center gap-3">
                      <span>
                        <strong className="text-slate-900">Obligated Party:</strong>{' '}
                        {obl.obligated_party}
                      </span>
                      <span>•</span>
                      <span>
                        <strong className="text-slate-900">Trigger:</strong>{' '}
                        {obl.trigger_condition}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-700">
                      <FileText className="w-3.5 h-3.5 text-slate-600" />
                      <span className="font-semibold text-slate-900">{obl.document_title}</span>
                      <span className="text-slate-500 font-mono text-[11px]">Page {obl.page_number}</span>
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
