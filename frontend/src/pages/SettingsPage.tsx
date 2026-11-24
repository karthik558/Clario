import { PageHeader } from '../components/layout/PageHeader';
import { Select } from '../components/ui/Select';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sliders,
  Database,
  RefreshCw,
  CheckCircle2,
  Bot,
  ExternalLink,
  Terminal,
  Check,
  AlertCircle,
  Brain,
  LayoutTemplate,
  MessageSquare,
  RotateCcw,
  Trash2,
  KeyRound,
} from 'lucide-react';
import { api } from '../services/api';
import { SystemSettings, OllamaStatus, DBTableInfo } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
  WorkspacePreferences,
  loadWorkspacePreferences,
  applyWorkspacePreferences,
  resetWorkspacePreferences,
} from '../utils/preferences';

interface SettingToggleRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

const SettingToggleRow: React.FC<SettingToggleRowProps> = ({
  id,
  label,
  description,
  checked,
  onChange,
}) => (
  <div className="flex items-start justify-between gap-4 p-3.5 rounded-md border border-slate-200 bg-slate-50/50">
    <div className="min-w-0">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-900 cursor-pointer">
        {label}
      </label>
      <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{description}</p>
    </div>
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-clario-navy/30 ${
        checked ? 'bg-clario-navy' : 'bg-slate-300'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-150 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState('');
  const tableRequest = useRef(0);

  // Local Workspace UI Preferences (live-synced with localStorage + Layout + Backend)
  const [prefs, setPrefs] = useState<WorkspacePreferences>(() => loadWorkspacePreferences());

  // AI Provider & Model State
  const [llmProvider, setLlmProvider] = useState('extractive');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('');
  const [localAiUrl, setLocalAiUrl] = useState('http://localhost:1234');
  const [localAiModel, setLocalAiModel] = useState('');
  const [localAiApiKey, setLocalAiApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [checkingOllama, setCheckingOllama] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);

  const availableModels = useMemo<string[]>(() => {
    return ollamaStatus?.models || [];
  }, [ollamaStatus]);

  // Global AI Tuning State
  const [thinkingMode, setThinkingMode] = useState(false);
  const [answerLength, setAnswerLength] = useState<'concise' | 'standard' | 'comprehensive'>('standard');

  // Database Explorer State
  const [dbTables, setDbTables] = useState<DBTableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('documents');
  const [tableData, setTableData] = useState<{ table: string; columns: string[]; rows: any[] } | null>(null);
  const [loadingTable, setLoadingTable] = useState(false);

  // IR & Ingestion Tuning State
  const [bm25K1, setBm25K1] = useState(1.5);
  const [bm25B, setBm25B] = useState(0.75);
  const [rrfK, setRrfK] = useState(60);
  const [defaultTopK, setDefaultTopK] = useState(5);
  const [chunkSize, setChunkSize] = useState(800);
  const [chunkOverlap, setChunkOverlap] = useState(150);

  // Maintenance confirmation state
  const [confirmClearAsk, setConfirmClearAsk] = useState(false);
  const [clearingAsk, setClearingAsk] = useState(false);

  const handlePreferenceChange = <K extends keyof WorkspacePreferences>(
    key: K,
    value: WorkspacePreferences[K],
    statusLabel?: string
  ) => {
    const syncSidebar = key === 'sidebar_collapsed_default';
    const nextPrefs = applyWorkspacePreferences(
      { ...prefs, [key]: value },
      { syncSidebarState: syncSidebar }
    );
    setPrefs(nextPrefs);
    setSuccessMsg(statusLabel || 'Workspace preference applied immediately.');
    api.updateSettings({ ui_preferences: nextPrefs } as Partial<SystemSettings>).catch(() => {
      // LocalStorage preference still remains active if offline
    });
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setSettings(data);
      setLlmProvider(data.llm_provider || 'extractive');
      if (data.thinking_mode !== undefined) setThinkingMode(data.thinking_mode);
      if (data.answer_length) setAnswerLength(data.answer_length);
      if (data.ollama_base_url) setOllamaUrl(data.ollama_base_url);
      if (data.ollama_model) setOllamaModel(data.ollama_model);
      if (data.local_ai_base_url) setLocalAiUrl(data.local_ai_base_url);
      if (data.local_ai_model) setLocalAiModel(data.local_ai_model);
      setBm25K1(data.bm25_k1);
      setBm25B(data.bm25_b);
      setRrfK(data.rrf_k);
      setDefaultTopK(data.default_top_k);
      if (typeof data.chunk_size === 'number') setChunkSize(data.chunk_size);
      if (typeof data.chunk_overlap === 'number') setChunkOverlap(data.chunk_overlap);

      if (data.ui_preferences && typeof data.ui_preferences === 'object') {
        const synced = applyWorkspacePreferences(data.ui_preferences as Partial<WorkspacePreferences>);
        setPrefs(synced);
      }

      checkOllama(data.ollama_model, data.llm_provider);
      fetchDatabaseTables();
    } catch {
      setError('The operation failed. Check the connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const checkOllama = async (savedModel?: unknown, providerOverride?: string) => {
    setCheckingOllama(true);
    const prov = providerOverride || llmProvider;
    const isCustomOpenAI = ['lm_studio', 'vllm', 'openai_compatible'].includes(prov);
    try {
      const status = isCustomOpenAI
        ? await api.getLocalAIStatus(prov, localAiUrl)
        : await api.getOllamaStatus();
      setOllamaStatus(status);
      const currentModel = typeof savedModel === 'string' ? savedModel : ollamaModel;
      if (status.models && status.models.length > 0) {
        if (!currentModel) {
          setOllamaModel(status.active_model && status.models.includes(status.active_model) ? status.active_model : status.models[0]);
        } else {
          setOllamaModel(currentModel);
        }
      } else if (status.active_model && !currentModel) {
        setOllamaModel(status.active_model);
      }
    } catch {
      setOllamaStatus({
        running: false,
        url: isCustomOpenAI ? localAiUrl : ollamaUrl,
        models: [],
        active_model: typeof ollamaModel === 'string' ? ollamaModel : '',
        message: 'Could not connect to local AI daemon',
      });
    } finally {
      setCheckingOllama(false);
    }
  };

  const fetchDatabaseTables = async () => {
    try {
      const res = await api.getDatabaseTables();
      setDbTables(res.tables);
      if (res.tables.length > 0) {
        inspectTable(selectedTable || res.tables[0].name);
      }
    } catch {
      setError('The operation failed. Check the connection and try again.');
    }
  };

  const inspectTable = async (tableName: string) => {
    setSelectedTable(tableName);
    const request = ++tableRequest.current;
    setLoadingTable(true);
    setTableData(null);
    setError('');
    try {
      const data = await api.inspectDatabaseTable(tableName, 20);
      if (request === tableRequest.current) setTableData(data);
    } catch {
      setError('The operation failed. Check the connection and try again.');
    } finally {
      if (request === tableRequest.current) setLoadingTable(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveModel = async (modelToSave?: string) => {
    const model = (modelToSave || ollamaModel || '').trim();
    if (!model) {
      setError('Please select or enter a valid model name.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccessMsg(null);
    try {
      await api.updateSettings({
        llm_provider: llmProvider === 'extractive' ? 'ollama' : llmProvider,
        ollama_base_url: ollamaUrl,
        ollama_model: model,
        local_ai_model: model,
      });
      if (llmProvider === 'extractive') setLlmProvider('ollama');
      setOllamaModel(model);
      setSuccessMsg(`Model successfully saved as "${model}".`);
      window.dispatchEvent(
        new CustomEvent('clario:settings-updated', {
          detail: { llm_provider: llmProvider === 'extractive' ? 'ollama' : llmProvider, ollama_model: model },
        })
      );
    } catch {
      setError('Failed to update model. Please verify the Ollama daemon connection.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (
      !ollamaModel.trim() ||
      !/^https?:\/\/[^\s]+$/.test(ollamaUrl) ||
      !Number.isFinite(bm25K1) ||
      bm25K1 <= 0 ||
      bm25K1 > 10 ||
      !Number.isFinite(bm25B) ||
      bm25B < 0 ||
      bm25B > 1 ||
      !Number.isInteger(rrfK) ||
      rrfK < 1 ||
      rrfK > 1000 ||
      !Number.isInteger(defaultTopK) ||
      defaultTopK < 1 ||
      defaultTopK > 50 ||
      !Number.isInteger(chunkSize) ||
      chunkSize < 200 ||
      chunkSize > 4000 ||
      !Number.isInteger(chunkOverlap) ||
      chunkOverlap < 0 ||
      chunkOverlap >= chunkSize
    ) {
      setError(
        'Check inputs: model name and valid HTTP(S) URL are required; BM25 k1 (0–10), b (0–1), RRF (1–1000), Top-K (1–50), Chunk Size (200–4000), Overlap (< Chunk Size).'
      );
      return;
    }
    setSaving(true);
    setError('');
    setSuccessMsg(null);
    try {
      const payload: Partial<SystemSettings> = {
        llm_provider: llmProvider,
        ollama_base_url: ollamaUrl,
        ollama_model: ollamaModel,
        local_ai_base_url: localAiUrl,
        local_ai_model: localAiModel || ollamaModel,
        thinking_mode: thinkingMode,
        answer_length: answerLength,
        bm25_k1: bm25K1,
        bm25_b: bm25B,
        rrf_k: rrfK,
        default_top_k: defaultTopK,
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
        ui_preferences: prefs,
      };
      if (geminiApiKey.trim()) payload.gemini_api_key = geminiApiKey.trim();
      if (openaiApiKey.trim()) payload.openai_api_key = openaiApiKey.trim();
      if (localAiApiKey.trim()) payload.local_ai_api_key = localAiApiKey.trim();

      await api.updateSettings(payload);
      applyWorkspacePreferences(prefs);
      setGeminiApiKey('');
      setOpenaiApiKey('');
      setLocalAiApiKey('');
      setSuccessMsg('All workspace, AI, retrieval, and layout settings saved.');
      window.dispatchEvent(
        new CustomEvent('clario:settings-updated', {
          detail: { llm_provider: llmProvider, ollama_model: ollamaModel },
        })
      );
      fetchSettings();
    } catch {
      setError('Configuration was not saved. Check the model name, server URL, and numeric ranges.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetRetrievalDefaults = () => {
    setBm25K1(1.5);
    setBm25B(0.75);
    setRrfK(60);
    setDefaultTopK(5);
    setChunkSize(800);
    setChunkOverlap(150);
    setSuccessMsg('Retrieval & chunking fields reset to defaults. Click Save All Settings to apply.');
  };

  const handleResetUiPreferences = () => {
    const defaults = resetWorkspacePreferences();
    setPrefs(defaults);
    api.updateSettings({ ui_preferences: defaults } as Partial<SystemSettings>).catch(() => {});
    setSuccessMsg('Workspace layout & behavior preferences restored to factory defaults.');
  };

  const handleClearAskHistory = async () => {
    setClearingAsk(true);
    setError('');
    setSuccessMsg(null);
    try {
      const res = await api.clearAnswerHistory();
      setConfirmClearAsk(false);
      setSuccessMsg(res.message || 'Ask Clario conversation history cleared.');
    } catch {
      setError('Could not clear Ask Clario history.');
    } finally {
      setClearingAsk(false);
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    setError('');
    setSuccessMsg(null);
    try {
      const res = await api.reindexAll();
      setSuccessMsg(res.message || 'Search indices successfully reloaded.');
    } catch {
      setError('The operation failed. Check the connection and try again.');
    } finally {
      setReindexing(false);
    }
  };

  if (loading && !settings) {
    return <p role="status" className="text-sm text-clario-text-secondary">Loading saved workspace settings…</p>;
  }

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="p-4 rounded-md bg-rose-50 text-rose-800 text-sm border border-rose-200">{error}</p>}

      {/* Header */}
      <PageHeader title="Workspace settings" description="Configure layout defaults, AI assistants, retrieval tuning, and inspect the workspace database." />

      {successMsg && (
        <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2.5 shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-clario-navy" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* 1. Workspace Layout & Navigation Defaults */}
      <Card className="rounded-md p-6 bg-white shadow-subtle border border-slate-200 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-clario-border">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-md bg-clario-navy/5 text-clario-navy">
              <LayoutTemplate className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-clario-navy">Workspace Layout & Interface Defaults</h3>
              <p className="text-xs text-clario-text-secondary mt-0.5">
                Customize sidebar visibility, table density, document layouts, and floating helpers across the app
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleResetUiPreferences}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Reset Layout Defaults
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <SettingToggleRow
            id="pref-sidebar-collapsed"
            label="Hide / Collapse Sidebar by Default"
            description="Keep the left navigation rail minimized to compact icons for maximum reading space."
            checked={prefs.sidebar_collapsed_default}
            onChange={(val) =>
              handlePreferenceChange(
                'sidebar_collapsed_default',
                val,
                val ? 'Sidebar collapsed and set as workspace default.' : 'Sidebar expanded and set as workspace default.'
              )
            }
          />

          <SettingToggleRow
            id="pref-quick-ask"
            label="Show Floating Ask Clario Launcher"
            description="Display the quick Ask Clario popup button in the bottom-right corner across workspace pages."
            checked={prefs.show_quick_ask}
            onChange={(val) =>
              handlePreferenceChange(
                'show_quick_ask',
                val,
                val ? 'Floating Ask Clario launcher enabled.' : 'Floating Ask Clario launcher hidden.'
              )
            }
          />

          <SettingToggleRow
            id="pref-auto-tasks"
            label="Auto-Open Background Task Drawer"
            description="Automatically expand the live task log drawer whenever a report, critique, or Q&A task starts."
            checked={prefs.auto_open_task_drawer}
            onChange={(val) =>
              handlePreferenceChange(
                'auto_open_task_drawer',
                val,
                val ? 'Task drawer will open automatically for background jobs.' : 'Background tasks will run quietly in the corner pill.'
              )
            }
          />

          <SettingToggleRow
            id="pref-footer-shortcuts"
            label="Show Keyboard Shortcuts Indicator"
            description="Show the interactive Shortcuts (?) quick guide trigger in the workspace footer."
            checked={prefs.show_footer_shortcuts}
            onChange={(val) => handlePreferenceChange('show_footer_shortcuts', val)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 text-xs">
          <div className="p-3.5 rounded-md border border-slate-200 bg-slate-50/50 space-y-2">
            <span className="font-semibold text-slate-900 block">Default Table & Row Density</span>
            <div className="grid grid-cols-2 gap-1 p-0.5 rounded-md border border-slate-200 bg-white">
              {(['comfortable', 'compact'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handlePreferenceChange('table_density', mode, `Default density set to ${mode}.`)}
                  className={`py-1.5 rounded-md text-[11px] font-semibold capitalize transition-colors ${
                    prefs.table_density === mode
                      ? 'bg-clario-navy text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">Applies across Overview and Document Library tables.</p>
          </div>

          <div className="p-3.5 rounded-md border border-slate-200 bg-slate-50/50 space-y-2">
            <span className="font-semibold text-slate-900 block">Default Document Library Layout</span>
            <div className="grid grid-cols-2 gap-1 p-0.5 rounded-md border border-slate-200 bg-white">
              {(['grid', 'table'] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => handlePreferenceChange('default_documents_view', view, `Default Documents view set to ${view}.`)}
                  className={`py-1.5 rounded-md text-[11px] font-semibold capitalize transition-colors ${
                    prefs.default_documents_view === view
                      ? 'bg-clario-navy text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {view === 'grid' ? 'Card Grid' : 'Dense Table'}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">Initial view when navigating to Document Library.</p>
          </div>
        </div>
      </Card>

      {/* 2. Ask Clario & AI Behavior Defaults */}
      <Card className="rounded-md p-6 bg-white shadow-subtle border border-slate-200 space-y-5">
        <div className="flex items-center space-x-2.5 pb-4 border-b border-clario-border">
          <div className="p-1.5 rounded-md bg-clario-navy/5 text-clario-navy">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-clario-navy">Ask Clario & AI Behavior Defaults</h3>
            <p className="text-xs text-clario-text-secondary mt-0.5">
              Choose which AI, citation, streaming, and reasoning modes are turned ON automatically across sessions
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <SettingToggleRow
            id="pref-ask-stream"
            label="Stream Answers by Default"
            description="Turn live token-by-token response streaming ON when opening Ask Clario."
            checked={prefs.ask_streaming_default}
            onChange={(val) => handlePreferenceChange('ask_streaming_default', val)}
          />

          <SettingToggleRow
            id="pref-ask-research"
            label="Enable Deep Research Mode by Default"
            description="Automatically expand cross-document retrieval context for complex queries."
            checked={prefs.ask_research_mode_default}
            onChange={(val) => handlePreferenceChange('ask_research_mode_default', val)}
          />

          <SettingToggleRow
            id="pref-citations-open"
            label="Expand Citations by Default"
            description="Automatically expand cited document passages under answers (turn off to keep them tucked)."
            checked={prefs.show_citations_default}
            onChange={(val) => handlePreferenceChange('show_citations_default', val)}
          />

          <SettingToggleRow
            id="pref-followups"
            label="Show Suggested Follow-Up Questions"
            description="Display clickable follow-up prompts beneath substantive document answers."
            checked={prefs.show_followups}
            onChange={(val) => handlePreferenceChange('show_followups', val)}
          />

          <SettingToggleRow
            id="pref-critique-ai"
            label="Enable AI Synthesis by Default in Critique & Reports"
            description="Pre-check AI synthesis mode when opening Red Team Critique or generating new PDF reports."
            checked={prefs.ai_critique_default}
            onChange={(val) => handlePreferenceChange('ai_critique_default', val)}
          />

          <SettingToggleRow
            id="pref-global-thinking"
            label="Global Thinking Mode (Server Default)"
            description="Synthesize and expose step-by-step audit reasoning chains when models support reasoning."
            checked={thinkingMode}
            onChange={(val) => setThinkingMode(val)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 text-xs">
          <div className="p-3.5 rounded-md border border-slate-200 bg-slate-50/50 space-y-2">
            <span className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-clario-navy" />
              Response Length & Generation Speed
            </span>
            <div className="grid grid-cols-3 gap-1 p-0.5 rounded-md border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setAnswerLength('concise')}
                className={`py-1.5 px-1.5 rounded-md text-[11px] font-medium text-center transition-all ${
                  answerLength === 'concise'
                    ? 'bg-clario-navy text-white font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Concise
              </button>
              <button
                type="button"
                onClick={() => setAnswerLength('standard')}
                className={`py-1.5 px-1.5 rounded-md text-[11px] font-medium text-center transition-all ${
                  answerLength === 'standard'
                    ? 'bg-clario-navy text-white font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => setAnswerLength('comprehensive')}
                className={`py-1.5 px-1.5 rounded-md text-[11px] font-medium text-center transition-all ${
                  answerLength === 'comprehensive'
                    ? 'bg-clario-navy text-white font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Deep
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              {answerLength === 'concise'
                ? 'Ultra-concise output (220 tokens max) for faster responses.'
                : answerLength === 'comprehensive'
                ? 'Exhaustive multi-section analysis with detailed citations.'
                : 'Balanced synthesis optimizing quality and speed.'}
            </p>
          </div>

          <div className="p-3.5 rounded-md border border-slate-200 bg-slate-50/50 space-y-2">
            <span className="font-semibold text-slate-900 block">Default Quick Search Mode (⌘K)</span>
            <div className="grid grid-cols-3 gap-1 p-0.5 rounded-md border border-slate-200 bg-white">
              {(['hybrid', 'bm25', 'vector'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handlePreferenceChange('default_search_mode', m, `Default Quick Search mode set to ${m.toUpperCase()}.`)}
                  className={`py-1.5 px-1.5 rounded-md text-[11px] font-medium uppercase text-center transition-all ${
                    prefs.default_search_mode === m
                      ? 'bg-clario-navy text-white font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              Controls the default engine selected inside the global search dialog.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-200">
          <Button variant="primary" size="sm" onClick={() => handleSave()} loading={saving} disabled={loading}>
            Save Server AI Profile
          </Button>
        </div>
      </Card>

      {/* 3. Local & Cloud AI Model Integration */}
      <Card className="rounded-md p-6 bg-white shadow-subtle border border-slate-200 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-clario-border">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-md bg-clario-navy/5 text-clario-navy">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-clario-navy">Local & Cloud AI Engine Integration</h3>
              <p className="text-xs text-clario-text-secondary mt-0.5">
                Connect local Ollama, LM Studio / vLLM servers, or cloud models for synthesis
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => checkOllama()}
              loading={checkingOllama}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Check saved connection
            </Button>
            <span
              className={`text-xs font-semibold ${
                checkingOllama
                  ? 'text-slate-500'
                  : ollamaStatus?.running
                  ? 'text-emerald-700'
                  : 'text-rose-700'
              }`}
            >
              {checkingOllama ? 'Checking…' : ollamaStatus?.running ? 'Engine Online' : 'Engine Offline'}
            </span>
          </div>
        </div>

        {/* Status Feedback */}
        <div
          className={`p-4 rounded-md border text-xs ${
            ollamaStatus?.running
              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
              : 'bg-amber-50/60 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center space-x-2 mb-1">
            {ollamaStatus?.running ? (
              <Check className="w-4 h-4 text-clario-navy shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-clario-navy shrink-0" />
            )}
            <span className="font-bold">
              {checkingOllama
                ? 'Checking the saved server address…'
                : ollamaStatus?.running
                ? 'Local AI engine connected'
                : 'Local AI engine is unavailable'}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed ml-6">
            {ollamaStatus?.running
              ? `Connected at ${ollamaStatus.url}. Detected ${ollamaStatus.models.length} model(s): [${ollamaStatus.models.join(', ') || 'None pulled yet'}].`
              : typeof navigator !== 'undefined' && /win/i.test(navigator.userAgent || '')
              ? `To start Ollama, open PowerShell or Command Prompt and run: 'ollama serve', or launch the Ollama Windows application.`
              : typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent || '')
              ? `To start Ollama, open Terminal and run: 'ollama serve', or open the Ollama application.`
              : `To start Ollama, open your terminal and run: 'ollama serve'.`}
          </p>
        </div>

        {/* Mode Selector & Model Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 text-xs">
          <div>
            <label htmlFor="llmProvider" className="block text-[11px] font-bold text-clario-navy uppercase tracking-wider mb-1.5">
              Generation Engine
            </label>
            <Select
              id="llmProvider"
              value={llmProvider}
              onChange={(e) => setLlmProvider(e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-md px-3 py-2.5 font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
            >
              <option value="extractive">Extractive · retrieved passages</option>
              <option value="ollama">Ollama · local model</option>
              <option value="lm_studio">LM Studio · local OpenAI API</option>
              <option value="vllm">vLLM · local OpenAI API</option>
              <option value="openai_compatible">Custom OpenAI-Compatible URL</option>
              <option value="gemini">Google Gemini · cloud</option>
              <option value="openai">OpenAI · cloud</option>
            </Select>
          </div>

          <div>
            <label htmlFor="ollamaUrl" className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1.5">
              Ollama Daemon URL
            </label>
            <input
              id="ollamaUrl"
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="w-full text-xs font-mono bg-white border border-slate-200 rounded-md px-3 py-2.5 text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="modelSelect" className="block text-[11px] font-bold text-clario-navy uppercase tracking-wider">
                Model Selection
              </label>
              <span className="text-[10px] text-slate-500 font-medium">Ollama & Local AI</span>
            </div>

            <div className="flex items-center gap-2">
              <Select
                id="modelSelect"
                aria-label="Installed Ollama models"
                value={availableModels.includes(ollamaModel) && !showCustomInput ? ollamaModel : '__custom__'}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__custom__') {
                    setShowCustomInput(true);
                  } else {
                    setShowCustomInput(false);
                    setOllamaModel(val);
                  }
                }}
                className="flex-1 text-xs font-semibold bg-white border border-slate-200 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-slate-900 shadow-xs"
              >
                {availableModels.length > 0 ? (
                  <optgroup label="Installed Models (Ollama)">
                    {availableModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  <optgroup label="Detected Models">
                    <option value="" disabled>
                      {ollamaStatus?.running ? 'No local models pulled yet' : 'Ollama offline (no models detected)'}
                    </option>
                  </optgroup>
                )}
                <optgroup label="Manual Entry">
                  <option value="__custom__">
                    {ollamaModel && !availableModels.includes(ollamaModel)
                      ? `Custom: ${ollamaModel}`
                      : 'Custom model name…'}
                  </option>
                </optgroup>
              </Select>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => handleSaveModel()}
                disabled={saving || !(typeof ollamaModel === 'string' && ollamaModel.trim())}
                className="h-8 px-3 text-xs font-semibold shrink-0"
              >
                Save
              </Button>
            </div>

            {(showCustomInput || (Boolean(ollamaModel) && !availableModels.includes(ollamaModel) && Boolean(ollamaStatus?.running))) && (
              <div className="pt-2">
                <input
                  id="ollamaModel"
                  aria-label="Model name or custom model"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  placeholder="Enter custom model (e.g. llama3.2, mistral)"
                  className="w-full text-xs font-mono bg-white border border-slate-200 text-slate-900 rounded-md px-3 py-2 shadow-xs"
                />
              </div>
            )}
          </div>
        </div>

        {/* Provider-Specific Credentials / Local Endpoint */}
        {['lm_studio', 'vllm', 'openai_compatible'].includes(llmProvider) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-md bg-slate-50 border border-slate-200 text-xs">
            <div>
              <label htmlFor="localAiUrl" className="block text-[11px] font-bold text-slate-900 uppercase mb-1">
                OpenAI-Compatible Server URL
              </label>
              <input
                id="localAiUrl"
                type="text"
                value={localAiUrl}
                onChange={(e) => setLocalAiUrl(e.target.value)}
                placeholder="http://localhost:1234/v1"
                className="w-full text-xs font-mono bg-white border border-slate-200 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="localAiModel" className="block text-[11px] font-bold text-slate-900 uppercase mb-1">
                Served Model ID
              </label>
              <input
                id="localAiModel"
                type="text"
                value={localAiModel}
                onChange={(e) => setLocalAiModel(e.target.value)}
                placeholder="qwen2.5-7b-instruct"
                className="w-full text-xs font-mono bg-white border border-slate-200 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="localAiApiKey" className="block text-[11px] font-bold text-slate-900 uppercase mb-1">
                Optional Bearer API Key
              </label>
              <input
                id="localAiApiKey"
                type="password"
                value={localAiApiKey}
                onChange={(e) => setLocalAiApiKey(e.target.value)}
                placeholder="Leave blank if local auth disabled"
                className="w-full text-xs font-mono bg-white border border-slate-200 rounded-md px-3 py-2"
              />
            </div>
          </div>
        )}

        {(llmProvider === 'gemini' || llmProvider === 'openai') && (
          <div className="p-4 rounded-md bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1">
              <label htmlFor="cloudApiKey" className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900 uppercase mb-1">
                <KeyRound className="w-3.5 h-3.5 text-clario-navy" />
                <span>{llmProvider === 'gemini' ? 'Google Gemini API Key' : 'OpenAI API Key'}</span>
              </label>
              <input
                id="cloudApiKey"
                type="password"
                value={llmProvider === 'gemini' ? geminiApiKey : openaiApiKey}
                onChange={(e) =>
                  llmProvider === 'gemini' ? setGeminiApiKey(e.target.value) : setOpenaiApiKey(e.target.value)
                }
                placeholder={
                  (llmProvider === 'gemini' ? settings?.gemini_api_key_configured : settings?.openai_api_key_configured)
                    ? 'Key already configured — enter to overwrite'
                    : `Paste ${llmProvider === 'gemini' ? 'Gemini' : 'OpenAI'} API key`
                }
                className="w-full text-xs font-mono bg-white border border-slate-200 rounded-md px-3 py-2"
              />
            </div>
            <span className="text-[11px] font-semibold text-slate-600 pb-2">
              {(llmProvider === 'gemini' ? settings?.gemini_api_key_configured : settings?.openai_api_key_configured)
                ? 'Configured in session'
                : 'Not configured'}
            </span>
          </div>
        )}

        <details className="border-t border-clario-border pt-4 text-sm">
          <summary className="cursor-pointer font-medium text-clario-navy">Set up Ollama or a custom model</summary>
          <div className="mt-4 space-y-3 text-slate-600">
            <p>
              Install{' '}
              <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="text-slate-900 underline font-medium">
                Ollama
              </a>
              , launch the application, and download any model from your terminal (
              {typeof navigator !== 'undefined' && /win/i.test(navigator.userAgent || '') ? 'PowerShell or Command Prompt' : 'Terminal'}):
            </p>
            <pre className="bg-slate-50 border border-slate-200 rounded-md p-3 overflow-x-auto text-xs text-slate-800">ollama pull llama3.2</pre>
            <p>Select your installed model from the dropdown above and click Save. Custom models created in Ollama also work in the custom field.</p>
          </div>
        </details>

        <div className="flex justify-end">
          <Button variant="primary" size="md" onClick={() => handleSave()} loading={saving} disabled={loading}>
            Save configuration
          </Button>
        </div>
      </Card>

      {/* 4. Retrieval & Document Chunking Parameters */}
      <Card className="rounded-md p-6 bg-white shadow-subtle border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-md bg-clario-navy/5 text-clario-navy">
              <Sliders className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Retrieval & Document Chunking Parameters</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Fine-tune BM25 scoring, RRF fusion, top-K chunk depth, and ingestion chunk boundaries.
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleResetRetrievalDefaults}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Reset Retrieval Defaults
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <label htmlFor="bm25K1" className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
              BM25 k1 (Term Saturation)
            </label>
            <input
              id="bm25K1"
              type="number"
              step="0.05"
              value={bm25K1}
              onChange={(e) => setBm25K1(parseFloat(e.target.value))}
              className="w-full text-xs font-mono px-3 py-2 rounded-md border border-slate-200 bg-white focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="bm25B" className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
              BM25 b (Length Norm)
            </label>
            <input
              id="bm25B"
              type="number"
              step="0.05"
              value={bm25B}
              onChange={(e) => setBm25B(parseFloat(e.target.value))}
              className="w-full text-xs font-mono px-3 py-2 rounded-md border border-slate-200 bg-white focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="rrfK" className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
              RRF Constant (k)
            </label>
            <input
              id="rrfK"
              type="number"
              value={rrfK}
              onChange={(e) => setRrfK(parseInt(e.target.value, 10))}
              className="w-full text-xs font-mono px-3 py-2 rounded-md border border-slate-200 bg-white focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="defaultTopK" className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
              Default Top-K Chunks
            </label>
            <input
              id="defaultTopK"
              type="number"
              value={defaultTopK}
              onChange={(e) => setDefaultTopK(parseInt(e.target.value, 10))}
              className="w-full text-xs font-mono px-3 py-2 rounded-md border border-slate-200 bg-white focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="chunkSize" className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
              Ingestion Chunk Size (chars)
            </label>
            <input
              id="chunkSize"
              type="number"
              step="50"
              value={chunkSize}
              onChange={(e) => setChunkSize(parseInt(e.target.value, 10))}
              className="w-full text-xs font-mono px-3 py-2 rounded-md border border-slate-200 bg-white focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="chunkOverlap" className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
              Ingestion Chunk Overlap (chars)
            </label>
            <input
              id="chunkOverlap"
              type="number"
              step="25"
              value={chunkOverlap}
              onChange={(e) => setChunkOverlap(parseInt(e.target.value, 10))}
              className="w-full text-xs font-mono px-3 py-2 rounded-md border border-slate-200 bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReindex} loading={reindexing}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Reindex All Chunks
            </Button>

            {!confirmClearAsk ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmClearAsk(true)}
                className="text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Clear Ask History
              </Button>
            ) : (
              <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-md px-2.5 py-1 text-[11px]">
                <span className="text-rose-800 font-semibold">Clear all Q&A threads?</span>
                <button
                  type="button"
                  onClick={handleClearAskHistory}
                  disabled={clearingAsk}
                  className="font-bold text-rose-700 hover:underline px-1"
                >
                  {clearingAsk ? 'Clearing…' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearAsk(false)}
                  className="text-slate-600 hover:underline px-1"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <Button variant="primary" size="md" onClick={() => handleSave()} loading={saving} disabled={loading}>
            Save All Settings
          </Button>
        </div>
      </Card>

      {/* 5. Database Explorer Section */}
      <Card className="rounded-md p-6 bg-white shadow-subtle border border-slate-200 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-md bg-clario-navy/5 text-clario-navy">
              <Database className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Interactive Database Explorer</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect raw SQLite tables, document chunks, comparisons, and audit records directly
              </p>
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-600 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
            File: backend/data/clario.db
          </div>
        </div>

        {/* Table Switcher */}
        <div className="flex flex-wrap gap-2 text-xs">
          {dbTables.map((t) => (
            <button
              key={t.name}
              aria-pressed={selectedTable === t.name}
              onClick={() => inspectTable(t.name)}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center space-x-2 ${
                selectedTable === t.name
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>{t.name}</span>
              <span
                className={`text-[10px] font-mono ${
                  selectedTable === t.name ? 'text-slate-300' : 'text-slate-500'
                }`}
              >
                ({t.row_count})
              </span>
            </button>
          ))}
        </div>

        {/* Data Table Preview */}
        {loadingTable && <p role="status" className="text-sm text-slate-500">Loading table…</p>}
        {tableData && (
          <div className="border border-slate-200 rounded-md overflow-hidden text-xs">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-900 font-mono">Table: {tableData.table}</span>
              <span className="text-[11px] text-slate-500">Showing top {tableData.rows.length} rows</span>
            </div>

            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider sticky top-0">
                  <tr>
                    {tableData.columns.map((c) => (
                      <th key={c} className="p-2.5 whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                  {tableData.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                      {tableData.columns.map((c) => (
                        <td key={c} className="p-2.5 whitespace-nowrap text-slate-800 max-w-xs truncate" title={String(row[c])}>
                          {row[c] !== null && row[c] !== undefined ? String(row[c]) : <span className="text-slate-400">NULL</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* 6. Developer API Documentation Card */}
      <Card className="rounded-md p-6 border-slate-200 bg-white shadow-subtle space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-clario-border">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-md bg-clario-navy/5 text-clario-navy">
              <Terminal className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-clario-navy">REST API Documentation & Swagger UI</h3>
              <p className="text-xs text-clario-text-secondary mt-0.5">
                Interactive OpenAPI schema, compliance audits, redline endpoints, and query testing
              </p>
            </div>
          </div>
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-clario-navy text-white hover:bg-slate-800 transition-colors shrink-0 shadow-xs"
          >
            <span>Open Swagger UI</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Access the backend Swagger UI directly at{' '}
          <code className="font-mono text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200">
            http://localhost:8000/docs
          </code>{' '}
          to inspect endpoints, test schemas, and integrate with external pipelines.
        </p>
      </Card>
    </div>
  );
};
