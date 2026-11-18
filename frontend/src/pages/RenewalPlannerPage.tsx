import { useState } from 'react';
import { CalendarDays, Download } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

function exampleRenewal() {
  const today = new Date();
  return new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + 90)).toISOString().slice(0, 10);
}

export function RenewalPlannerPage() {
  const [renewal, setRenewal] = useState(exampleRenewal);
  const [notice, setNotice] = useState('60');
  const due = new Date(renewal + 'T00:00:00Z');
  due.setUTCDate(due.getUTCDate() - Number(notice));
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(renewal) && /^\d+$/.test(notice) && due.getUTCFullYear() > 0;
  const download = () => {
    if (!valid) return;
    const day = due.toISOString().slice(0, 10).replace(/-/g, '');
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const calendar = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Clario//Renewal Planner//EN', 'BEGIN:VEVENT',
      `UID:renewal-${renewal}-${day}@clario.local`, `DTSTAMP:${timestamp}`, `DTSTART;VALUE=DATE:${day}`,
      'SUMMARY:Renewal notice deadline', `DESCRIPTION:${notice} calendar days before renewal on ${renewal}.`,
      'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
    const url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `renewal-notice-${day}.ics`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Renewal planner" description="Change the renewal date or notice period to see the last day to give notice. Save the deadline to your calendar." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-5 font-semibold">Contract terms</h2>
          <label className="block text-sm font-medium">Renewal date<input type="date" value={renewal} onChange={event => setRenewal(event.target.value)} className="mt-2 block w-full min-w-0 rounded-md border border-slate-300 p-2" /></label>
          <label className="mt-5 block text-sm font-medium">Notice period in calendar days<input type="number" min="0" step="1" value={notice} onChange={event => setNotice(event.target.value)} className="mt-2 block w-full rounded-md border border-slate-300 p-2" /></label>
        </Card>
        <section className="rounded-xl bg-clario-navy p-6 text-white">
          <h2 className="flex items-center gap-2 text-sm font-medium text-slate-200"><CalendarDays size={18} />Last day to give notice</h2>
          <p aria-live="polite" className="my-5 text-3xl font-semibold tracking-tight">{valid ? due.toLocaleDateString(undefined, { dateStyle: 'long', timeZone: 'UTC' }) : 'Enter a valid date and whole number of days.'}</p>
          <p className="mb-5 text-sm text-slate-300">Counts back from the renewal date, including weekends and holidays.</p>
          <Button variant="outline" disabled={!valid} onClick={download}><Download size={16} />Download calendar event</Button>
        </section>
      </div>
    </div>
  );
}
