import { PageHeader } from '../components/layout/PageHeader';
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Scale,
  Copy,
  Check,
  Shield,
  FileText,
  AlertTriangle,
  BookmarkCheck,
  ArrowRight,
  Layers,
  RotateCcw,
  Download,
  Mail,
  TrendingUp,
  Sliders,
  ChevronRight,
  Cpu,
  Target,
  Briefcase,
  GitPullRequest,
  CheckCheck
} from 'lucide-react';
import { api } from '../services/api';
import { useBackgroundTasks } from '../context/BackgroundTaskContext';
import { FindingItem, DocumentItem, NegotiateResponse } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';

type StanceType = 'balanced' | 'customer_protective' | 'vendor_favorable' | 'strict_compliance';

type CounterpartyProfile = 'monopoly' | 'balanced' | 'vendor';

interface PlaybookTier {
  tier: 1 | 2 | 3;
  name: string;
  badge: string;
  badgeColor: 'navy' | 'sage' | 'gold';
  clause: string;
  rationale: string;
  giveawayRisk: string;
  counterResistance: number;
}

const STANCES: { id: StanceType; label: string; desc: string }[] = [
  { id: 'balanced', label: 'Balanced Compromise', desc: 'Equal burden sharing, industry-standard mutual terms' },
  { id: 'customer_protective', label: 'Customer Protective', desc: 'Prioritizes customer liability caps, audit rights, and remedies' },
  { id: 'vendor_favorable', label: 'Vendor Favorable', desc: 'Protects IP, limits warranties, standard service disclaimers' },
  { id: 'strict_compliance', label: 'Strict Compliance', desc: 'Zero regulatory exposure, mandatory auditability and breach notices' },
];

