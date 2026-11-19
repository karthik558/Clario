import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const workflows = [
  {
    path: '/ask',
    category: 'Inquiry',
    title: 'Ask a document',
    detail: 'Ask in plain language and follow each citation back to the passage behind the answer.'
  },
  {
    path: '/compare',
    category: 'Revision',
    title: 'Compare versions',
    detail: 'Review two versions side by side and see how the wording of a clause has changed.'
  },
  {
    path: '/obligations',
    category: 'Timelines',
    title: 'Track obligations',
    detail: 'Bring deadlines, renewal windows and commitments into a single timeline.'
  },
  {
    path: '/critique',
    category: 'Risk Audit',
    title: 'Red team critique',
    detail: 'Review provisions across legal, financial, security, and operational perspectives.'
  },
  {
    path: '/negotiate',
    category: 'Redlining',
    title: 'Clause redline',
    detail: 'Review compromise language and draft counter-proposals with clear risk context.'
  },
  {
    path: '/policy-checker',
    category: 'Compliance',
    title: 'Policy verification',
    detail: 'Check draft agreements against company policy guidelines to catch potential issues early.'
  },
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

      {/* Header Design */}
      <header className="bg-clario-navy text-white border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-10">
          <Link to="/home" className="flex items-center gap-2.5">
            <img src="/clario.webp" alt="Clario" width="784" height="196" className="h-8 w-auto" />
          </Link>

          <nav className="flex items-center gap-6 text-xs uppercase tracking-wider text-slate-300">
            <a href="#capabilities" className="hover:text-white transition-colors">Capabilities</a>
            <a href="#attribution" className="hover:text-white transition-colors">Attribution</a>
            <Link to="/terms" className="hover:text-white transition-colors">Policies</Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section with the ONLY Workspace Button */}
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 sm:px-10 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[.18em] text-slate-600">
              Document intelligence
            </p>
            <h1 className="max-w-xl text-5xl font-semibold leading-[1.05] tracking-[-.055em] sm:text-6xl xl:text-7xl text-slate-900">
              Your documents,<br />down to the clause.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-600">
              Find answers in contracts and policies, see what changed, and keep track of what comes next.
            </p>
            <Link
              to="/"
              onClick={enterWorkspace}
              className="mt-8 inline-flex items-center justify-center rounded-md bg-clario-navy px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors shadow-sm"
            >
              Open workspace
            </Link>
          </div>

          {/* Clean Example Contract Review (No Icons) */}
          <figure
            id="attribution"
            className="rounded-clario border border-slate-200 bg-slate-100 p-5 sm:p-9"
            style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '16px 16px' }}
          >
            <figcaption className="mb-5 inline-block bg-slate-100 pr-2 text-xs font-medium text-slate-600">
              Example contract review
            </figcaption>
            
            <div className="mr-4 rounded-md border border-slate-200 bg-white shadow-card">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 text-xs font-medium text-slate-600">
                <span>Service agreement</span>
                <span className="text-slate-400 font-mono text-[11px]">Section 4.2</span>
              </div>
              <div className="p-5 sm:p-6">
                <p className="mb-3 text-xs text-slate-500 font-medium">Renewal & Termination</p>
                <blockquote className="text-base leading-relaxed text-slate-800">
                  “This agreement renews for one year unless either party gives <mark className="bg-amber-100 text-inherit px-1 rounded font-medium">written notice at least 30 days</mark> before the end of the current term.”
                </blockquote>
              </div>
            </div>

            <div className="relative -mt-2 ml-5 rounded-md bg-clario-navy p-5 text-white shadow-elevated">
              <div className="flex items-center justify-between text-xs font-medium text-slate-300 pb-2 border-b border-white/10">
                <span>Ask Clario</span>
                <span className="text-[11px] text-slate-400">Direct query</span>
              </div>
              <p className="mt-3 font-semibold text-white">When do we need to give notice?</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">Give written notice at least 30 days before the term ends.</p>
              <p className="mt-3 border-t border-white/15 pt-3 text-xs text-slate-300">Source · Service agreement, § 4.2</p>
            </div>
          </figure>
        </section>

        {/* Explore the Workspace (Clean, Icon-Free Cards) */}
        <section id="capabilities" className="border-t border-clario-border bg-slate-50">
          <div className="mx-auto max-w-7xl px-5 py-14 sm:px-10 lg:py-20">
            <div className="max-w-xl mb-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Capabilities</p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                Explore the workspace
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {workflows.map(({ path, category, title, detail }) => (
                <Link
                  key={path}
                  to={path}
                  onClick={enterWorkspace}
                  className="group rounded-clario border border-clario-border bg-white p-6 transition-all hover:border-slate-400 hover:shadow-subtle flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                      {category}
                    </span>
                    <h3 className="text-lg font-semibold tracking-tight text-slate-900 group-hover:text-clario-navy transition-colors">
                      {title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {detail}
                    </p>
                  </div>
                  <div className="mt-6 pt-3 border-t border-slate-100 text-xs font-medium text-slate-700 group-hover:text-clario-navy transition-colors">
                    Open module &rarr;
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Clean Footer */}
      <footer className="bg-clario-navy border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col md:flex-row items-center justify-between gap-y-4 px-5 py-7 sm:px-10">
          <div className="flex items-center">
            <img src="/clario.webp" alt="Clario" width="784" height="196" className="h-7 w-auto" />
          </div>
          <p className="text-xs text-slate-400 font-normal order-last md:order-none">
            © 2026 Clario • All rights reserved.
          </p>
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-6 text-xs text-slate-300 [&_a:hover]:text-white">
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/cookies">Cookies</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}