import React, { useState, useEffect } from 'react';
import {
  Settings,
  Cpu,
  Sliders,
  Database,
  RefreshCw,
  CheckCircle2,
  Sparkles,
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
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const checkOllama = async () => {
    setCheckingOllama(true);
    try {
      const status = await api.getOllamaStatus();
      setOllamaStatus(status);
      if (status.models.length > 0 && !status.models.includes(ollamaModel)) {
        setOllamaModel(status.models[0]);
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
      console.error(err);
    }
  };

  const inspectTable = async (tableName: string) => {
    setSelectedTable(tableName);
    setLoadingTable(true);
    try {
      const data = await api.inspectDatabaseTable(tableName, 20);
      setTableData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTable(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
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
      setSuccessMsg('Configuration updated. AI assistant will now utilize selected engine.');
      fetchSettings();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    setSuccessMsg(null);
    try {
      const res = await api.reindexAll();
      setSuccessMsg(res.message || 'Search indices successfully reloaded.');
    } catch (err) {
      console.error(err);
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-[#14263D] tracking-tight flex items-center space-x-2">
          <span>System Settings & Local Ollama Integration</span>
          <Badge variant="navy" size="sm">Admin</Badge>
        </h2>
        <p className="text-xs text-[#748293] mt-0.5">
          Connect local Ollama models, inspect the SQLite database, and configure retrieval parameters
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2.5 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* Ollama Local Integration Card */}
      <Card className="rounded-2xl p-6 border-[#477E88]/40 bg-gradient-to-br from-white to-[#FCFBF8] shadow-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E4E8E6]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-[#477E88]/15 text-[#477E88]">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#14263D]">Local Ollama Model Integration</h3>
              <p className="text-xs text-[#748293] mt-0.5">
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
              Test Connection
            </Button>
            <Badge
              variant={ollamaStatus?.running ? 'sage' : 'red'}
              size="md"
              className="font-semibold"
            >
              {ollamaStatus?.running ? 'Ollama Online' : 'Ollama Offline'}
            </Badge>
          </div>
        </div>

        {/* Ollama Status Feedback */}
        <div className={`p-4 rounded-xl border text-xs ${
          ollamaStatus?.running
            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
            : 'bg-amber-50/60 border-amber-200 text-amber-900'
        }`}>
          <div className="flex items-center space-x-2 mb-1">
            {ollamaStatus?.running ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span className="font-bold">
              {ollamaStatus?.running ? 'Ollama Daemon Detected' : 'Ollama Daemon Not Detected Yet'}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed ml-6">
            {ollamaStatus?.running
              ? `Connected at ${ollamaUrl}. Detected ${ollamaStatus.models.length} model(s): [${ollamaStatus.models.join(', ') || 'None pulled yet'}].`
              : `To start Ollama, open your Mac terminal and run: 'ollama serve' or open the Ollama application.`}
          </p>
        </div>

        {/* Mode Selector & Model Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-[#14263D] uppercase tracking-wider mb-1.5">
              Generation Engine
            </label>
            <select
              value={llmProvider}
              onChange={(e) => setLlmProvider(e.target.value)}
              className="w-full text-xs bg-white border border-[#E4E8E6] rounded-xl px-3 py-2.5 font-semibold text-[#14263D] focus:outline-none focus:border-[#477E88]"
            >
              <option value="extractive">Built-in Extractive (Zero Hallucination, Fast)</option>
              <option value="ollama">Ollama Local API Model (Local LLM)</option>
              <option value="gemini">Google Gemini 1.5 Flash (Cloud API)</option>
              <option value="openai">OpenAI GPT-4o-mini (Cloud API)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#14263D] uppercase tracking-wider mb-1.5">
              Ollama Daemon URL
            </label>
            <input
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="w-full text-xs font-mono bg-white border border-[#E4E8E6] rounded-xl px-3 py-2.5 text-[#14263D] focus:outline-none focus:border-[#477E88]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#14263D] uppercase tracking-wider mb-1.5">
              Model Name / Custom Model
            </label>
            {ollamaStatus?.models && ollamaStatus.models.length > 0 ? (
              <select
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                className="w-full text-xs bg-white border border-[#E4E8E6] rounded-xl px-3 py-2.5 font-mono text-[#14263D] focus:outline-none focus:border-[#477E88]"
              >
                {ollamaStatus.models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                placeholder="llama3.2, mistral, or custom-model"
                className="w-full text-xs font-mono bg-white border border-[#E4E8E6] rounded-xl px-3 py-2.5 text-[#14263D] focus:outline-none focus:border-[#477E88]"
              />
            )}
          </div>
        </div>

        {/* Ollama Guide & User Creations Cheat Sheet */}
        <div className="p-4 rounded-xl bg-[#0F1D30] text-slate-200 text-xs font-mono space-y-2 border border-white/10">
          <div className="flex items-center space-x-2 text-[#D4AE72] font-semibold text-xs mb-1">
            <Terminal className="w-4 h-4" />
            <span>Ollama Commands & Custom User Model Creation Guide:</span>
          </div>
          <p className="text-[11px] text-slate-300">
            # 1. Download & run standard model:<br />
            <span className="text-[#A9D5C3]">ollama run llama3.2</span>
          </p>
          <p className="text-[11px] text-slate-300">
            # 2. How to create your own customized model (User Creation):<br />
            Create a file called <span className="text-[#D4AE72]">Modelfile</span> with:<br />
            <span className="text-white/80 pl-2">FROM llama3.2</span><br />
            <span className="text-white/80 pl-2">SYSTEM You are Clario Auditor, an expert in contracts and compliance.</span><br />
            Then build it in terminal:<br />
            <span className="text-[#A9D5C3]">ollama create clario-auditor -f ./Modelfile</span>
          </p>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" size="md" onClick={handleSave} loading={saving}>
            Save Ollama Configuration
          </Button>
        </div>
      </Card>

      {/* Database Explorer Section */}
      <Card className="rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E4E8E6]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-[#477E88]/10 text-[#477E88]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#14263D]">Interactive Database Explorer</h3>
              <p className="text-xs text-[#748293] mt-0.5">
                Inspect raw SQLite tables, document chunks, comparisons, and audit records directly
              </p>
            </div>
          </div>

          <div className="text-[11px] font-mono text-[#748293] bg-[#F8F7F3] px-3 py-1.5 rounded-xl border border-[#E4E8E6]">
            File: backend/data/clario.db
          </div>
        </div>

        {/* Tables Pill Switcher */}
        <div className="flex flex-wrap gap-2 text-xs">
          {dbTables.map((t) => (
            <button
              key={t.name}
              onClick={() => inspectTable(t.name)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center space-x-2 ${
                selectedTable === t.name
                  ? 'bg-[#14263D] text-white shadow-xs'
                  : 'bg-[#F8F7F3] text-[#748293] hover:text-[#14263D] hover:bg-[#F0EFEA] border border-[#E4E8E6]'
              }`}
            >
              <span>{t.name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedTable === t.name ? 'bg-white/20 text-white' : 'bg-[#E4E8E6] text-[#748293]'
              }`}>
                {t.row_count}
              </span>
            </button>
          ))}
        </div>

        {/* Data Table Preview */}
        {tableData && (
          <div className="border border-[#E4E8E6] rounded-xl overflow-hidden text-xs">
            <div className="p-3 bg-[#F8F7F3] border-b border-[#E4E8E6] flex items-center justify-between">
              <span className="font-bold text-[#14263D] font-mono">Table: {tableData.table}</span>
              <span className="text-[11px] text-[#748293]">Showing top {tableData.rows.length} rows</span>
            </div>

            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-[#FCFBF8] border-b border-[#E4E8E6] text-[10px] font-bold text-[#748293] uppercase tracking-wider sticky top-0">
                  <tr>
                    {tableData.columns.map((c) => (
                      <th key={c} className="p-2.5 whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E8E6] font-mono text-[11px]">
                  {tableData.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-[#F8F7F3] transition-colors">
                      {tableData.columns.map((c) => (
                        <td key={c} className="p-2.5 whitespace-nowrap text-[#233448] max-w-xs truncate" title={String(row[c])}>
                          {row[c] !== null && row[c] !== undefined ? String(row[c]) : <span className="text-slate-300">NULL</span>}
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
      <Card className="rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-2 pb-3 border-b border-[#E4E8E6]">
          <Sliders className="w-4 h-4 text-[#477E88]" />
          <h3 className="font-bold text-sm text-[#14263D]">IR Algorithm Tuning Parameters</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-[#14263D] uppercase tracking-wider mb-1">
              BM25 k1 Parameter (Term Saturation)
            </label>
            <input
              type="number"
              step="0.05"
              value={bm25K1}
              onChange={(e) => setBm25K1(parseFloat(e.target.value))}
              className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-[#E4E8E6] bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#14263D] uppercase tracking-wider mb-1">
              BM25 b Parameter (Length Normalization)
            </label>
            <input
              type="number"
              step="0.05"
              value={bm25B}
              onChange={(e) => setBm25B(parseFloat(e.target.value))}
              className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-[#E4E8E6] bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#14263D] uppercase tracking-wider mb-1">
              RRF Constant (k)
            </label>
            <input
              type="number"
              value={rrfK}
              onChange={(e) => setRrfK(parseInt(e.target.value))}
              className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-[#E4E8E6] bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#14263D] uppercase tracking-wider mb-1">
              Default Top-K Retrieved Chunks
            </label>
            <input
              type="number"
              value={defaultTopK}
              onChange={(e) => setDefaultTopK(parseInt(e.target.value))}
              className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-[#E4E8E6] bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-[#E4E8E6] flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={handleReindex} loading={reindexing}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Reindex All Chunks
          </Button>
          <Button variant="primary" size="md" onClick={handleSave} loading={saving}>
            Save All Settings
          </Button>
        </div>
      </Card>
    </div>
  );
};
