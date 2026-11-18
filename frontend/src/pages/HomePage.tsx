import { ArrowRight, ArrowUpRight, CalendarDays, FileText, GitCompare, Layers, MessageSquareQuote } from 'lucide-react';
import { Link } from 'react-router-dom';

const workflows = [
  { path: '/ask', icon: MessageSquareQuote, title: 'Ask a document', detail: 'Ask in plain language and follow each citation back to the passage behind the answer.' },
  { path: '/compare', icon: GitCompare, title: 'Compare versions', detail: 'Review two versions side by side and see how the wording of a clause has changed.' },
  { path: '/obligations', icon: CalendarDays, title: 'Track obligations', detail: 'Bring deadlines, renewal windows and commitments into a single timeline.' },
];

export function HomePage() {
  return (
    <div className="min-h-screen bg-white text-clario-text">
      <header className="bg-clario-navy text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-10">
          <div className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
            <Layers aria-hidden="true" size={28} /> Clario
          </div>
          <Link to="/" className="flex items-center gap-2 text-sm font-medium text-slate-200 hover:text-white">
            Workspace <ArrowUpRight aria-hidden="true" size={16} />
          </Link>
        </div>
      </header>
      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 sm:px-10 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[.18em] text-slate-600">Document intelligence</p>
            <h1 className="max-w-xl text-5xl font-semibold leading-[1.05] tracking-[-.055em] sm:text-6xl xl:text-7xl">Your documents,<br />down to the clause.</h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-600">Find answers in contracts and policies, see what changed, and keep track of what comes next.</p>
            <Link to="/" className="mt-8 inline-flex items-center gap-4 rounded-md bg-clario-navy px-5 py-3 text-sm font-semibold text-white hover:bg-clario-navy-light">
              Open workspace <ArrowRight aria-hidden="true" size={17} />
            </Link>
          </div>
          <figure className="rounded-clario border border-slate-200 bg-slate-100 p-5 sm:p-9" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
            <figcaption className="mb-5 inline-block bg-slate-100 pr-2 text-xs font-medium text-slate-600">Example contract review</figcaption>
            <div className="mr-4 rounded-md border border-slate-200 bg-white shadow-card">
              <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3 text-xs font-medium text-slate-600">
                <FileText size={16} aria-hidden="true" /> Service agreement
              </div>
              <div className="p-5 sm:p-6">
                <p className="mb-3 text-xs text-slate-500">§ 4.2 &nbsp;·&nbsp; Renewal</p>
                <blockquote className="text-base leading-relaxed">“This agreement renews for one year unless either party gives <mark className="bg-amber-100 text-inherit">written notice at least 30 days</mark> before the end of the current term.”</blockquote>
              </div>
            </div>
            <div className="relative -mt-2 ml-5 rounded-md bg-clario-navy p-5 text-white shadow-elevated">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300"><MessageSquareQuote size={16} aria-hidden="true" /> Ask Clario</div>
              <p className="mt-3 font-semibold">When do we need to give notice?</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">Give written notice at least 30 days before the term ends.</p>
              <p className="mt-3 border-t border-white/15 pt-3 text-xs text-slate-300">Source · Service agreement, § 4.2</p>
            </div>
          </figure>
        </section>
        <section className="border-t border-clario-border bg-slate-50">
          <div className="mx-auto max-w-7xl px-5 py-12 sm:px-10 lg:py-16">
            <h2 className="text-3xl font-semibold tracking-tight">Explore the workspace</h2>
            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {workflows.map(({ path, icon: Icon, title, detail }) => (
                <Link key={path} to={path} className="group rounded-clario border border-clario-border bg-white p-6 transition-colors hover:border-slate-400">
                  <div className="flex items-center justify-between"><Icon aria-hidden="true" size={23} strokeWidth={1.6} /><ArrowUpRight aria-hidden="true" size={17} className="text-slate-400 group-hover:text-slate-900" /></div>
                  <h3 className="mt-6 text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{detail}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-clario-border bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-8 gap-y-4 px-5 py-7 sm:px-10">
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Layers aria-hidden="true" size={20} className="text-clario-navy" />
            © {new Date().getFullYear()} Clario
          </p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-6 text-sm text-slate-600">
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/cookies">Cookies</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
