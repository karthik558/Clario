import React, { useState, useMemo } from 'react';
import {
  BarChart2,
  BookOpen,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Layers,
  FileText,
  TrendingUp,
  Percent,
  Sliders
} from 'lucide-react';
import { WordAnalysisResponse, KeywordAnalysisItem } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

// Note: Strict adherence to constraint: NO SPARKLE ICONS USED ANYWHERE!

interface WordAnalysisVisualizerProps {
  data: WordAnalysisResponse;
  onRefresh?: () => void;
  className?: string;
}

export const WordAnalysisVisualizer: React.FC<WordAnalysisVisualizerProps> = ({
  data,
  onRefresh,
  className = ''
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordAnalysisItem | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    data.top_keywords.forEach((k) => set.add(k.category));
    return ['all', ...Array.from(set)];
  }, [data.top_keywords]);

  const filteredKeywords = useMemo(() => {
    return data.top_keywords.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim() && !item.word.toLowerCase().includes(searchQuery.toLowerCase().trim())) {
        return false;
      }
      return true;
    });
  }, [data.top_keywords, selectedCategory, searchQuery]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Metric Cards - Matching Overview and Documents design */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Total Word Volume
            </span>
            <div className="p-1.5 rounded bg-slate-100 text-slate-700">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {data.total_words.toLocaleString()}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Across {data.audited_documents_count} analyzed document(s)
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Unique Vocabulary
            </span>
            <div className="p-1.5 rounded bg-slate-100 text-slate-700">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {data.unique_words.toLocaleString()}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            {data.lexical_density_pct}% lexical richness ratio
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Readability Complexity
            </span>
            <div className="p-1.5 rounded bg-slate-100 text-slate-700">
              <Sliders className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {data.flesch_reading_ease}
          </span>
          <span className="text-[10px] text-slate-500 font-medium mt-1">
            {data.reading_level}
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Average Sentence Length
            </span>
            <div className="p-1.5 rounded bg-slate-100 text-slate-700">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
            {data.avg_sentence_length} wps
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Avg word: {data.avg_word_length} chars
          </span>
        </Card>
      </div>

      {/* Sentiment & Legal Polarity Distribution Bar */}
      <Card className="p-5 bg-white border border-slate-200 shadow-subtle rounded-md space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Contractual Sentiment & Covenants Polarity
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Corpus distribution of protective clauses, mandatory obligations, and liability exposures.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              Protective ({data.sentiment_breakdown.protective.pct}%)
            </span>
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block" />
              Obligations ({data.sentiment_breakdown.obligations.pct}%)
            </span>
            <span className="flex items-center gap-1.5 text-rose-600">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              Exposure ({data.sentiment_breakdown.exposure.pct}%)
            </span>
          </div>
        </div>

        {/* Visual Segmented Progress Bar */}
        <div className="w-full h-3.5 rounded-full overflow-hidden bg-slate-100 flex shadow-inner">
          <div
            className="h-full bg-emerald-500 hover:opacity-90 transition-all"
            style={{ width: `${data.sentiment_breakdown.protective.pct}%` }}
            title={`Protective Safeguards: ${data.sentiment_breakdown.protective.count} terms (${data.sentiment_breakdown.protective.pct}%)`}
          />
          <div
            className="h-full bg-slate-700 hover:opacity-90 transition-all"
            style={{ width: `${data.sentiment_breakdown.obligations.pct}%` }}
            title={`Mandatory Obligations: ${data.sentiment_breakdown.obligations.count} terms (${data.sentiment_breakdown.obligations.pct}%)`}
          />
          <div
            className="h-full bg-rose-500 hover:opacity-90 transition-all"
            style={{ width: `${data.sentiment_breakdown.exposure.pct}%` }}
            title={`Exposure & Risk Covenants: ${data.sentiment_breakdown.exposure.count} terms (${data.sentiment_breakdown.exposure.pct}%)`}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="p-3 rounded-md bg-emerald-50/50 border border-emerald-200/60 text-xs">
            <span className="font-bold text-emerald-900 block mb-1">Protective Safeguards</span>
            <span className="text-emerald-700 font-mono text-sm font-semibold">
              {data.sentiment_breakdown.protective.count.toLocaleString()} occurrences
            </span>
            <p className="text-[11px] text-emerald-800/80 mt-1 leading-relaxed">
              Warranties, intellectual property indemnification, regulatory remedies, and audit rights.
            </p>
          </div>

          <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-xs">
            <span className="font-bold text-slate-800 block mb-1">Contractual Obligations</span>
            <span className="text-slate-900 font-mono text-sm font-semibold">
              {data.sentiment_breakdown.obligations.count.toLocaleString()} occurrences
            </span>
            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
              Mandatory operational SLAs, reporting deadlines, notice covenants, and compliance duties.
            </p>
          </div>

          <div className="p-3 rounded-md bg-rose-50/50 border border-rose-200/60 text-xs">
            <span className="font-bold text-rose-900 block mb-1">Risk & Liability Exposures</span>
            <span className="text-rose-700 font-mono text-sm font-semibold">
              {data.sentiment_breakdown.exposure.count.toLocaleString()} occurrences
            </span>
            <p className="text-[11px] text-rose-800/80 mt-1 leading-relaxed">
              Liability caps, security incident escalation, termination triggers, and breach penalties.
            </p>
          </div>
        </div>
      </Card>

      {/* Interactive Word Cloud & Keyword Frequency Visualizer */}
      <Card className="p-5 bg-white border border-slate-200 shadow-subtle rounded-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Interactive Enterprise Keyword Cloud
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Click any term to inspect frequency density and relative corpus weight.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative w-44">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter keywords..."
                className="w-full text-xs pl-8 pr-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none bg-white text-slate-700"
              />
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-medium text-[10px] uppercase shrink-0 tracking-wider">
            Category:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded text-xs transition-colors shrink-0 ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white font-medium shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {cat === 'all' ? 'All Domains' : cat}
            </button>
          ))}
        </div>

        {/* Word Cloud Visualizer Chips */}
        <div className="flex flex-wrap items-center gap-2 p-4 bg-slate-50/70 rounded-md border border-slate-200 min-h-[140px]">
          {filteredKeywords.map((item) => {
            const isSelected = selectedKeyword?.word === item.word;
            const weight = item.relative_pct;

            // Compute size & shading based on relative frequency weight
            const sizeClass =
              weight >= 75
                ? 'text-sm font-bold px-3 py-1.5'
                : weight >= 45
                ? 'text-xs font-semibold px-2.5 py-1'
                : 'text-[11px] font-normal px-2 py-0.5';

            return (
              <button
                key={item.word}
                type="button"
                onClick={() => setSelectedKeyword(isSelected ? null : item)}
                className={`rounded-md transition-all flex items-center gap-1.5 border ${sizeClass} ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs ring-1 ring-slate-900'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                }`}
              >
                <span>{item.word}</span>
                <span
                  className={`text-[10px] font-mono px-1 rounded ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Focused Keyword Detail Callout */}
        {selectedKeyword && (
          <div className="p-3.5 bg-slate-50 rounded-md border border-slate-200 animate-in fade-in-50 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900 uppercase font-mono">
                  "{selectedKeyword.word}"
                </span>
                <Badge variant="navy" size="sm">
                  {selectedKeyword.category}
                </Badge>
              </div>
              <p className="text-slate-600">
                Appears <strong>{selectedKeyword.count.toLocaleString()} times</strong> across the audited corpus, accounting for <strong>{selectedKeyword.density_pct}%</strong> of total word volume.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedKeyword(null)}
              className="self-start sm:self-center text-xs"
            >
              Clear Selection
            </Button>
          </div>
        )}
      </Card>

      {/* Side-by-Side Document Comparative Breakdown Table */}
      {data.document_breakdowns.length > 0 && (
        <Card className="rounded-md p-0 overflow-hidden bg-white border border-slate-200 shadow-subtle">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Per-Document Lexical & Volume Breakdown
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Comparison of word counts, vocabulary density, and readability index per file.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Document Title</th>
                  <th className="py-3 px-3">Word Volume</th>
                  <th className="py-3 px-3">Unique Words</th>
                  <th className="py-3 px-3">Lexical Richness</th>
                  <th className="py-3 px-3">Readability Ease</th>
                  <th className="py-3 px-4">Dominant Keyword</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.document_breakdowns.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[260px]" title={doc.title}>
                          {doc.title}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700">
                      {doc.word_count.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700">
                      {doc.unique_words.toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-800 font-semibold">
                          {doc.lexical_density_pct}%
                        </span>
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-clario-navy rounded-full"
                            style={{ width: `${Math.min(100, doc.lexical_density_pct * 3)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700">
                      {doc.reading_ease} / 100
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="navy" size="sm">
                        {doc.top_keyword}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
