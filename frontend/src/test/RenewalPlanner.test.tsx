import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RenewalPlannerPage } from '../pages/RenewalPlannerPage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('exports the calculated leap-day deadline and rejects a negative notice period', async () => {
  render(<RenewalPlannerPage />);
  fireEvent.change(screen.getByLabelText('Renewal date'), { target: { value: '2028-03-01' } });
  const notice = screen.getByLabelText('Notice period in calendar days');
  fireEvent.change(notice, { target: { value: '1' } });
  const download = screen.getByRole('button', { name: 'Download calendar event' });
  vi.useFakeTimers();
  const create = vi.fn((_file: Blob) => 'blob:deadline');
  vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL = vi.fn(); });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  fireEvent.click(download);
  const calendar = create.mock.calls[0][0] as Blob;
  vi.runAllTimers();
  vi.useRealTimers();
  const reader = new FileReader();
  const contents = new Promise(resolve => { reader.onload = () => resolve(reader.result); });
  reader.readAsText(calendar);
  expect(await contents).toContain('DTSTART;VALUE=DATE:20280229');
  fireEvent.change(notice, { target: { value: '-1' } });
  expect(download).toBeDisabled();
});
