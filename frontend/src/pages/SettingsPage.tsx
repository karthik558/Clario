import { PageHeader } from '../components/layout/PageHeader';
import { Select } from '../components/ui/Select';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Settings,
  Cpu,
  Sliders,
  Database,
  RefreshCw,
  CheckCircle2,
  SearchCheck,
  ShieldCheck,
  Bot,
  ExternalLink,
  Terminal,
  Layers,
  Table,
  Check,
  AlertCircle,
  Brain,
  SlidersHorizontal
} from 'lucide-react';
import { api } from '../services/api';
import { SystemSettings, OllamaStatus, DBTableInfo } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [error, setError] = useState('');
  const tableRequest = useRef(0);

  // Ollama State
  const [llmProvider, setLlmProvider] = useState('extractive');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('');
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [checkingOllama, setCheckingOllama] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);

  const availableModels = useMemo<string[]>(() => {
    return ollamaStatus?.models || [];
  }, [ollamaStatus]);

  // AI Tuning State
  const [thinkingMode, setThinkingMode] = useState(true);
  const [answerLength, setAnswerLength] = useState<'concise' | 'standard' | 'comprehensive'>('standard');

  // Database Explorer State
  const [dbTables, setDbTables] = useState<DBTableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('documents');
  const [tableData, setTableData] = useState<{ table: string; columns: string[]; rows: any[] } | null>(null);
  const [loadingTable, setLoadingTable] = useState(false);

  // IR Tuning State
  const [bm25K1, setBm25K1] = useState(1.5);
  const [bm25B, setBm25B] = useState(0.75);
  const [rrfK, setRrfK] = useState(60);
  const [defaultTopK, setDefaultTopK] = useState(5);

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
      setBm25K1(data.bm25_k1);
      setBm25B(data.bm25_b);
      setRrfK(data.rrf_k);
      setDefaultTopK(data.default_top_k);

      // Check Ollama status
      checkOllama();

      // Fetch DB tables
      fetchDatabaseTables();
    } catch (err) {
      setError('The operation failed. Check the connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const checkOllama = async () => {
    setCheckingOllama(true);
    try {
      const status = await api.getOllamaStatus();
      setOllamaStatus(status);
      if (status.active_model) {
        setOllamaModel(status.active_model);
      }
    } catch (err) {
      setOllamaStatus({
        running: false,
        url: ollamaUrl,
        models: [],
        active_model: ollamaModel,
        message: 'Could not connect to Ollama daemon on http://localhost:11434'
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
    } catch (err) {
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
    } catch (err) {
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
        llm_provider: 'ollama',
        ollama_base_url: ollamaUrl,
        ollama_model: model,
        local_ai_model: model,
      });
      setLlmProvider('ollama');
      setOllamaModel(model);
      setSuccessMsg(`Model successfully saved as "${model}". Header indicator synchronized.`);
      window.dispatchEvent(
        new CustomEvent('clario:settings-updated', {
          detail: { llm_provider: 'ollama', ollama_model: model },
        })
      );
    } catch {
      setError('Failed to update model. Please verify the Ollama daemon connection.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ollamaModel.trim() || !/^https?:\/\/[^\s]+$/.test(ollamaUrl) || !Number.isFinite(bm25K1) || bm25K1 <= 0 || bm25K1 > 10 || !Number.isFinite(bm25B) || bm25B < 0 || bm25B > 1 || !Number.isInteger(rrfK) || rrfK < 1 || rrfK > 1000 || !Number.isInteger(defaultTopK) || defaultTopK < 1 || defaultTopK > 50) {
      setError('Enter a model name and HTTP(S) URL. BM25 k1 must be 0–10 (exclusive of 0), b 0–1, RRF 1–1000, and Top-K 1–50.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccessMsg(null);
    try {
      await api.updateSettings({
        llm_provider: llmProvider,
        ollama_base_url: ollamaUrl,
        ollama_model: ollamaModel,
        thinking_mode: thinkingMode,
        answer_length: answerLength,
        bm25_k1: bm25K1,
        bm25_b: bm25B,
        rrf_k: rrfK,
        default_top_k: defaultTopK,
      });
      setSuccessMsg('Configuration saved to the database. New answers will use this engine.');
      window.dispatchEvent(
        new CustomEvent('clario:settings-updated', {
          detail: { llm_provider: llmProvider, ollama_model: ollamaModel },
        })
      );
      fetchSettings();
    } catch (err) {
      setError('Configuration was not saved. Check the model name, server URL, and numeric ranges.');
    } finally {
      setSaving(false);
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    setError('');
    setSuccessMsg(null);
    try {
      const res = await api.reindexAll();
      setSuccessMsg(res.message || 'Search indices successfully reloaded.');
    } catch (err) {
      setError('The operation failed. Check the connection and try again.');
    } finally {
      setReindexing(false);
    }
  };

  if (loading && !settings) return <p role="status" className="text-sm text-clario-text-secondary">Loading saved workspace settings…</p>;

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="p-4 rounded-md bg-rose-50 text-rose-800 text-sm border border-rose-200">{error}</p>}
      {/* Header */}
      <PageHeader title="Workspace settings" description="Configure model connections and retrieval, and inspect the workspace database.">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-clario-navy text-white hover:bg-slate-800 transition-colors shadow-xs"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Open API Docs</span>
            <ExternalLink className="w-3 h-3 text-slate-300" />
          </a>
        </div>
      </PageHeader>

      {successMsg && (
        <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2.5 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-clario-navy" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* Ollama Local Integration Card */}
      <Card className="rounded-md p-6 bg-white shadow-subtle border border-slate-200 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-clario-border">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-md bg-clario-navy/5 text-clario-navy">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-clario-navy">Local Ollama Model Integration</h3>
              <p className="text-xs text-clario-text-secondary mt-0.5">
                Run local models like Llama 3.2, Mistral, or custom user creations with zero API fees
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={checkOllama}
              loading={checkingOllama}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Check saved connection
            </Button>
            <Badge
              variant={ollamaStatus?.running ? 'sage' : 'red'}
              size="md"
              className="font-semibold"
            >
              {checkingOllama ? 'Checking connection…' : ollamaStatus?.running ? 'Ollama Online' : 'Ollama Offline'}
            </Badge>
          </div>
        </div>

        {/* Ollama Status Feedback */}
        <div className={`p-4 rounded-md border text-xs ${
          ollamaStatus?.running
            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
            : 'bg-amber-50/60 border-amber-200 text-amber-900'
        }`}>
          <div className="flex items-center space-x-2 mb-1">
            {ollamaStatus?.running ? (
              <Check className="w-4 h-4 text-clario-navy shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-clario-navy shrink-0" />
            )}
            <span className="font-bold">
              {checkingOllama ? 'Checking the saved server address…' : ollamaStatus?.running ? 'Ollama connected' : 'Ollama is unavailable'}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
          <div>
            <label htmlFor="llmProvider" className="block text-[11px] font-bold text-clario-navy uppercase tracking-wider mb-1.5">
              Generation Engine
            </label>
            <Select id="llmProvider" value={llmProvider}
              onChange={(e) => setLlmProvider(e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-md px-3 py-2.5 font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
            >
              <option value="extractive">Extractive · retrieved passages</option>
              <option value="ollama">Ollama · local model</option>
              <option value="gemini">Google Gemini · cloud</option>
              <option value="openai">OpenAI · cloud</option>
            </Select>
          </div>

          <div>
            <label htmlFor="ollamaUrl" className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1.5">
              Ollama Daemon URL
            </label>
            <input id="ollamaUrl" type="text"
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
                disabled={saving || !ollamaModel.trim()}
                className="h-8 px-3 text-xs font-semibold shrink-0"
              >
                Save
              </Button>
            </div>

            {/* Custom model text input if custom is chosen or model is external/custom */}
            {(showCustomInput || !availableModels.includes(ollamaModel)) && (
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

        <details className="border-t border-clario-border pt-4 text-sm">
          <summary className="cursor-pointer font-medium text-clario-navy">Set up Ollama or a custom model</summary>
          <div className="mt-4 space-y-3 text-slate-600">
            <p>Install <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="text-slate-900 underline font-medium">Ollama</a>, launch the application, and download any model from your terminal ({typeof navigator !== 'undefined' && /win/i.test(navigator.userAgent || '') ? 'PowerShell or Command Prompt' : 'Terminal'}):</p>
            <pre className="bg-slate-50 border border-slate-200 rounded-md p-3 overflow-x-auto text-xs text-slate-800">ollama pull llama3.2</pre>
            <p>Select your installed model from the dropdown above and click Save. Custom models created in Ollama also work in the custom field.</p>
            <p className="text-xs">These are setup instructions. Commands are run in your own terminal.</p>
          </div>
        </details>

        {/* Global AI Synthesis Profile */}
        <div className="border-t border-slate-200 pt-4 space-y-3">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-clario-navy" />
              Global AI Synthesis & Reasoning Profile
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Configure universal generation speed, reasoning depth, and response verbosity across Ask Clario, Red Team Critique, and Negotiation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Thinking Mode */}
            <div className="p-3.5 rounded-md border border-slate-200 bg-slate-50/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">Global Thinking Mode</span>
                <button
                  type="button"
                  onClick={() => setThinkingMode(!thinkingMode)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                    thinkingMode
                      ? 'bg-navy-50 text-navy-900 border-navy-800 ring-1 ring-navy-800 font-semibold'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Brain className={`w-3.5 h-3.5 ${thinkingMode ? 'text-navy-900' : 'text-slate-400'}`} />
                  <span>{thinkingMode ? 'ON' : 'OFF'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                When enabled, AI models synthesize and display explicit step-by-step audit reasoning chains across all pages.
              </p>
            </div>

            {/* Response Length & Generation Speed */}
            <div className="p-3.5 rounded-md border border-slate-200 bg-slate-50/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">Response Length & Speed</span>
              </div>
              <div className="grid grid-cols-3 gap-1 p-0.5 rounded-md border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setAnswerLength('concise')}
                  className={`py-1 px-1.5 rounded-md text-[11px] font-medium text-center transition-all ${
                    answerLength === 'concise'
                      ? 'bg-clario-navy text-white font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Fastest generation time with short, punchy answers"
                >
                  Concise
                </button>
                <button
                  type="button"
                  onClick={() => setAnswerLength('standard')}
                  className={`py-1 px-1.5 rounded-md text-[11px] font-medium text-center transition-all ${
                    answerLength === 'standard'
                      ? 'bg-clario-navy text-white font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Balanced default answer length"
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => setAnswerLength('comprehensive')}
                  className={`py-1 px-1.5 rounded-md text-[11px] font-medium text-center transition-all ${
                    answerLength === 'comprehensive'
                      ? 'bg-clario-navy text-white font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Exhaustive, in-depth legal analysis"
                >
                  Deep
                </button>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {answerLength === 'concise'
                  ? 'Ultra-concise output (220 tokens max) to drastically reduce AI generation time.'
                  : answerLength === 'comprehensive'
                  ? 'Exhaustive multi-section breakdown with comprehensive clause citations.'
                  : 'Balanced synthesis (default) optimizing quality and generation speed.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" size="md" onClick={handleSave} loading={saving} disabled={loading}>
            Save configuration
          </Button>
        </div>
      </Card>

      {/* Database Explorer Section */}
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

        {/* Tables Pill Switcher */}
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
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                selectedTable === t.name ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {t.row_count}
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
                      <th key={c} className="p-2.5 whitespace-nowrap">{c}</th>
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

      {/* Information Retrieval (IR) Tuning */}
      <Card className="rounded-md p-6 bg-white shadow-subtle border border-slate-200 space-y-4">
        <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-200">
          <div className="p-1.5 rounded-md bg-clario-navy/5 text-clario-navy">
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">IR Algorithm Tuning Parameters</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Fine-tune term saturation, length normalization, reciprocal rank fusion, and retrieval depth.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label htmlFor="bm25K1" className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
              BM25 k1 (Term Saturation)
            </label>
            <input id="bm25K1" type="number"
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
            <input id="bm25B" type="number"
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
            <input id="rrfK" type="number"
              value={rrfK}
              onChange={(e) => setRrfK(parseInt(e.target.value))}
              className="w-full text-xs font-mono px-3 py-2 rounded-md border border-slate-200 bg-white focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="defaultTopK" className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
              Default Top-K Chunks
            </label>
            <input id="defaultTopK" type="number"
              value={defaultTopK}
              onChange={(e) => setDefaultTopK(parseInt(e.target.value))}
              className="w-full text-xs font-mono px-3 py-2 rounded-md border border-slate-200 bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={handleReindex} loading={reindexing}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Reindex All Chunks
          </Button>
          <Button variant="primary" size="md" onClick={handleSave} loading={saving} disabled={loading}>
            Save All Settings
          </Button>
        </div>
      </Card>

      {/* Developer API Documentation Card */}
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
          Access the backend Swagger UI directly at <code className="font-mono text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200">http://localhost:8000/docs</code> to inspect endpoints, test schemas, and integrate with external pipelines.
        </p>
      </Card>
    </div>
  );
};
