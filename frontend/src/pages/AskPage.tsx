import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  Bookmark,
  Layers,
  Clock,
  AlertTriangle,
  FileText,
  ExternalLink,
  ChevronRight,
  Info,
  Copy,
  Check
} from 'lucide-react';
import { api } from '../services/api';
import { AskResponse, CitationItem, DocumentItem } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DocumentViewerModal } from '../components/documents/DocumentViewerModal';

export const AskPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [history, setHistory] = useState<Array<{ query: string; response: AskResponse }>>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [selectedCitation, setSelectedCitation] = useState<CitationItem | null>(null);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadDocs = async () => {
      try {
        const docs = await api.getDocuments();
        setDocuments(docs);
      } catch (err) {
        console.error(err);
      }
    };
    loadDocs();
  }, []);

  const handleAsk = async (userQuery?: string) => {
    const q = userQuery || query;
    if (!q.trim() || loading) return;

    setLoading(true);
    setResponse(null);
    try {
      const docIds = selectedDocIds.length > 0 ? selectedDocIds : undefined;
      const res = await api.ask(q, docIds, 5);
      setResponse(res);
      setHistory((prev) => [...prev, { query: q, response: res }]);
      setQuery('');
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const presets = [
    'What are the main differences between Data Retention v1 and v2?',
    'What limitation of liability caps appear in the service agreements?',
    'What conclusions do the differential privacy research papers reach?',
    'Do any uploaded documents contain conflicting notice or cure periods?'
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-clario-text tracking-tight flex items-center space-x-2">
            <span>Ask Clario</span>
            <Badge variant="teal" size="sm">Evidence-Based RAG</Badge>
          </h2>
          <p className="text-xs text-clario-text-secondary">
            Cross-document research assistant with transparent citations and zero-hallucination verification
          </p>
        </div>
      </div>

      {/* Scope Selector */}
      {documents.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-xl border border-clario-border text-xs">
          <span className="text-clario-text-secondary font-medium">Search Scope:</span>
          <button
            onClick={() => setSelectedDocIds([])}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              selectedDocIds.length === 0
                ? 'bg-clario-navy text-white'
                : 'bg-clario-ivory text-clario-text-secondary hover:bg-clario-ivory-muted'
            }`}
          >
            Entire Workspace ({documents.length} Docs)
          </button>
          {documents.map((d) => {
            const isSelected = selectedDocIds.includes(d.id);
            return (
              <button
                key={d.id}
                onClick={() => {
                  if (isSelected) {
                    setSelectedDocIds(selectedDocIds.filter((id) => id !== d.id));
                  } else {
                    setSelectedDocIds([...selectedDocIds, d.id]);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors truncate max-w-[200px] ${
                  isSelected
                    ? 'bg-clario-teal text-white font-medium'
                    : 'bg-clario-ivory text-clario-text-secondary hover:bg-clario-ivory-muted border border-clario-border'
                }`}
                title={d.title}
              >
                {d.title}
              </button>
            );
          })}
        </div>
      )}

      {/* Preset Starters */}
      {history.length === 0 && !response && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {presets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleAsk(p)}
              className="p-3.5 rounded-xl border border-clario-border bg-white hover:border-clario-teal/50 hover:bg-clario-ivory transition-all text-left group flex items-start space-x-3 shadow-subtle"
            >
              <Sparkles className="w-4 h-4 text-clario-gold shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium text-clario-text group-hover:text-clario-teal transition-colors">
                "{p}"
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Conversation Thread */}
      <div className="space-y-6">
        {history.map((item, idx) => (
          <div key={idx} className="space-y-4 animate-in fade-in">
            {/* User Question */}
            <div className="flex justify-end">
              <div className="bg-clario-navy text-white px-4 py-2.5 rounded-2xl rounded-tr-xs text-xs font-medium max-w-xl shadow-xs">
                {item.query}
              </div>
            </div>

            {/* Clario Answer */}
            <div className="bg-white rounded-2xl border border-clario-border p-6 shadow-subtle space-y-4">
              {/* Answer Header Bar */}
              <div className="flex items-center justify-between pb-3 border-b border-clario-border text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-md bg-clario-teal text-white flex items-center justify-center font-bold text-[10px]">
                    CL
                  </div>
                  <span className="font-semibold text-clario-navy">Clario Synthesized Answer</span>
                  <Badge variant="sage" size="sm">{item.response.mode}</Badge>
                </div>
                <div className="flex items-center space-x-3 text-clario-text-secondary">
                  <span className="text-[11px] font-mono flex items-center space-x-1 text-clario-teal">
                    <Clock className="w-3 h-3" />
                    <span>{item.response.retrieval_latency_ms}ms</span>
                  </span>
                  <button
                    onClick={() => handleCopy(item.response.answer)}
                    className="p-1 rounded text-clario-text-secondary hover:text-clario-text hover:bg-clario-ivory transition-colors"
                    title="Copy Answer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Contradiction Alert if detected */}
              {item.response.has_conflicting_evidence && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block mb-0.5">Divergent Terms Detected Across Sources</span>
                    <span className="text-[11px] text-amber-800 leading-relaxed">
                      {item.response.conflict_notes || 'Retrieved passages from differing documents state differing metrics or timelines.'}
                    </span>
                  </div>
                </div>
              )}

              {/* Formatted Markdown Content */}
              <div className="text-xs text-clario-text leading-relaxed whitespace-pre-line font-sans">
                {item.response.answer}
              </div>

              {/* Citations Grid */}
              {item.response.citations.length > 0 && (
                <div className="pt-4 border-t border-clario-border">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-semibold text-clario-navy uppercase tracking-wider flex items-center space-x-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-clario-gold" />
                      <span>Verified Citations ({item.response.citations.length})</span>
                    </span>
                    <span className="text-[10px] text-clario-text-muted">Click to open source page & passage</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {item.response.citations.map((cit) => (
                      <div
                        key={cit.citation_id}
                        onClick={() => setSelectedCitation(cit)}
                        className="p-3 rounded-xl border border-clario-border bg-clario-ivory/60 hover:border-clario-teal/50 hover:bg-clario-ivory transition-all cursor-pointer group flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center space-x-2 truncate">
                            <span className="w-4 h-4 rounded bg-clario-teal text-white text-[10px] flex items-center justify-center font-bold shrink-0">
                              {cit.citation_id}
                            </span>
                            <span className="font-semibold text-xs text-clario-navy truncate max-w-[180px]">
                              {cit.document_title}
                            </span>
                          </div>
                          <Badge variant="sage" size="sm">
                            Page {cit.page_number}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-clario-text-secondary line-clamp-2 italic leading-relaxed">
                          "{cit.snippet}"
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-clario-text-muted">
                          <span className="font-mono">Relevance: {cit.relevance_score}</span>
                          <span className="text-clario-teal font-medium group-hover:underline flex items-center space-x-1">
                            <span>View Passage</span>
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="bg-white rounded-2xl border border-clario-border p-6 shadow-subtle flex items-center space-x-3 text-xs text-clario-text-secondary animate-pulse">
            <Sparkles className="w-5 h-5 text-clario-teal animate-spin" />
            <span>Retrieving relevant passages and synthesizing evidence...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input Form Bar */}
      <Card className="sticky bottom-4 z-10 p-3 shadow-elevated border-clario-teal/30 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything about policies, contracts, findings, or research..."
            className="flex-1 text-xs px-3.5 py-2.5 rounded-lg border border-clario-border bg-clario-ivory focus:outline-none focus:border-clario-teal text-clario-text"
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!query.trim() || loading}
            loading={loading}
          >
            <Send className="w-4 h-4 mr-1.5" />
            Ask
          </Button>
        </form>
      </Card>

      {/* Source Citation Modal */}
      {selectedCitation && (
        <DocumentViewerModal
          documentId={selectedCitation.document_id}
          highlightChunkId={selectedCitation.chunk_id}
          highlightPage={selectedCitation.page_number}
          onClose={() => setSelectedCitation(null)}
        />
      )}
    </div>
  );
};