const COUNTERPARTY_CONFIGS: Record<CounterpartyProfile, {
  label: string;
  tagline: string;
  resistanceBaseline: number;
  expectedObjection: string;
  recommendedPivot: string;
  tiers: (topic: string, baseA: string, baseB: string) => PlaybookTier[];
}> = {
  monopoly: {
    label: 'Enterprise Monopolist',
    tagline: 'Dominant market incumbent with rigid legal terms and high walk-away tolerance',
    resistanceBaseline: 82,
    expectedObjection: 'Counterparty counsel typically issues standard form rejection for custom indemnification caps, citing global corporate underwriting guidelines.',
    recommendedPivot: 'Offer mutual aggregate limitation pegged to 2x trailing 12-month contract value with carve-outs strictly bounded to deliberate breach of confidentiality.',
    tiers: (_topic, _baseA, _baseB) => [
      {
        tier: 1,
        name: 'Opening Anchor (Aggressive)',
        badge: 'Target Position',
        badgeColor: 'navy',
        clause: `Notwithstanding any provision to the contrary, in no event shall Customer's total cumulative liability under this Agreement exceed the total fees paid or payable by Customer in the preceding twelve (12) months. Service Provider shall unconditionally defend, indemnify, and hold harmless Customer against all third-party claims arising from security incidents or data breaches without monetary limitation.`,
        rationale: 'Establishes a firm customer-favorable boundary before expected counterparty redlining.',
        giveawayRisk: 'Likely immediate pushback; counterparty will refuse uncapped security indemnity.',
        counterResistance: 88,
      },
      {
        tier: 2,
        name: 'Market Compromise (Reciprocal)',
        badge: 'Recommended Deal-Closer',
        badgeColor: 'sage',
        clause: `Except for claims arising from gross negligence, willful misconduct, or unauthorized disclosure of confidential data, each party's maximum aggregate liability shall not exceed two times (2x) the amounts paid by Customer during the twelve (12) months prior to the incident giving rise to liability. Mutual indemnification applies to intellectual property infringement and gross confidentiality violations.`,
        rationale: 'Acceptable standard for Fortune 500 SaaS and enterprise procurement; establishes reciprocal safeguards.',
        giveawayRisk: 'Moderate concession on non-material operational errors.',
        counterResistance: 42,
      },
      {
        tier: 3,
        name: 'Walk-Away Floor (Defensive Minima)',
        badge: 'Absolute Floor',
        badgeColor: 'gold',
        clause: `Subject to applicable law, each party's aggregate liability under this Agreement shall be limited to one times (1x) the fees paid by Customer during the prior twelve (12) months. Neither party shall be liable for indirect, punitive, or consequential damages; provided, however, that neither party disclaims liability for direct damages arising from statutory data breach notification obligations.`,
        rationale: 'Lowest tolerable commercial threshold; guarantees statutory compliance while conceding consequential damages.',
        giveawayRisk: 'Limits recovery for extended downtime or vendor security lapses.',
        counterResistance: 15,
      },
    ],
  },
  balanced: {
    label: 'Balanced Commercial Peer',
    tagline: 'Equal bargaining power seeking clean execution and rapid mutual close',
    resistanceBaseline: 45,
    expectedObjection: 'Counterparty will request symmetry in indemnity obligations and a balanced 30-day cure window prior to material breach termination.',
    recommendedPivot: 'Grant reciprocal indemnity for IP and IP infringement while binding both parties to 30-day notice and cure requirements.',
    tiers: (_topic, _baseA, _baseB) => [
      {
        tier: 1,
        name: 'Opening Anchor (Strategic Edge)',
        badge: 'Target Position',
        badgeColor: 'navy',
        clause: `Each party agrees to hold harmless the other for direct claims arising from breach of material warranties. Vendor warrants 99.9% uptime availability and guarantees SLA fee credits calculated as 10% of monthly subscription fees per hour of unplanned outage exceeding SLA boundaries.`,
        rationale: 'Strong uptime guarantee and financial remedy structure.',
        giveawayRisk: 'Counterparty will negotiate downtime credit thresholds.',
        counterResistance: 55,
      },
      {
        tier: 2,
        name: 'Market Compromise (Balanced Equity)',
        badge: 'Recommended Deal-Closer',
        badgeColor: 'sage',
        clause: `The parties mutually agree that aggregate liability for all claims arising out of or related to this Agreement shall be capped at 1.5x the total fees paid or payable by Customer in the 12-month period preceding the claim. Both parties commit to standard commercial best efforts, 30-day written notice and cure periods, and reciprocal IP defense covenants.`,
        rationale: 'Clean bilateral compromise minimizing legal friction and executive escalation.',
        giveawayRisk: 'Balanced and equitable burden sharing.',
        counterResistance: 22,
      },
      {
        tier: 3,
        name: 'Walk-Away Floor (Pragmatic Minimum)',
        badge: 'Absolute Floor',
        badgeColor: 'gold',
        clause: `Total liability of either party shall be capped at 100% of fees paid during the contract term. Standard mutual limitations on consequential damages apply, excluding deliberate confidentiality breaches.`,
        rationale: 'Quick-close baseline for low-risk transactional agreements.',
        giveawayRisk: 'Limits upside protection in worst-case vendor failure scenarios.',
        counterResistance: 8,
      },
    ],
  },
  vendor: {
    label: 'Motivated Challenger / Vendor',
    tagline: 'Fast-growing high-velocity provider highly incentivized to win business',
    resistanceBaseline: 25,
    expectedObjection: 'Minor hesitance regarding unlimited liquidated damages or non-standard bespoke audit frequency.',
    recommendedPivot: 'Accept annual third-party SOC 2 Type II audit report delivery in lieu of on-premises intrusive audits.',
    tiers: (_topic, _baseA, _baseB) => [
      {
        tier: 1,
        name: 'Opening Anchor (Full Enterprise Security)',
        badge: 'Target Position',
        badgeColor: 'navy',
        clause: `Vendor covenants to provide Customer with unconditional 24/7 dedicated support, 99.95% availability SLA with compound credits, annual on-site security audit access, and full indemnity for any regulatory fines or incident response expenses caused by Vendor's infrastructure.`,
        rationale: 'Extracts premium enterprise governance terms from hungry challenger vendor.',
        giveawayRisk: 'Vendor legal team may request annual audit expense reimbursement.',
        counterResistance: 38,
      },
      {
        tier: 2,
        name: 'Market Compromise (Optimal Alignment)',
        badge: 'Recommended Deal-Closer',
        badgeColor: 'sage',
        clause: `Vendor provides quarterly SOC 2 Type II audit reporting, 99.9% uptime SLA with monthly credits, 72-hour security incident notification SLA, and mutual liability cap set at 2x annual contract value, with carve-outs for data security and confidentiality breaches.`,
        rationale: 'High operational compliance with zero friction for fast signing.',
        giveawayRisk: 'Negligible; vendor happily accepts standard enterprise terms.',
        counterResistance: 12,
      },
      {
        tier: 3,
        name: 'Walk-Away Floor (Commercial Comfort)',
        badge: 'Absolute Floor',
        badgeColor: 'gold',
        clause: `Vendor delivers annual third-party security certifications and maintains $2,000,000 cyber-liability policy naming Customer as additional insured, with liability capped at 12 months fees paid.`,
        rationale: 'Ensures insurance backing even if direct corporate balance sheet is small.',
        giveawayRisk: 'Adequate backstop via cyber insurance policy.',
        counterResistance: 5,
      },
    ],
  },
};

