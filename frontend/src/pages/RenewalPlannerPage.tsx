import { useState } from 'react';
import { CalendarDays, Download, Clock, AlertTriangle, CheckCircle2, Calendar, ArrowRight } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

function exampleRenewal() {
  const today = new Date();
  return new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + 90)).toISOString().slice(0, 10);
}

export function RenewalPlannerPage() {
  const [renewal, setRenewal] = useState(exampleRenewal);
  const [notice, setNotice] = useState('60');
  const due = new Date(renewal + 'T00:00:00Z');
  due.setUTCDate(due.getUTCDate() - Number(notice));
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(renewal) && /^\d+$/.test(notice) && Number(notice) >= 0 && due.getUTCFullYear() > 0;

  const download = () => {
    if (!valid) return;
    const day = due.toISOString().slice(0, 10).replace(/-/g, '');
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const calendar = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Clario//Renewal Planner//EN',
      'BEGIN:VEVENT',
      `UID:renewal-${renewal}-${day}@clario.local`,
      `DTSTAMP:${timestamp}`,
      `DTSTART;VALUE=DATE:${day}`,
      'SUMMARY:Contract Renewal Notice Deadline',
      `DESCRIPTION:Formal non-renewal notice deadline: ${notice} calendar days prior to contract renewal on ${renewal}.`,
      'END:VEVENT',
      'END:VCALENDAR',
      ''
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `renewal-notice-${day}.ics`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const formattedDueDate = valid
    ? due.toLocaleDateString(undefined, { dateStyle: 'long', timeZone: 'UTC' })
    : 'Invalid Parameters';

  const formattedRenewalDate = /^\d{4}-\d{2}-\d{2}$/.test(renewal)
    ? new Date(renewal + 'T00:00:00Z').toLocaleDateString(undefined, { dateStyle: 'medium', timeZone: 'UTC' })
    : '—';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Renewal planner"
        description="Calculate binding non-renewal notice cut-off deadlines and export calendar reminders to prevent auto-renewal lock-in."
      />

      {/* Standard KPI Stat Ribbon matching Overview, Documents, Compliance, Critique */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Target Renewal Date
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-xl font-semibold tracking-tight text-clario-navy font-mono">
            {formattedRenewalDate}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Contract expiration milestone
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Notice Window
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-xl font-semibold tracking-tight text-clario-navy font-mono">
            {valid ? `${notice} Days` : '—'}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Prior non-renewal notice
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Notice Cut-Off Deadline
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-xl font-semibold tracking-tight text-clario-navy font-mono">
            {valid ? due.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '—'}
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Latest dispatch deadline
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
          <div className="flex items-center justify-between text-clario-text-secondary mb-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Calendar Sync
            </span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <Download className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-xl font-semibold tracking-tight text-clario-navy font-mono">
            iCalendar (.ics)
          </span>
          <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
            Google / Outlook / Apple
          </span>
        </Card>
      </div>

      {/* Main Form & Calculation Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Input Form */}
        <Card className="p-6 bg-white border border-slate-200 shadow-xs space-y-5 rounded-md">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Contract Renewal Parameters
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Specify the target contract renewal anniversary and the mandated advance notice window.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Renewal date
                <input
                  type="date"
                  value={renewal}
                  onChange={event => setRenewal(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 shadow-xs focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </label>
              <p className="text-[11px] text-slate-400 mt-1">
                The date the existing contract term ends or automatically rolls over.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Notice period in calendar days
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={notice}
                  onChange={event => setNotice(event.target.value)}
                  placeholder="e.g. 30, 60, 90"
                  className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 shadow-xs focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </label>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[10px] text-slate-400 uppercase font-semibold mr-1">Presets:</span>
                {['30', '60', '90', '120'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNotice(preset)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-mono border transition-colors ${
                      notice === preset
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {preset}d
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Right Column: Calculated Deadline Card */}
        <Card className="p-6 bg-white border border-slate-200 shadow-xs flex flex-col justify-between rounded-md space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900">
                <CalendarDays className="w-4 h-4 text-slate-700" />
                <span>Last day to give notice</span>
              </h2>
              <Badge variant={valid ? 'red' : 'gray'} size="sm">
                {valid ? 'Firm Deadline' : 'Awaiting Input'}
              </Badge>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Notice Cut-Off
              </span>
              <p aria-live="polite" className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
                {valid ? formattedDueDate : 'Enter a valid date and whole number of days.'}
              </p>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-md border border-slate-100">
              Counts back from the renewal date, including weekends and holidays. Delivering notice after this date constitutes an automatic contractual extension.
            </p>
          </div>

          {/* Timeline Visual Progress */}
          {valid && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Milestone Sequence
              </span>
              <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-md border border-slate-100">
                <div className="text-left">
                  <span className="text-[10px] text-rose-600 font-bold block uppercase">Notice Deadline</span>
                  <span className="font-mono text-[11px] font-medium text-slate-900">{due.toISOString().slice(0, 10)}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="text-center px-2">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Notice Gap</span>
                  <span className="font-mono text-[11px] font-semibold text-slate-800">{notice} days</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="text-right">
                  <span className="text-[10px] text-slate-600 font-bold block uppercase">Renewal Effective</span>
                  <span className="font-mono text-[11px] font-medium text-slate-900">{renewal}</span>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-start sm:justify-end">
            <Button
              variant="primary"
              disabled={!valid}
              onClick={download}
              className="flex items-center gap-2 text-xs font-semibold px-4 py-2"
            >
              <Download className="w-4 h-4" />
              <span>Download calendar event</span>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
