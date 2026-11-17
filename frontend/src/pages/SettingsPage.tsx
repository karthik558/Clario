import React, { useState, useEffect } from 'react';
import {
  Settings,
  Cpu,
  Key,
  Sliders,
  Database,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Server
} from 'lucide-react';
import { api } from '../services/api';
import { SystemSettings } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [llmProvider, setLlmProvider] = useState('extractive');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [openaiApiKey, setOpenAIApiKey] = useState('');
  const [bm25K1, setBm25K1] = useState(1.5);
  const [bm25B, setBm25B] = useState(0.75);
  const [rrfK, setRrfK] = useState(60);
  const [defaultTopK, setDefaultTopK] = useState(5);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setSettings(data);
      setLlmProvider(data.llm_provider);
      setBm25K1(data.bm25_k1);
      setBm25B(data.bm25_b);
      setRrfK(data.rrf_k);
      setDefaultTopK(data.default_top_k);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
        gemini_api_key: geminiApiKey || undefined,
        openai_api_key: openaiApiKey || undefined,
        bm25_k1: bm25K1,
        bm25_b: bm25B,
        rrf_k: rrfK,
        default_top_k: defaultTopK,
      });
      setSuccessMsg('System configuration and IR parameters successfully updated.');
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
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-clario-text tracking-tight flex items-center space-x-2">
          <span>System Settings & Model Configuration</span>
          <Badge variant="navy" size="sm">Admin</Badge>
        </h2>
        <p className="text-xs text-clario-text-secondary">
          Configure Information Retrieval tuning parameters, LLM providers, and storage pipelines
        </p>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* AI & Research Assistant Model Engine */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-clario-border">
            <Cpu className="w-4 h-4 text-clario-teal" />
            <h3 className="font-semibold text-sm text-clario-navy">AI Assistant Generation Mode</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-clario-navy uppercase mb-1.5">
                Synthesis Engine
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    llmProvider === 'extractive'
                      ? 'border-clario-teal bg-clario-teal/5 ring-1 ring-clario-teal'
                      : 'border-clario-border bg-white hover:bg-clario-ivory'
                  }`}
                >
                  <input
                    type="radio"
                    name="provider"
                    value="extractive"
                    checked={llmProvider === 'extractive'}
                    onChange={(e) => setLlmProvider(e.target.value)}
                    className="hidden"
                  />
                  <div className="font-semibold text-clario-navy mb-1 flex items-center justify-between">
                    <span>Extractive Synthesis</span>
                    <Badge variant="sage" size="sm">0 Cost / Local</Badge>
                  </div>
                  <p className="text-[11px] text-clario-text-secondary leading-relaxed">
                    Zero-hallucination verbatim passage assembly. 100% offline, zero API keys required.
                  </p>
                </label>

                <label
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    llmProvider === 'gemini'
                      ? 'border-clario-teal bg-clario-teal/5 ring-1 ring-clario-teal'
                      : 'border-clario-border bg-white hover:bg-clario-ivory'
                  }`}
                >
                  <input
                    type="radio"
                    name="provider"
                    value="gemini"
                    checked={llmProvider === 'gemini'}
                    onChange={(e) => setLlmProvider(e.target.value)}
                    className="hidden"
                  />
                  <div className="font-semibold text-clario-navy mb-1 flex items-center justify-between">
                    <span>Google Gemini</span>
                    <Badge variant="gold" size="sm">API Key</Badge>
                  </div>
                  <p className="text-[11px] text-clario-text-secondary leading-relaxed">
                    Synthesizes comprehensive structured responses with Gemini 1.5 Flash.
                  </p>
                </label>

                <label
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    llmProvider === 'openai'
                      ? 'border-clario-teal bg-clario-teal/5 ring-1 ring-clario-teal'
                      : 'border-clario-border bg-white hover:bg-clario-ivory'
                  }`}
                >
                  <input
                    type="radio"
                    name="provider"
                    value="openai"
                    checked={llmProvider === 'openai'}
                    onChange={(e) => setLlmProvider(e.target.value)}
                    className="hidden"
                  />
                  <div className="font-semibold text-clario-navy mb-1 flex items-center justify-between">
                    <span>OpenAI GPT</span>
                    <Badge variant="navy" size="sm">API Key</Badge>
                  </div>
                  <p className="text-[11px] text-clario-text-secondary leading-relaxed">
                    Connects to GPT-4o-mini with bracketed evidence verification.
                  </p>
                </label>
              </div>
            </div>

            {llmProvider === 'gemini' && (
              <div className="pt-2 animate-in fade-in">
                <label className="block text-[11px] font-semibold text-clario-navy uppercase mb-1">
                  Gemini API Key
                </label>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder={settings?.gemini_api_key_configured ? '•••••••••••••••• (Configured)' : 'AIzaSy...'}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-clario-border bg-white focus:outline-none focus:border-clario-teal"
                />
              </div>
            )}

            {llmProvider === 'openai' && (
              <div className="pt-2 animate-in fade-in">
                <label className="block text-[11px] font-semibold text-clario-navy uppercase mb-1">
                  OpenAI API Key
                </label>
                <input
                  type="password"
                  value={openaiApiKey}
                  onChange={(e) => setOpenAIApiKey(e.target.value)}
                  placeholder={settings?.openai_api_key_configured ? '•••••••••••••••• (Configured)' : 'sk-...'}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-clario-border bg-white focus:outline-none focus:border-clario-teal"
                />
              </div>
            )}
          </div>
        </Card>

        {/* Information Retrieval (IR) Tuning Parameters */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-clario-border">
            <Sliders className="w-4 h-4 text-clario-teal" />
            <h3 className="font-semibold text-sm text-clario-navy">IR Algorithm Parameters</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-clario-navy uppercase mb-1">
                BM25 k1 Parameter (Term Saturation)
              </label>
              <input
                type="number"
                step="0.05"
                min="0.1"
                max="3.0"
                value={bm25K1}
                onChange={(e) => setBm25K1(parseFloat(e.target.value))}
                className="w-full text-xs px-3 py-2 rounded-lg border border-clario-border bg-white focus:outline-none font-mono"
              />
              <span className="text-[10px] text-clario-text-muted mt-1 block">Default: 1.5</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-clario-navy uppercase mb-1">
                BM25 b Parameter (Document Length Normalization)
              </label>
              <input
                type="number"
                step="0.05"
                min="0.0"
                max="1.0"
                value={bm25B}
                onChange={(e) => setBm25B(parseFloat(e.target.value))}
                className="w-full text-xs px-3 py-2 rounded-lg border border-clario-border bg-white focus:outline-none font-mono"
              />
              <span className="text-[10px] text-clario-text-muted mt-1 block">Default: 0.75</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-clario-navy uppercase mb-1">
                RRF Smoothing Constant (k)
              </label>
              <input
                type="number"
                min="1"
                max="200"
                value={rrfK}
                onChange={(e) => setRrfK(parseInt(e.target.value))}
                className="w-full text-xs px-3 py-2 rounded-lg border border-clario-border bg-white focus:outline-none font-mono"
              />
              <span className="text-[10px] text-clario-text-muted mt-1 block">Default: 60 (Standard in IR literature)</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-clario-navy uppercase mb-1">
                Default Top-K Retrieved Passages
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={defaultTopK}
                onChange={(e) => setDefaultTopK(parseInt(e.target.value))}
                className="w-full text-xs px-3 py-2 rounded-lg border border-clario-border bg-white focus:outline-none font-mono"
              />
              <span className="text-[10px] text-clario-text-muted mt-1 block">Default: 5</span>
            </div>
          </div>
        </Card>

        {/* Maintenance & Reindexing */}
        <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="font-semibold text-xs text-clario-navy uppercase tracking-wider mb-1">
              Corpus Index Synchronization
            </h4>
            <p className="text-xs text-clario-text-secondary">
              Reloads all document chunk vectors and rebuilds the in-memory BM25 Okapi index.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReindex}
            loading={reindexing}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Reindex All Chunks
          </Button>
        </Card>

        {/* Submit */}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="md" loading={saving}>
            Save Configuration
          </Button>
        </div>
      </form>
    </div>
  );
};
