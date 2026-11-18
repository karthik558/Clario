import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Modal } from '../components/ui/Modal';
import { Markdown } from '../components/ui/Markdown';
import { ComparePage } from '../pages/ComparePage';
import { workspaceDate } from '../utils/date';
import { ComparisonResponse, DocumentItem } from '../types';
import { AskPage } from '../pages/AskPage';
import { api } from '../services/api';
import { AskResponse } from '../types';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const answer: AskResponse = { query: 'Retention?', answer: '## Evidence summary\n\n**Thirty days**.\n\n| Version | Days |\n| --- | --- |\n| Prior | 30 |', mode: 'extractive', citations: [], retrieval_latency_ms: 1, synthesis_latency_ms: 2, has_conflicting_evidence: false };

describe('Document workspace polish', () => {
  it('portals dialogs outside page spacing and closes with the latest handler', () => {
    const first = vi.fn(); const latest = vi.fn();
    const { rerender } = render(<section data-testid="page"><Modal isOpen title="Document" onClose={first}>Passages</Modal></section>);
    expect(screen.getByTestId('page')).not.toContainElement(screen.getByRole('dialog'));
    rerender(<section data-testid="page"><Modal isOpen title="Document" onClose={latest}>Passages</Modal></section>);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close dialog' }), { key: 'Escape' });
    expect(latest).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });
  it('renders headings and tables while escaping raw HTML', () => {
    const { container } = render(<Markdown>{answer.answer + '\n\n<script>bad()</script>\n\n<img src="x" onerror="bad()" />'}</Markdown>);
    expect(screen.getByRole('heading', { name: 'Evidence summary' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(container.querySelector('strong')).toHaveTextContent('Thirty days');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
  it('restores saved answers and keeps the current question visible while generating', async () => {
    vi.spyOn(api, 'getDocuments').mockResolvedValue([]);
    vi.spyOn(api, 'getAnswerHistory').mockResolvedValue([{ id: 'saved', query: 'Earlier question', response: answer, document_ids: [], created_at: '2026-01-01' }]);
    let finish!: (response: AskResponse) => void;
    const ask = vi.spyOn(api, 'ask').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<AskPage />);
    await screen.findByText('Earlier question');
    const input = screen.getByRole('textbox', { name: 'Question about your documents' });
    fireEvent.change(input, { target: { value: 'Compare versions\nInclude retention.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    expect(ask).toHaveBeenCalledWith('Compare versions\nInclude retention.', undefined, undefined, true, 'gemma3:latest', 'ollama');
    expect(input).toBeDisabled();
    expect(screen.getByText(/Compare versions.*Include retention\./, { selector: 'p' })).toBeInTheDocument();
    finish(answer);
    await waitFor(() => expect(input).toBeEnabled());
    expect(input).toHaveValue('');
  });
  it('keeps the question for retry if saving or generation fails', async () => {
    vi.spyOn(api, 'getDocuments').mockResolvedValue([]);
    vi.spyOn(api, 'getAnswerHistory').mockResolvedValue([]);
    vi.spyOn(api, 'ask').mockRejectedValue(new Error('Unavailable'));
    render(<AskPage />);
    const input = screen.getByRole('textbox', { name: 'Question about your documents' });
    await waitFor(() => expect(input).toBeEnabled());
    fireEvent.change(input, { target: { value: 'Retention?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be generated or saved');
    expect(input).toHaveValue('Retention?');
  });
});

 it('interprets legacy UTC timestamps without shifting zoned timestamps', () => {
   expect(workspaceDate('2026-11-17T05:48:34').toISOString()).toBe('2026-11-17T05:48:34.000Z');
   expect(workspaceDate('2026-11-17T11:18:34+05:30').toISOString()).toBe('2026-11-17T05:48:34.000Z');
 });
 it('clears old comparison evidence when the selected document changes', async () => {
   const docs = ['a', 'b', 'c'].map(id => ({ id, title: `Policy ${id}`, file_type: 'txt' })) as DocumentItem[];
   vi.spyOn(api, 'getDocuments').mockResolvedValue(docs);
   vi.spyOn(api, 'compareDocuments').mockResolvedValue({ id: 'comparison', doc_a: docs[0], doc_b: docs[1], similarity_score: 0.5, added_tokens_count: 0, removed_tokens_count: 0, changed_sections_count: 0, summary: 'Evidence for A and B', contradiction_candidates: [], diff_blocks: [] } as unknown as ComparisonResponse);
   render(<ComparePage />);
   await waitFor(() => expect(screen.getByRole('button', { name: 'Compare' })).toBeEnabled());
   fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
   await screen.findByText('Evidence for A and B');
   fireEvent.keyDown(screen.getByRole('combobox', { name: /Document A/ }), { key: 'Enter' });
   fireEvent.click(screen.getByRole('option', { name: 'Policy c (TXT)' }));
   expect(screen.queryByText('Evidence for A and B')).not.toBeInTheDocument();
 });
