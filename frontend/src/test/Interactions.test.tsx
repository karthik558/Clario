import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GlobalSearchModal } from '../components/layout/GlobalSearchModal';
import { Layout } from '../components/layout/Layout';
import { DocumentsPage } from '../pages/DocumentsPage';
import { AskPage } from '../pages/AskPage';
import { SettingsPage } from '../pages/SettingsPage';
import { api } from '../services/api';
import { DocumentItem, SystemSettings } from '../types';

beforeEach(() => { vi.spyOn(api, 'getAnswerHistory').mockResolvedValue([]); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const documents = [
  { id: 'a', title: 'Policy A', filename: 'a.txt', collection: 'Policies', status: 'READY', file_type: 'txt', tags: [], created_at: '2026-01-01', updated_at: '2026-01-01', file_size: 100, page_count: 1, word_count: 20, chunk_count: 1 },
  { id: 'b', title: 'Contract B', filename: 'b.txt', collection: 'Contracts', status: 'READY', file_type: 'txt', tags: [], created_at: '2026-01-01', updated_at: '2026-01-01', file_size: 100, page_count: 1, word_count: 20, chunk_count: 1 },
] as DocumentItem[];

describe('Workspace interactions', () => {
  it('keeps collapsed links accessible and opens search with Ctrl K', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<MemoryRouter><Layout /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'Documents' })).toHaveAttribute('href', '/documents');
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog', { name: 'Search documents' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toHaveAttribute('aria-expanded', 'true');
  });
  it('persists sidebar state and restores it on reload', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    localStorage.clear();
    const { unmount } = render(<MemoryRouter><Layout /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(localStorage.getItem('clario_sidebar_collapsed')).toBe('true');
    unmount();

    // Re-render simulates page refresh
    render(<MemoryRouter><Layout /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false');
    localStorage.clear();
  });
  it('uses the clicked search mode and selects the source result', async () => {
    const result = { chunk_id: 'chunk-a', document_id: 'a', document_title: 'Policy A', page_number: 1, score: 1, snippet: 'Retention is 30 days.' };
    const search = vi.spyOn(api, 'search').mockResolvedValue({ results: [result], latency_ms: 1 });
    const select = vi.fn();
    render(<GlobalSearchModal isOpen onClose={vi.fn()} onSelectResult={select} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search passages' }), { target: { value: 'retention' } });
    for (const [name, mode] of [['BM25', 'bm25'], ['Vector', 'vector'], ['Hybrid', 'hybrid']]) {
      fireEvent.click(screen.getByRole('button', { name }));
      await waitFor(() => expect(search).toHaveBeenLastCalledWith('retention', mode, 5));
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true');
    }
    fireEvent.click(await screen.findByRole('button', { name: /Policy A/ }));
    expect(select).toHaveBeenCalledWith(result);
  });
  it('opens passages while lexical analysis is still loading', async () => {
    vi.spyOn(api, 'getDocuments').mockResolvedValue(documents);
    vi.spyOn(api, 'getDocument').mockResolvedValue({
      ...documents[0],
      chunks: [{ id: 'chunk-a', chunk_index: 0, page_number: 1, start_char: 0, end_char: 7, content: 'Passage', token_count: 1 }],
    });
    vi.spyOn(api, 'getWordAnalysis').mockImplementation(() => new Promise(() => {}));
    render(<DocumentsPage />);
    fireEvent.click(await screen.findByText('Policy A'));
    expect(await screen.findByText('Passage')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Lexical Analysis' }));
    expect(screen.getByText('Loading lexical analysis…')).toBeVisible();
  });
  it('keeps collection options when filters yield no documents', async () => {
    vi.spyOn(api, 'getDocuments').mockResolvedValue(documents);
    render(<DocumentsPage />);
    await screen.findByText('Policy A');
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Document collection' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'Policies' }));
    expect(screen.queryByText('Contract B')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Document status' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'Error' }));
    expect(screen.getByText('No documents found')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Document collection' }), { key: 'Enter' });
    expect(screen.getByRole('option', { name: 'Contracts' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('option', { name: 'Contracts' }), { key: 'Escape' });
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Document status' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'All Statuses' }));
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Document collection' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'Contracts' }));
    expect(screen.getByText('Contract B')).toBeInTheDocument();
  });
  it('toggles all document scope pills and resets the workspace scope', async () => {
    vi.spyOn(api, 'getDocuments').mockResolvedValue(documents);
    render(<AskPage />);
    const policy = await screen.findByRole('button', { name: 'Policy A' });
    const contract = screen.getByRole('button', { name: 'Contract B' });
    fireEvent.click(policy); fireEvent.click(contract);
    expect(policy).toHaveAttribute('aria-pressed', 'true');
    expect(contract).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Entire Workspace/ }));
    expect(policy).toHaveAttribute('aria-pressed', 'false');
    expect(contract).toHaveAttribute('aria-pressed', 'false');
  });
  it('preserves custom models and loads database pills', async () => {
    vi.spyOn(api, 'getSettings').mockResolvedValue({ llm_provider: 'ollama', ollama_model: 'custom-auditor', bm25_k1: 1.5, bm25_b: 0.75, rrf_k: 60, default_top_k: 5 } as SystemSettings);
    vi.spyOn(api, 'getOllamaStatus').mockResolvedValue({ running: true, models: ['llama3.2'], active_model: 'custom-auditor', url: 'http://localhost:11434', message: '' });
    vi.spyOn(api, 'getDatabaseTables').mockResolvedValue({ database_file: '', tables: [{ name: 'documents', row_count: 2 }, { name: 'findings', row_count: 1 }] });
    const inspect = vi.spyOn(api, 'inspectDatabaseTable').mockImplementation(async table => ({ table, columns: [], rows: [] }));
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByLabelText('Model name or custom model')).toHaveValue('custom-auditor'));
    fireEvent.change(screen.getByLabelText('Model name or custom model'), { target: { value: 'my-model' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check saved connection' }));
    await waitFor(() => expect(screen.getByLabelText('Model name or custom model')).toHaveValue('my-model'));
    fireEvent.click(await screen.findByRole('button', { name: /findings/ }));
    await waitFor(() => expect(inspect).toHaveBeenLastCalledWith('findings', 20));
  });
});
