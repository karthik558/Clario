import { workspaceDate } from '../utils/date';
import { Select } from '../components/ui/Select';
import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  Search,
  Scan,
  ShieldCheck,
  ChevronRight,
  Clock,
  SearchCheck,
  Check,
  X,
  FileText
} from 'lucide-react';
import { api } from '../services/api';
import { FindingItem } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export const FindingsPage: React.FC = () => {
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesInput, setNotesInput] = useState('');

  const fetchFindings = async () => {
    setLoading(true);
    try {
      const data = await api.getFindings(categoryFilter, statusFilter, severityFilter);
      setFindings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFindings();
  }, [categoryFilter, statusFilter, severityFilter]);

  const handleStatusChange = async (findingId: string, newStatus: string) => {
    try {
      await api.updateFinding(findingId, { status: newStatus });
      fetchFindings();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveNotes = async (findingId: string) => {
    try {
      await api.updateFinding(findingId, { reviewer_notes: notesInput });
      setEditingNotesId(null);
      fetchFindings();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerScan = async () => {
    setScanning(true);
    try {
      await api.scanContradictions();
      await fetchFindings();
    } catch (err) {
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  const getCategoryBadgeVariant = (cat: string) => {
    switch (cat) {
      case 'possible_contradiction':
        return 'red';
      case 'agreement':
        return 'sage';
      case 'changed_obligation':
        return 'gold';
      default:
        return 'teal';
    }
  };

  const getStatusBadgeVariant = (st: string) => {
    switch (st) {
      case 'confirmed':
        return 'red';
      case 'resolved':
      case 'dismissed':
        return 'gray';
      case 'under_review':
        return 'gold';
      default:
        return 'teal';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-clario-text tracking-tight flex items-center space-x-2">
            <span>Reviewable Findings & Contradictions</span>
          </h2>
          <p className="text-xs text-clario-text-secondary">
            Human-in-the-loop review workflow for flagged inconsistencies, altered obligations, and policy changes
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleTriggerScan}
          loading={scanning}
        >
          <Scan className="w-4 h-4 mr-1.5" />
          {scanning ? 'Scanning Corpus...' : 'Run Contradiction Scan'}
        </Button>
      </div>

      {/* Filter Ribbon */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center space-x-1.5 text-clario-text-secondary">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-medium">Filter By:</span>
          </div>

          <Select
            aria-label="Finding status filter" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-white border border-clario-border rounded-md px-2.5 py-1.5 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="under_review">Under Review</option>
            <option value="confirmed">Confirmed</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </Select>

          <Select
            aria-label="Finding category" value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs bg-white border border-clario-border rounded-md px-2.5 py-1.5 focus:outline-none"
          >
            <option value="">All Categories</option>
            <option value="possible_contradiction">Possible Contradiction</option>
            <option value="agreement">Agreement</option>
            <option value="changed_obligation">Changed Obligation</option>
            <option value="outdated_statement">Outdated Statement</option>
            <option value="missing_coverage">Missing Coverage</option>
            <option value="needs_human_review">Needs Human Review</option>
          </Select>

          <Select
            aria-label="Finding severity" value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-xs bg-white border border-clario-border rounded-md px-2.5 py-1.5 focus:outline-none"
          >
            <option value="">All Severities</option>
            <option value="high">High Severity</option>
            <option value="medium">Medium Severity</option>
            <option value="low">Low Severity</option>
          </Select>

          <span className="text-[11px] text-clario-text-muted ml-auto">
            Showing {findings.length} finding(s)
          </span>
        </div>
      </Card>

      {/* Findings List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-xs text-clario-text-secondary">
            Loading reviewable findings...
          </div>
        ) : findings.length === 0 ? (
          <Card className="p-8 text-center bg-white">
            <ShieldCheck className="w-8 h-8 text-clario-sage mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-clario-text mb-1">No findings matching criteria</h4>
            <p className="text-xs text-clario-text-secondary max-w-sm mx-auto mb-3">
              Run an automated contradiction scan or modify filter selections.
            </p>
            <Button variant="outline" size="sm" onClick={handleTriggerScan}>
              Scan Corpus Now
            </Button>
          </Card>
        ) : (
          findings.map((f) => (
            <Card key={f.id} className="p-5 space-y-4">
              {/* Finding Title & Status Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-clario-border">
                <div className="flex items-center space-x-2.5">
                  <Badge variant={getCategoryBadgeVariant(f.category)} size="md">
                    {f.category.replace('_', ' ').toUpperCase()}
                  </Badge>
                  <h3 className="font-semibold text-sm text-clario-navy">{f.title}</h3>
                  <Badge variant={f.severity === 'high' ? 'red' : 'gold'} size="sm">
                    {f.severity.toUpperCase()}
                  </Badge>
                </div>

                {/* Status Dropdown */}
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-clario-text-secondary font-medium">Status:</span>
                  <Select
                    aria-label={`Review status for ${f.title}`} value={f.status}
                    onChange={(e) => handleStatusChange(f.id, e.target.value)}
                    className="text-xs bg-clario-ivory font-semibold text-clario-navy border border-clario-border rounded-md px-2.5 py-1 focus:outline-none cursor-pointer"
                  >
                    <option value="open">Open</option>
                    <option value="under_review">Under Review</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-clario-text leading-relaxed">
                {f.description}
              </p>

              {/* Evidence Attribution Side-by-Side */}
              {(f.doc_a_quote || f.doc_b_quote) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                  {f.doc_a_quote && (
                    <div className="p-3 rounded-md bg-clario-ivory border border-clario-border">
                      <span className="text-[10px] font-semibold text-clario-navy uppercase block mb-1">
                        Source A: {f.doc_a_title} {f.doc_a_page ? `(Page ${f.doc_a_page})` : ''}
                      </span>
                      <p className="text-[11px] text-clario-text leading-relaxed italic">
                        "{f.doc_a_quote}"
                      </p>
                    </div>
                  )}

                  {f.doc_b_quote && (
                    <div className="p-3 rounded-md bg-amber-50/50 border border-amber-200">
                      <span className="text-[10px] font-semibold text-amber-900 uppercase block mb-1">
                        Source B: {f.doc_b_title} {f.doc_b_page ? `(Page ${f.doc_b_page})` : ''}
                      </span>
                      <p className="text-[11px] text-amber-950 leading-relaxed italic">
                        "{f.doc_b_quote}"
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Reviewer Notes & Timestamp */}
              <div className="pt-3 border-t border-clario-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex-1">
                  {editingNotesId === f.id ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={notesInput}
                        onChange={(e) => setNotesInput(e.target.value)}
                        placeholder="Add human auditor evaluation notes..."
                        className="flex-1 text-xs px-2.5 py-1 border border-clario-border rounded-md bg-white focus:outline-none"
                      />
                      <button
                        onClick={() => handleSaveNotes(f.id)}
                        className="p-1 rounded bg-clario-teal text-white hover:bg-clario-teal-light"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingNotesId(null)}
                        className="p-1 rounded text-clario-text-secondary hover:text-clario-text"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-[11px] text-clario-text-secondary">
                      <span className="font-semibold text-clario-navy">Notes:</span>
                      <span className="italic">{f.reviewer_notes || 'No reviewer notes recorded.'}</span>
                      <button
                        onClick={() => {
                          setEditingNotesId(f.id);
                          setNotesInput(f.reviewer_notes || '');
                        }}
                        className="text-clario-teal hover:underline text-[10px]"
                      >
                        (Edit)
                      </button>
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-clario-text-muted shrink-0">
                  Recorded on {workspaceDate(f.created_at).toLocaleDateString()}
                </span>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
