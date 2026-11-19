import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  FileText,
  GitCompare,
  MessageSquareQuote,
  ShieldCheck,
  Scale,
  CheckCircle2,
  BarChart3,
  ChevronDown
} from 'lucide-react';
import { Link } from 'react-router-dom';

const workflows = [
  {
    path: '/ask',
    icon: MessageSquareQuote,
    title: 'Ask a document',
    detail: 'Ask questions in plain language and follow each citation directly back to the original source passage.'
  },
  {
    path: '/compare',
    icon: GitCompare,
    title: 'Compare versions',
    detail: 'Review two versions side by side to see how the specific wording of a clause has changed.'
  },
  {
    path: '/obligations',
    icon: CalendarDays,
    title: 'Track obligations',
    detail: 'Bring notice windows, renewal deadlines, and operational commitments into a single clear timeline.'
  },
  {
    path: '/critique',
    icon: ShieldCheck,
    title: 'Red team critique',
    detail: 'Review contract provisions across legal, financial, security, and operational perspectives.'
  },
  {
    path: '/negotiate',
    icon: Scale,
    title: 'Clause redline',
    detail: 'Review suggested compromise language and draft counter-proposals with clear risk context.'
  },
  {
    path: '/policy-checker',
    icon: CheckCircle2,
    title: 'Policy verification',
    detail: 'Check draft agreements against company policy guidelines to catch potential issues early.'
  },
];

const faqs = [
  {
    q: 'How does citation verification work in Clario?',
    a: 'Every answer and finding includes a direct reference to the specific document, section, and page number. Clicking a citation opens the original document so you can verify the text yourself.'
  },
  {
    q: 'What file types can be reviewed?',
    a: 'Clario supports PDF documents, Microsoft Word (.docx), Excel spreadsheets (.xlsx, .xls), plain text (.txt), and Markdown (.md) files.'
  },
  {
    q: 'How does version comparison detect changes?',
    a: 'Comparison examines text differences at the clause level, highlighting additions, removals, and modifications so you can see changes even when formatting or paragraph order shifts.'
  },
  {
    q: 'Can reports and findings be exported?',
    a: 'Yes. You can export complete executive briefings, comparison findings, and obligation summaries as formatted PDF reports or calendar events.'
  }
];

