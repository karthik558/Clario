import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FileUploadZone } from '../components/documents/FileUploadZone';
import { api } from '../services/api';
import type { DocumentItem } from '../types';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it.each(['drop', 'picker'])('uploads every valid file from the %s and retries only failures', async mode => {
  const upload = vi.spyOn(api, 'uploadDocument').mockResolvedValue({} as DocumentItem)
    .mockRejectedValueOnce(new Error('Try again'));
  const refresh = vi.fn();
  const { container } = render(<FileUploadZone onUploadSuccess={refresh} />);
  const files = ['a.txt', 'bad.exe', 'b.md'].map(name => new File(['sample'], name));
  if (mode === 'drop') {
    fireEvent.drop(screen.getByRole('button', { name: 'Choose documents to upload' }), { dataTransfer: { files } });
  } else {
    const input = container.querySelector('input[type=file]')!;
    expect(input).toHaveAttribute('multiple');
    fireEvent.change(input, { target: { files } });
  }
  expect(screen.getByRole('alert')).toHaveTextContent('bad.exe');
  fireEvent.click(screen.getByRole('button', { name: 'Upload 2 documents' }));
  await waitFor(() => expect(refresh).toHaveBeenCalledWith(false));
  expect(upload.mock.calls.map(args => args[0].name)).toEqual(['a.txt', 'b.md']);
  expect(screen.getByRole('alert')).toHaveTextContent('a.txt: Try again');
  fireEvent.click(screen.getByRole('button', { name: 'Upload & Ingest' }));
  await waitFor(() => expect(refresh).toHaveBeenCalledWith(true));
  expect(upload.mock.calls.map(args => args[0].name)).toEqual(['a.txt', 'b.md', 'a.txt']);
});