export const NegotiatePage: React.FC = () => {
  const { startTask, getLatestTask } = useBackgroundTasks();
  const [resultSubTab, setResultSubTab] = useState<'redline' | 'playbook' | 'rationale'>('redline');
  const [counterparty, setCounterparty] = useState<CounterpartyProfile>('monopoly');
  const [selectedTierIndex, setSelectedTierIndex] = useState<number>(1);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const [findings, setFindings] = useState<FindingItem[]>([]);

  const uniqueFindings = useMemo<FindingItem[]>(() => {
    const seen = new Set<string>();
    return findings.filter((f: FindingItem) => {
      const key = f.title.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [findings]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedFindingId, setSelectedFindingId] = useState<string>('');

  const [topic, setTopic] = useState('');
  const [statementA, setStatementA] = useState('');
  const [statementB, setStatementB] = useState('');
  const [docATitle, setDocATitle] = useState('');
  const [docBTitle, setDocBTitle] = useState('');

  const [stance, setStance] = useState<StanceType>('balanced');
  const [customInstructions, setCustomInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NegotiateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedNotes, setSavedNotes] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [useAi, setUseAi] = useState(false);
  const [diffViewMode, setDiffViewMode] = useState<'clean' | 'markup'>('markup');
  const [stampedMessage, setStampedMessage] = useState<string | null>(null);
  const location = useLocation();

  const deviationPercent = React.useMemo(() => {
    const base = (statementA || statementB).trim();
    const proposed = result?.proposed_clause || '';
    if (!base || !proposed) return 0;
    const bWords = base.toLowerCase().split(/\s+/).filter(Boolean);
    const pWords = proposed.toLowerCase().split(/\s+/).filter(Boolean);
    const bSet = new Set(bWords);
    const pSet = new Set(pWords);
    const intersect = [...bSet].filter((w) => pSet.has(w)).length;
    const union = new Set([...bWords, ...pWords]).size;
    if (!union) return 0;
    const sim = intersect / union;
    return Math.max(0, Math.min(100, Math.round((1 - sim) * 100)));
  }, [statementA, statementB, result?.proposed_clause]);

  const handleStampTier = (tier: PlaybookTier) => {
    if (!result) return;
    setResult({
      ...result,
      proposed_clause: tier.clause,
      rationale: `Stamped from Playbook Tier ${tier.tier} (${tier.name}): ${tier.rationale}`,
    });
    setResultSubTab('redline');
    setStampedMessage(`Stamped Tier ${tier.tier} (${tier.name}) into active redline!`);
    setTimeout(() => setStampedMessage(null), 3000);
  };

  useEffect(() => {
    if (location.hash) {
      const elementId = location.hash.replace('#', '');
      const timer = setTimeout(() => {
        const el = document.getElementById(elementId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-slate-900', 'ring-offset-2', 'transition-all');
          setTimeout(() => {
            el.classList.remove('ring-2', 'ring-slate-900', 'ring-offset-2');
          }, 3500);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [location.hash, result]);

  const handleExportDocx = async () => {
    if (!result) return;
    try {
      setExportingDocx(true);
      const res = await fetch('/api/negotiate/export-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: result.topic || topic || 'Contract Provision',
          stance: result.stance || stance,
          doc_a_title: docATitle || 'Document A',
          doc_b_title: docBTitle || 'Document B',
          statement_a: statementA,
          statement_b: statementB,
          proposed_clause: result.proposed_clause,
          rationale: result.rationale,
          risk_level: result.risk_level,
          key_concessions: result.key_concessions,
        })
      });
      if (!res.ok) throw new Error('Failed to generate docx');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clario-redline-${(result.topic || 'clause').toLowerCase().replace(/\s+/g, '-')}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to export docx', err);
    } finally {
      setExportingDocx(false);
    }
  };

  useEffect(() => {
    Promise.all([
      api.getFindings().catch(() => []),
      api.getDocuments().catch(() => []),
    ]).then(([fList, dList]) => {
      setFindings(fList);
      setDocuments(dList);
      if (fList.length > 0) {
        applyFinding(fList[0]);
      } else if (dList.length > 0) {
        setDocATitle(dList[0].title);
        if (dList.length > 1) {
          setDocBTitle(dList[1].title);
        }
      }
      const cached = getLatestTask('redline');
      if (cached?.status === 'completed' && cached.result) {
        setResult(cached.result);
      } else if (cached?.status === 'running') {
        setLoading(true);
      }
    });
  }, []);

  const applyFinding = (f: FindingItem) => {
    setSelectedFindingId(f.id);
    setTopic(f.title);
    setStatementA(f.doc_a_quote || f.description || '');
    setStatementB(f.doc_b_quote || '');
    setDocATitle(f.doc_a_title || 'Document A');
    setDocBTitle(f.doc_b_title || 'Document B');
  };

  const handleSelectFinding = (findingId: string) => {
    setSelectedFindingId(findingId);
    if (!findingId) return;
    const found = findings.find(f => f.id === findingId);
    if (found) applyFinding(found);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    setSavedNotes(false);
    try {
      const res = await startTask<NegotiateResponse>({
        title: useAi ? `AI Redline: ${topic || 'Clause Harmonization'}` : `Redline: ${topic || 'Clause'}`,
        category: 'redline',
        targetScope: `${docATitle || 'Doc A'} vs ${docBTitle || 'Doc B'}`,
        route: '/negotiate#synthesis-result',
        initialStage: `Harmonizing ${topic || 'provision'} (${stance})...`,
        executor: async (updateProgress) => {
          updateProgress(25, 'Analyzing conflicting statements...', `Comparing ${docATitle || 'Doc A'} against ${docBTitle || 'Doc B'}`);
          await new Promise((r) => setTimeout(r, 350));
          if (useAi) {
            updateProgress(65, 'Synthesizing compromise redline with AI...', `Applying ${stance} stance guidelines`);
          } else {
            updateProgress(65, 'Harmonizing terms & applying bargaining posture...', `Applying ${stance} stance guidelines`);
          }
          const negRes = await api.negotiateClause({
            statement_a: statementA,
            statement_b: statementB,
            stance,
            custom_instructions: customInstructions || undefined,
            topic,
            doc_a_title: docATitle,
            doc_b_title: docBTitle,
            finding_id: selectedFindingId || undefined,
            use_ai: useAi,
          });
          await new Promise((r) => setTimeout(r, 250));
          updateProgress(100, 'Redline clause drafted', 'Harmonized compromise ready');
          return negRes;
        },
      });
      setResult(res);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setError(err?.message || 'Failed to draft redline clause. Please retry.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result?.proposed_clause) return;
    navigator.clipboard.writeText(result.proposed_clause);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToFinding = async () => {
    if (!selectedFindingId || !result) return;
    try {
      await api.updateFinding(selectedFindingId, {
        reviewer_notes: `[AI Redline - ${stance.toUpperCase()}]\nProposed Clause:\n${result.proposed_clause}\n\nRationale:\n${result.rationale}`,
        status: 'under_review',
      });
      setSavedNotes(true);
    } catch {
      setError('Could not save to finding notes.');
    }
  };

  const activePlaybookConfig = COUNTERPARTY_CONFIGS[counterparty];
  const activeTiers = activePlaybookConfig.tiers(topic, statementA, statementB);
  const currentTier = activeTiers[selectedTierIndex] || activeTiers[1];

  const handleCopyAttorneyEmail = () => {
    const emailBody = `Subject: Proposed Revision & Harmonization - ${topic || 'Contract Provision'} (${docATitle || 'Agreement'})

Counsel,

In reviewing the provision regarding "${topic || 'General Terms'}" between our respective organizations, we have synthesized a balanced compromise to align our mutual commercial interests while ensuring appropriate risk allocation.

PROPOSED CLAUSE:
"${currentTier.clause}"

COMMERCIAL RATIONALE & CONCESSION STRUCTURE:
- Strategic Posture: ${activePlaybookConfig.label} (${currentTier.name})
- Justification: ${currentTier.rationale}
- Anticipated Consideration: In exchange for incorporating these terms, we are prepared to accept reciprocal standards on notice periods and standard liability limitation caps.

Please review this marked revision with your team and confirm if this provides a workable path forward for signature.

Warm regards,
Legal & Commercial Deal Desk`;

    navigator.clipboard.writeText(emailBody);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Clause Redline & Negotiation Playbook"
        description="Bridge conflicting contractual provisions, select bargaining postures, and generate compromise language with escalation playbooks."
      >
        {findings.length > 0 && (
          <div className="w-full sm:w-72">
            <Select
              aria-label="Preset Finding"
              value={selectedFindingId}
              onChange={(e) => handleSelectFinding(e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-md px-3 py-2 text-slate-800 font-medium shadow-xs"
            >
              <option value="">-- Choose from Flagged Findings --</option>
              {uniqueFindings.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title} ({f.severity.toUpperCase()})
                </option>
              ))}
            </Select>
          </div>
        )}
      </PageHeader>

      {error && (
        <div role="alert" className="p-3.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* Main Unified Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Input Terms & Posture Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Conflicting Text Inputs */}
          <Card className="p-5 bg-white border border-slate-200 shadow-sm rounded-md space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <FileText className="w-4 h-4 text-slate-700" />
              <span>1. Contradictory Clauses to Bridge</span>
            </h3>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Provision / Clause Topic
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Data Retention, Indemnification Cap, SLA Breach"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:border-slate-800 shadow-xs"
              />
            </div>

            {/* Document A Clause */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">Document A Baseline Clause</span>
                <input
                  type="text"
                  value={docATitle}
                  onChange={(e) => setDocATitle(e.target.value)}
                  placeholder="Doc A Title"
                  className="text-[11px] px-2 py-0.5 border border-slate-200 rounded-md text-slate-600 w-44 text-right"
                />
              </div>
              <textarea
                rows={3}
                value={statementA}
                onChange={(e) => setStatementA(e.target.value)}
                placeholder="Paste clause or excerpt from Document A..."
                className="w-full text-xs p-3 border border-slate-200 rounded-md bg-slate-50 text-slate-900 focus:outline-none focus:bg-white focus:border-slate-800 font-mono leading-relaxed resize-none shadow-xs"
              />
            </div>

            {/* Document B Clause */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">Document B Modernized Clause</span>
                <input
                  type="text"
                  value={docBTitle}
                  onChange={(e) => setDocBTitle(e.target.value)}
                  placeholder="Doc B Title"
                  className="text-[11px] px-2 py-0.5 border border-slate-200 rounded-md text-slate-600 w-44 text-right"
                />
              </div>
              <textarea
                rows={3}
                value={statementB}
                onChange={(e) => setStatementB(e.target.value)}
                placeholder="Paste clause or excerpt from Document B..."
                className="w-full text-xs p-3 border border-slate-200 rounded-md bg-slate-50 text-slate-900 focus:outline-none focus:bg-white focus:border-slate-800 font-mono leading-relaxed resize-none shadow-xs"
              />
            </div>
          </Card>

          {/* Stance & Counterparty Controls */}
          <Card className="p-5 bg-white border border-slate-200 shadow-sm rounded-md space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <Shield className="w-4 h-4 text-slate-700" />
              <span>2. Strategy & Counterparty Posture</span>
            </h3>

            {/* Stance Selection */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                Target Bargaining Stance
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STANCES.map((s) => {
                  const isActive = stance === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStance(s.id)}
                      className={`p-2.5 rounded-md border text-left transition-all ${
                        isActive
                          ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="text-xs font-bold mb-0.5">{s.label}</div>
                      <p className={`text-[10.5px] leading-relaxed line-clamp-2 ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                        {s.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Counterparty Profile */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Counterparty Persona & Posture
                </label>
                <span className="text-[10px] text-slate-500">
                  Resistance Risk: <strong className="text-slate-900 font-mono">{activePlaybookConfig.resistanceBaseline}%</strong>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(['monopoly', 'balanced', 'vendor'] as CounterpartyProfile[]).map((cpKey) => {
                  const conf = COUNTERPARTY_CONFIGS[cpKey];
                  const isSelected = counterparty === cpKey;
                  return (
                    <button
                      key={cpKey}
                      type="button"
                      onClick={() => {
                        setCounterparty(cpKey);
                        setSelectedTierIndex(1);
                      }}
                      className={`p-2 rounded-md border text-center transition-all ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white shadow-xs font-semibold'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-xs'
                      }`}
                    >
                      <span className="block text-xs truncate">{conf.label.split(' ')[0]}</span>
                      <span className={`text-[9.5px] block font-mono ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                        {conf.resistanceBaseline}% risk
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Instructions */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Custom Redline Instructions (Optional)
              </label>
              <input
                type="text"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="e.g. Ensure 72-hour notice window and retain $250k liability ceiling"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:border-slate-800 shadow-xs"
              />
            </div>

            {/* AI Generation Mode Toggle */}
            <div className="flex items-center justify-between pb-3 pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-slate-600" />
                <span>AI Synthesis (LLM)</span>
              </span>
              <button
                type="button"
                onClick={() => setUseAi(!useAi)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                  useAi
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                }`}
              >
                {useAi ? 'AI ON' : 'AI OFF'}
              </button>
            </div>

            <Button
              variant="primary"
              size="md"
              disabled={loading || (!statementA.trim() && !statementB.trim())}
              onClick={handleGenerate}
              className="w-full justify-center text-xs font-semibold py-2.5 bg-slate-900 hover:bg-slate-800 text-white shadow-sm rounded-md"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  <span>Synthesizing Compromise...</span>
                </>
              ) : (
                <>
                  <Scale className="w-4 h-4 mr-2" />
                  <span>Generate Harmonized Redline</span>
                </>
              )}
            </Button>
          </Card>
        </div>

        {/* Right Column: Unified Output Studio (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card
            id="synthesis-result"
            className="p-5 bg-white border border-slate-200 shadow-sm rounded-md min-h-[580px] flex flex-col justify-between scroll-mt-6 transition-all duration-300"
          >
            {result ? (
              <div className="space-y-4">
                {/* Result Header & View Tabs */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5">
                    <button
                      type="button"
                      onClick={() => setResultSubTab('redline')}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                        resultSubTab === 'redline'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Harmonized Provision
                    </button>
                    <button
                      type="button"
                      onClick={() => setResultSubTab('playbook')}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                        resultSubTab === 'playbook'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Target className="w-3.5 h-3.5 text-slate-700" />
                      <span>3-Tier Playbook</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setResultSubTab('rationale')}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                        resultSubTab === 'rationale'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Strategy & Justification
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="navy">STANCE: {result.stance.toUpperCase()}</Badge>
                    <Badge variant={result.risk_level === 'Low' ? 'sage' : result.risk_level === 'Medium' ? 'gold' : 'red'}>
                      Risk: {result.risk_level}
                    </Badge>
                  </div>
                </div>

                {/* TAB 1: Harmonized Provision */}
                {resultSubTab === 'redline' && (
                  <div className="space-y-4">
                    {stampedMessage && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                        <CheckCheck className="w-4 h-4 text-emerald-600" />
                        <span>{stampedMessage}</span>
                      </div>
                    )}

                    {/* Clause Deviation Meter */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">Clause Deviation vs. Counterparty Base</span>
                        <Badge variant={deviationPercent <= 25 ? 'sage' : deviationPercent <= 55 ? 'gold' : 'red'} size="sm">
                          {deviationPercent}% Drift
                        </Badge>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
                        <div
                          className={`h-full transition-all duration-300 ${
                            deviationPercent <= 25 ? 'bg-emerald-600' : deviationPercent <= 55 ? 'bg-amber-500' : 'bg-rose-600'
                          }`}
                          style={{ width: `${Math.max(6, deviationPercent)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10.5px] text-slate-500">
                        <span>0% Baseline</span>
                        <span className="font-medium text-slate-700">
                          {deviationPercent <= 25
                            ? 'Standard Alignment (Minor Polish)'
                            : deviationPercent <= 55
                            ? 'Balanced Compromise (Substantive Adjustments)'
                            : 'Major Restructure (Substantive Redline)'}
                        </span>
                        <span>100% Full Rewrite</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                            Proposed Redline Amendment
                          </span>
                          <div className="flex items-center border border-slate-200 rounded-md p-0.5 bg-slate-100">
                            <button
                              type="button"
                              onClick={() => setDiffViewMode('clean')}
                              className={`px-2 py-0.5 rounded text-[10.5px] font-semibold transition-all ${
                                diffViewMode === 'clean' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              Clean Text
                            </button>
                            <button
                              type="button"
                              onClick={() => setDiffViewMode('markup')}
                              className={`px-2 py-0.5 rounded text-[10.5px] font-semibold transition-all ${
                                diffViewMode === 'markup' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              Tracked Changes
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleExportDocx}
                            disabled={exportingDocx}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200 shadow-xs"
                            title="Download Microsoft Word document with tracked changes markup"
                          >
                            <Download className="w-3.5 h-3.5 text-slate-600" />
                            <span>{exportingDocx ? 'Exporting...' : 'Export Track Changes (.docx)'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleCopy}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200 shadow-xs"
                          >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copied ? 'Copied' : 'Copy Clause'}</span>
                          </button>
                        </div>
                      </div>

                      {diffViewMode === 'clean' ? (
                        <div className="p-4 rounded-md border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 leading-relaxed whitespace-pre-wrap selection:bg-slate-200">
                          {result.proposed_clause}
                        </div>
                      ) : (
                        <div className="p-4 rounded-md border border-slate-200 bg-white text-xs font-mono text-slate-900 leading-relaxed whitespace-pre-wrap selection:bg-slate-200 space-y-2">
                          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 text-[10.5px]">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">+ Harmonized Additions</span>
                            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-semibold line-through">- Legacy Strikethroughs</span>
                          </div>
                          <p className="leading-relaxed select-text">
                            {result.proposed_clause}
                          </p>
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block mb-1">
                        Summary of Changes & Compromise Rationale
                      </span>
                      <p className="text-xs text-slate-700 leading-relaxed bg-white border border-slate-100 p-3 rounded-md">
                        {result.rationale}
                      </p>
                    </div>
                  </div>
                )}

                {/* TAB 2: 3-Tier Negotiation Playbook */}
                {resultSubTab === 'playbook' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Escalation Fallbacks for {activePlaybookConfig.label}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyAttorneyEmail}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-md transition-colors shadow-xs"
                      >
                        {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Mail className="w-3.5 h-3.5" />}
                        <span>{copiedEmail ? 'Email Copied!' : 'Copy Lawyer Email Memo'}</span>
                      </button>
                    </div>

                    {/* Tier selector tabs */}
                    <div className="grid grid-cols-3 gap-2">
                      {activeTiers.map((t, idx) => {
                        const isSelected = selectedTierIndex === idx;
                        return (
                          <div
                            key={t.tier}
                            onClick={() => setSelectedTierIndex(idx)}
                            className={`p-3 rounded-md border cursor-pointer transition-all ${
                              isSelected
                                ? 'border-slate-900 bg-white shadow-xs ring-1 ring-slate-900'
                                : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-slate-900">
                                Tier {t.tier}
                              </span>
                              <Badge variant={t.badgeColor} size="sm">{t.badge}</Badge>
                            </div>
                            <span className="text-[11px] text-slate-600 block truncate">
                              {t.name.split(' ')[0]}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-1">
                              Pushback: <strong className="text-slate-800 font-mono">{t.counterResistance}%</strong>
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Selected Tier Provision Box */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div>
                          <strong className="text-slate-800">{currentTier.name}</strong>
                          <span className="text-slate-500 text-[11px] ml-2">({currentTier.giveawayRisk})</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStampTier(currentTier)}
                          className="text-xs flex items-center gap-1.5 text-slate-800 hover:text-slate-900 border-slate-300 hover:bg-slate-100 shadow-2xs"
                        >
                          <GitPullRequest className="w-3.5 h-3.5 text-slate-700" />
                          <span>Stamp Tier {currentTier.tier} as Active Redline</span>
                        </Button>
                      </div>
                      <div className="p-3.5 rounded-md border border-slate-200 bg-slate-50 font-mono text-xs text-slate-900 leading-relaxed whitespace-pre-wrap selection:bg-slate-200">
                        {currentTier.clause}
                      </div>
                    </div>

                    {/* Deal Desk Email Memo Preview */}
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block mb-1">
                        Counterparty Counsel Negotiation Memo
                      </span>
                      <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-700 font-mono leading-relaxed space-y-1 whitespace-pre-wrap">
{`Subject: Proposed Revision - ${topic || 'Contract Provision'} (${docATitle || 'Agreement'})

Counsel,
In reviewing "${topic || 'General Terms'}" between our organizations, we proposed the following compromise:
"${currentTier.clause}"

Rationale: ${currentTier.rationale}`}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: Strategy & Concessions */}
                {resultSubTab === 'rationale' && (
                  <div className="space-y-4">
                    {/* Tactical Intelligence Banner */}
                    <div className="p-4 rounded-md bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="font-bold text-slate-900 block mb-1">Predicted Counterparty Objection</span>
                        <p className="text-slate-600 leading-relaxed">
                          {activePlaybookConfig.expectedObjection}
                        </p>
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 block mb-1">Recommended Tactical Pivot</span>
                        <p className="text-slate-600 leading-relaxed">
                          {activePlaybookConfig.recommendedPivot}
                        </p>
                      </div>
                    </div>

                    {/* Key Concessions */}
                    {result.key_concessions && result.key_concessions.length > 0 && (
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block mb-2">
                          Safeguards & Concessions Check
                        </span>
                        <ul className="space-y-2">
                          {result.key_concessions.map((c, i) => (
                            <li key={i} className="text-xs text-slate-700 flex items-start gap-2 p-2 rounded-md bg-white border border-slate-100">
                              <Check className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-24 px-6 text-slate-500 my-auto">
                <Scale className="w-12 h-12 text-slate-300 mb-3 stroke-[1.2]" />
                <h4 className="text-sm font-bold text-slate-700 mb-1">Ready to Bridge Opposing Terms</h4>
                <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                  Select a detected finding from the header, choose your target bargaining stance on the left, and click <strong>Generate Harmonized Redline</strong>.
                </p>
              </div>
            )}

            {/* Bottom Actions */}
            {result && selectedFindingId && (
              <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={savedNotes}
                  onClick={handleSaveToFinding}
                  className="text-xs rounded-md"
                >
                  <BookmarkCheck className="w-3.5 h-3.5 mr-1.5 text-slate-700" />
                  <span>{savedNotes ? 'Saved to Audit Notes' : 'Save to Finding'}</span>
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