export function HomePage() {
  const [showPreloader, setShowPreloader] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      const removeTimer = setTimeout(() => {
        setShowPreloader(false);
      }, 500);
      return () => clearTimeout(removeTimer);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  const enterWorkspace = () => {
    try {
      sessionStorage.setItem('clario_workspace_entered', 'true');
    } catch {
      // Non-fatal
    }
  };

  return (
    <div className="min-h-screen bg-white text-clario-text font-sans antialiased selection:bg-clario-navy selection:text-white">
      {/* Home Page Preloader with smooth timing and zero workspace text */}
      {showPreloader && (
        <div
          role="status"
          aria-label="Loading"
          className={`fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a] transition-opacity duration-500 ease-in-out ${
            fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="flex flex-col items-center justify-center">
            <img
              src="/clario.webp"
              alt="Clario"
              className="w-44 sm:w-56 h-auto object-contain select-none animate-pulse"
            />
          </div>
        </div>
      )}

      {/* Clean, Professional Website Header */}
      <header className="bg-clario-navy text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-10">
          <Link to="/home" className="flex items-center gap-2.5">
            <img src="/clario.webp" alt="Clario" width="784" height="196" className="h-8 w-auto" />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>

          <Link
            to="/"
            onClick={enterWorkspace}
            className="flex items-center gap-2 text-sm font-medium text-slate-200 hover:text-white transition-colors"
          >
            Workspace <ArrowUpRight aria-hidden="true" size={16} />
          </Link>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-10 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[.18em] text-slate-500">
              Contract & Document Intelligence
            </p>
            <h1 className="max-w-xl text-5xl font-semibold leading-[1.05] tracking-[-.055em] sm:text-6xl xl:text-7xl text-slate-900">
              Your documents,<br />down to the clause.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-600">
              Find answers in contracts and policies, see what changed between revisions, and keep track of key obligations.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <Link
                to="/"
                onClick={enterWorkspace}
                className="inline-flex items-center gap-3 rounded-md bg-clario-navy px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                Open workspace <ArrowRight aria-hidden="true" size={17} />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900 transition-colors"
              >
                Learn more
              </a>
            </div>
          </div>

          {/* Clean Contract Review Card */}
          <figure
            className="rounded-xl border border-slate-200 bg-slate-50 p-6 sm:p-9"
            style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '16px 16px' }}
          >
            <figcaption className="mb-4 text-xs font-medium text-slate-500">
              Example contract review
            </figcaption>
            
            <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
              <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100 text-xs font-medium text-slate-600">
                <FileText size={16} className="text-slate-500" />
                <span>Service Agreement</span>
              </div>
              <p className="mb-2 text-xs text-slate-400">§ 4.2 · Renewal & Termination</p>
              <blockquote className="text-sm leading-relaxed text-slate-800">
                “This agreement renews for one year unless either party gives <mark className="bg-amber-100 text-inherit px-1 rounded font-medium">written notice at least 30 days</mark> before the end of the current term.”
              </blockquote>
            </div>

            <div className="relative -mt-3 ml-6 rounded-lg bg-clario-navy p-5 text-white shadow-md">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <MessageSquareQuote size={15} />
                <span>Ask Clario</span>
              </div>
              <p className="mt-2.5 text-sm font-semibold text-white">
                When do we need to give notice?
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-200">
                Written notice must be given at least 30 days before the term ends.
              </p>
              <p className="mt-3 border-t border-white/15 pt-2.5 text-[11px] text-slate-400">
                Source · Service Agreement, § 4.2 (Page 4)
              </p>
            </div>
          </figure>
        </section>

        {/* Core Capabilities Section */}
        <section id="features" className="border-t border-slate-200 bg-slate-50 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-10">
            <div className="max-w-xl mb-12">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Capabilities</p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                Explore the workspace
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Everything you need to review, compare, and manage critical contracts and policies.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {workflows.map(({ path, icon: Icon, title, detail }) => (
                <Link
                  key={path}
                  to={path}
                  onClick={enterWorkspace}
                  className="group rounded-lg border border-slate-200 bg-white p-6 transition-all hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-md bg-slate-100 text-slate-700 group-hover:bg-clario-navy group-hover:text-white transition-colors">
                      <Icon size={20} />
                    </div>
                    <ArrowUpRight size={16} className="text-slate-400 group-hover:text-slate-900 transition-colors" />
                  </div>
                  <h3 className="mt-5 text-base font-semibold tracking-tight text-slate-900 group-hover:text-clario-navy transition-colors">
                    {title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    {detail}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-16 sm:py-24 bg-white border-t border-slate-200">
          <div className="mx-auto max-w-7xl px-5 sm:px-10">
            <div className="max-w-xl mb-14">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Workflow</p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                How Clario works
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Three clear steps from raw files to verified answers.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              <div className="space-y-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-semibold text-xs border border-slate-200">
                  1
                </div>
                <h3 className="text-base font-semibold text-slate-900">Add your documents</h3>
                <p className="text-xs leading-relaxed text-slate-600">
                  Upload agreements, NDAs, and corporate policies. Documents are parsed and indexed with page and section preservation.
                </p>
              </div>

              <div className="space-y-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-semibold text-xs border border-slate-200">
                  2
                </div>
                <h3 className="text-base font-semibold text-slate-900">Review & compare</h3>
                <p className="text-xs leading-relaxed text-slate-600">
                  Ask questions, check compliance against target guidelines, and compare revisions side by side to see exact clause differences.
                </p>
              </div>

              <div className="space-y-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-semibold text-xs border border-slate-200">
                  3
                </div>
                <h3 className="text-base font-semibold text-slate-900">Verify & export</h3>
                <p className="text-xs leading-relaxed text-slate-600">
                  Inspect citations in the original document, generate redlines, and export executive PDF summaries or calendar reminders.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="border-t border-slate-200 bg-slate-50 py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-5 sm:px-10">
            <div className="text-center mb-12">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Help</p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                Frequently asked questions
              </h2>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, idx) => (
                <details
                  key={idx}
                  className="group rounded-lg border border-slate-200 bg-white p-5 transition-colors [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-slate-900">
                    <span>{faq.q}</span>
                    <ChevronDown size={16} className="text-slate-400 transition-transform group-open:rotate-180 shrink-0 ml-4" />
                  </summary>
                  <p className="mt-3 text-xs leading-relaxed text-slate-600 border-t border-slate-100 pt-3">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Simple Call to Action Banner */}
        <section className="bg-clario-navy text-white py-14 px-5 sm:px-10">
          <div className="mx-auto max-w-4xl text-center space-y-4">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Ready to review your documents?
            </h2>
            <p className="text-sm text-slate-300 max-w-md mx-auto">
              Open the Clario workspace to ask questions, compare revisions, and track deadlines.
            </p>
            <div className="pt-2">
              <Link
                to="/"
                onClick={enterWorkspace}
                className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors"
              >
                Enter workspace <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Professional Clean Footer */}
      <footer className="bg-clario-navy border-t border-white/10 text-slate-400 py-8 px-5 sm:px-10">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center">
            <img src="/clario.webp" alt="Clario" width="784" height="196" className="h-7 w-auto" />
          </div>

          <p className="text-xs text-slate-400 order-last sm:order-none">
            © 2026 Clario • All rights reserved.
          </p>

          <nav aria-label="Legal" className="flex items-center gap-6 text-xs text-slate-300 [&_a:hover]:text-white transition-colors">
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/cookies">Cookies</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}