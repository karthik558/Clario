import { Select } from '../components/ui/Select';
import React, { useState, useEffect, useRef } from 'react';
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
  AlertCircle
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
  const [ollamaModel, setOllamaModel] = useState('llama3.2');
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [checkingOllama, setCheckingOllama] = useState(false);

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
      if (status.running && status.models && status.models.length > 0) {
        if (!status.models.includes(ollamaModel) || ollamaModel === 'llama3.2') {
          setOllamaModel(status.active_model && status.models.includes(status.active_model) ? status.active_model : status.models[0]);
        }
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
        bm25_k1: bm25K1,
        bm25_b: bm25B,
        rrf_k: rrfK,
        default_top_k: defaultTopK,
      });
      setSuccessMsg('Configuration saved to the database. New answers will use this engine.');
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
    <div className="space-y-8 max-w-5xl">
      {error && <p role="alert" className="p-4 rounded-md bg-rose-50 text-rose-800 text-sm">{error}</p>}
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-clario-navy tracking-tight flex items-center space-x-2">
          <span>Workspace settings</span>
        </h2>
        <p className="text-xs text-clario-text-secondary mt-0.5">
          Connect local Ollama models, inspect the SQLite database, and configure retrieval parameters
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2.5 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-clario-navy" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* Ollama Local Integration Card */}
      <Card className="rounded-md p-6 border-clario-teal/30 bg-white shadow-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-clario-border">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-md bg-clario-navy/5 text-clario-navy">
              <Bot className="w-5 h-5" />
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
              : `To start Ollama, open your Mac terminal and run: 'ollama serve' or open the Ollama application.`}
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
              className="w-full text-xs bg-white border border-clario-border rounded-md px-3 py-2.5 font-semibold text-clario-navy focus:outline-none focus:border-clario-teal"
            >
              <option value="extractive">Extractive · retrieved passages</option>
              <option value="ollama">Ollama · local model</option>
              <option value="gemini">Google Gemini · cloud</option>
              <option value="openai">OpenAI · cloud</option>
            </Select>
          </div>

          <div>
            <label htmlFor="ollamaUrl" className="block text-[11px] font-bold text-clario-navy uppercase tracking-wider mb-1.5">
              Ollama Daemon URL
            </label>
            <input id="ollamaUrl" type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="w-full text-xs font-mono bg-white border border-clario-border rounded-md px-3 py-2.5 text-clario-text focus:outline-none focus:border-clario-teal"
            />
          </div>

          <div>
            <label htmlFor="ollamaModel" className="block text-[11px] font-bold text-clario-navy uppercase tracking-wider mb-1.5">
              Model Name / Custom Model
            </label>
            <input id="ollamaModel" aria-label="Model name or custom model" value={ollamaModel} onChange={e => setOllamaModel(e.target.value)} placeholder="llama3.2 or your custom model" className="w-full text-sm font-mono bg-white border border-clario-border text-clario-text rounded-md px-3 py-2.5" />
            {ollamaStatus && ollamaStatus.models.length > 0 && <Select aria-label="Installed Ollama models" value={ollamaStatus.models.includes(ollamaModel) ? ollamaModel : ''} onChange={e => { if (e.target.value) setOllamaModel(e.target.value); }} className="w-full mt-2 border border-clario-border bg-white text-clario-text p-2 text-xs rounded-md"><option value="">Choose an installed model</option>{ollamaStatus.models.map(model => <option key={model} value={model}>{model}</option>)}</Select>}
          </div>
        </div>

        <details className="border-t border-clario-border pt-4 text-sm">
          <summary className="cursor-pointer font-medium text-clario-navy">Set up Ollama or a custom model</summary>
          <div className="mt-4 space-y-3 text-clario-text-secondary">
            <p>Install <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="text-clario-teal underline">Ollama</a>, open the app, and download a model in your terminal:</p>
            <pre className="bg-clario-ivory border border-clario-border rounded p-3 overflow-x-auto text-xs text-clario-text">ollama pull llama3.2</pre>
            <p>Choose Ollama above, enter the exact installed model name, and save the configuration. Custom models created in Ollama work in the same field.</p>
            <p className="text-xs">These are setup instructions. Commands are run in your own terminal.</p>
          </div>
        </details>

        <div className="flex justify-end">
          <Button variant="primary" size="md" onClick={handleSave} loading={saving} disabled={loading}>
            Save configuration
          </Button>
        </div>
      </Card>

      {/* Database Explorer Section */}
      <Card className="rounded-md p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-clario-border">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-md bg-clario-navy/5 text-clario-navy">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-clario-navy">Interactive Database Explorer</h3>
              <p className="text-xs text-clario-text-secondary mt-0.5">
                Inspect raw SQLite tables, document chunks, comparisons, and audit records directly
              </p>
            </div>
          </div>

          <div className="text-[11px] font-mono text-clario-text-secondary bg-clario-ivory px-3 py-1.5 rounded-md border border-clario-border">
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
                  ? 'bg-clario-navy text-white shadow-xs'
                  : 'bg-clario-ivory text-clario-text-secondary hover:text-clario-navy hover:bg-clario-ivory-muted border border-clario-border'
              }`}
            >
              <span>{t.name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded ${
                selectedTable === t.name ? 'bg-white/20 text-white' : 'bg-clario-border text-clario-text-secondary'
              }`}>
                {t.row_count}
              </span>
            </button>
          ))}
        </div>

        {/* Data Table Preview */}
        {loadingTable && <p role="status" className="text-sm text-clario-text-secondary">Loading table…</p>}
        {tableData && (
          <div className="border border-clario-border rounded-md overflow-hidden text-xs">
            <div className="p-3 bg-clario-ivory border-b border-clario-border flex items-center justify-between">
              <span className="font-bold text-clario-navy font-mono">Table: {tableData.table}</span>
              <span className="text-[11px] text-clario-text-secondary">Showing top {tableData.rows.length} rows</span>
            </div>

            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-clario-ivory-card border-b border-clario-border text-[10px] font-bold text-clario-text-secondary uppercase tracking-wider sticky top-0">
                  <tr>
                    {tableData.columns.map((c) => (
                      <th key={c} className="p-2.5 whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-clario-border font-mono text-[11px]">
                  {tableData.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-clario-ivory transition-colors">
                      {tableData.columns.map((c) => (
                        <td key={c} className="p-2.5 whitespace-nowrap text-clario-text max-w-xs truncate" title={String(row[c])}>
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
      <Card className="rounded-md p-6 space-y-4">
        <div className="flex items-center space-x-2 pb-3 border-b border-[#E4E8E6]">
          <Sliders className="w-4 h-4 text-[#477E88]" />
          <h3 className="font-bold text-sm text-[#14263D]">IR Algorithm Tuning Parameters</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label htmlFor="bm25K1" className="block text-[11px] font-bold text-[#14263D] uppercase tracking-wider mb-1">
              BM25 k1 Parameter (Term Saturation)
            </label>
            <input id="bm25K1" type="number"
              step="0.05"
              value={bm25K1}
              onChange={(e) => setBm25K1(parseFloat(e.target.value))}
              className="w-full text-xs font-mono px-3 py-2 rounded-md border border-[#E4E8E6] bg-white focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="bm25B" className="block text-[11px] font-bold text-[#14263D] uppercase tracking-wider mb-1">
              BM25 b Parameter (Length Normalization)
            </label>
            <input id="bm25B" type="number"
              step="0.05"
              value={bm25B}
              onChange={(e) => setBm25B(parseFloat(e.target.value))}
              className="w-full text-xs font-mono px-3 py-2 rounded-md border border-[#E4E8E6] bg-white focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="rrfK" className="block text-[11px] font-bold text-[#14263D] uppercase tracking-wider mb-1">
              RRF Constant (k)
            </label>
            <input id="rrfK" type="number"
              value={rrfK}
              onChange={(e) => setRrfK(parseInt(e.target.value))}
              className="w-full text-xs font-mono px-3 py-2 rounded-md border border-[#E4E8E6] bg-white focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="defaultTopK" className="block text-[11px] font-bold text-[#14263D] uppercase tracking-wider mb-1">
              Default Top-K Retrieved Chunks
            </label>
            <input id="defaultTopK" type="number"
              value={defaultTopK}
              onChange={(e) => setDefaultTopK(parseInt(e.target.value))}
              className="w-full text-xs font-mono px-3 py-2 rounded-md border border-[#E4E8E6] bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-[#E4E8E6] flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={handleReindex} loading={reindexing}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Reindex All Chunks
          </Button>
          <Button variant="primary" size="md" onClick={handleSave} loading={saving} disabled={loading}>
            Save All Settings
          </Button>
        </div>
      </Card>
    </div>
  );
};
