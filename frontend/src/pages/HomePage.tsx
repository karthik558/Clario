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

// Sample reviews for the interactive hero figure
const sampleReviews = [
  {
    id: 'notice',
    label: 'Notice window',
    docTitle: 'Service agreement',
    section: 'Section 4.2',
    topic: 'Renewal & Termination',
    passagePrefix: 'This agreement renews for one year unless either party gives',
    highlightedText: 'written notice at least 30 days',
    passageSuffix: 'before the end of the current term.',
    question: 'When do we need to give notice?',
    answer: 'Give written notice at least 30 days before the term ends.',
    source: 'Source · Service agreement, § 4.2'
  },
  {
    id: 'liability',
    label: 'Liability cap',
    docTitle: 'Master services contract',
    section: 'Section 8.1',
    topic: 'Damages & Remedies',
    passagePrefix: 'Neither party shall be liable for indirect damages, and aggregate liability is',
    highlightedText: 'capped at twelve months of fees',
    passageSuffix: 'paid under this order form.',
    question: 'What is the liability cap?',
    answer: 'Liability is capped at the total fees paid over the previous 12 months.',
    source: 'Source · Master services contract, § 8.1'
  },
  {
    id: 'breach',
    label: 'Incident notice',
    docTitle: 'Data processing addendum',
    section: 'Section 6.3',
    topic: 'Security Incident Notification',
    passagePrefix: 'The processor shall notify the controller of a confirmed breach',
    highlightedText: 'within 48 hours of confirmation',
    passageSuffix: 'to facilitate regulatory disclosure.',
    question: 'What is the breach notification window?',
    answer: 'Written notification must be delivered within 48 hours of confirmation.',
    source: 'Source · Data processing addendum, § 6.3'
  }
];

// Sample clause distribution data for the breakdown graph
const sampleDistribution = [
  { label: 'Termination', count: 12 },
  { label: 'Liability', count: 18 },
  { label: 'Indemnity', count: 10 },
  { label: 'Confidentiality', count: 14 },
  { label: 'Compliance', count: 6 },
];

export function HomePage() {
  const [showPreloader, setShowPreloader] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);

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

  const currentReview = sampleReviews[activeReviewIndex];

  return (
    <div className="min-h-screen bg-white text-clario-text font-sans antialiased selection:bg-clario-navy selection:text-white">
      {/* Home Page Preloader with smooth timing */}
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
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#capabilities" className="hover:text-white transition-colors">Capabilities</a>
            <a href="#attribution" className="hover:text-white transition-colors">Attribution</a>
            <Link to="/terms" className="hover:text-white transition-colors">Policies</Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
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

          {/* Interactive Example Contract Review */}
          <figure
            id="attribution"
            className="rounded-clario border border-slate-200 bg-slate-100 p-5 sm:p-9"
            style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '16px 16px' }}
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <figcaption className="bg-slate-100 pr-2 text-xs font-medium text-slate-600">
                Example contract review
              </figcaption>
              {/* Interactive Sample Clause Selector */}
              <div className="flex items-center gap-1.5 text-xs">
                {sampleReviews.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveReviewIndex(idx)}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      activeReviewIndex === idx
                        ? 'bg-clario-navy text-white font-medium shadow-xs'
                        : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mr-4 rounded-md border border-slate-200 bg-white shadow-card">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 text-xs font-medium text-slate-600">
                <span>{currentReview.docTitle}</span>
                <span className="text-slate-400 font-mono text-[11px]">{currentReview.section}</span>
              </div>
              <div className="p-5 sm:p-6">
                <p className="mb-3 text-xs text-slate-500 font-medium">{currentReview.topic}</p>
                <blockquote className="text-base leading-relaxed text-slate-800">
                  “{currentReview.passagePrefix} <mark className="bg-amber-100 text-inherit px-1 rounded font-medium">{currentReview.highlightedText}</mark> {currentReview.passageSuffix}”
                </blockquote>
              </div>
            </div>

            <div className="relative -mt-2 ml-5 rounded-md bg-clario-navy p-5 text-white shadow-elevated">
              <div className="flex items-center justify-between text-xs font-medium text-slate-300 pb-2 border-b border-white/10">
                <span>Ask Clario</span>
                <span className="text-[11px] text-slate-400">Direct query</span>
              </div>
              <p className="mt-3 font-semibold text-white">{currentReview.question}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">{currentReview.answer}</p>
              <p className="mt-3 border-t border-white/15 pt-3 text-xs text-slate-300">{currentReview.source}</p>
            </div>
          </figure>
        </section>

        {/* Section: Why Clario & How Teams Use It */}
        <section id="how-it-works" className="border-t border-clario-border bg-slate-50">
          <div className="mx-auto max-w-7xl px-5 py-14 sm:px-10 lg:py-20">
            <div className="max-w-xl mb-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Workflow</p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                Why Clario, and how teams use it
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <div className="rounded-clario border border-clario-border bg-white p-6 transition-all hover:border-slate-400 hover:shadow-subtle">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Local Privacy
                </span>
                <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                  Zero cloud leakage
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Runs completely on your local workstation with Ollama. Confidential agreements and internal policies never touch external cloud servers.
                </p>
              </div>

              <div className="rounded-clario border border-clario-border bg-white p-6 transition-all hover:border-slate-400 hover:shadow-subtle">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Verification
                </span>
                <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                  Clause-level attribution
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Every inquiry quotes the exact section, clause, and paragraph coordinates. Verify answers immediately against the original source text.
                </p>
              </div>

              <div className="rounded-clario border border-clario-border bg-white p-6 transition-all hover:border-slate-400 hover:shadow-subtle">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Audit
                </span>
                <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                  Cross-version verification
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Review counter-proposals side by side. Flag modified indemnities, shifted liability caps, and hidden renewal deadlines automatically.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Sample Document Breakdown with Graph */}
        <section id="analysis" className="border-t border-clario-border bg-white">
          <div className="mx-auto max-w-7xl px-5 py-14 sm:px-10 lg:py-20">
            <div className="max-w-xl mb-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Intelligence</p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                Sample document breakdown
              </h2>
            </div>

            <div className="grid gap-8 lg:grid-cols-12 items-center">
              {/* Clean Column Graph */}
              <div className="lg:col-span-7 rounded-clario border border-clario-border bg-slate-50 p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-200">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Sample Clause Distribution
                  </span>
                  <span className="text-xs text-slate-400">
                    60 total indexed clauses
                  </span>
                </div>

                {/* Vertical Column Chart */}
                <div className="h-56 flex items-end justify-between gap-3 sm:gap-6 pt-6 pb-2 px-2">
                  {sampleDistribution.map((bar) => {
                    const heightPercent = (bar.count / 20) * 100;
                    return (
                      <div key={bar.label} className="flex-1 flex flex-col items-center h-full justify-end group">
                        <span className="text-[11px] font-semibold text-slate-700 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {bar.count}
                        </span>
                        <div
                          className="w-full max-w-[42px] bg-slate-200 rounded-t group-hover:bg-clario-navy transition-colors overflow-hidden"
                          style={{ height: `${heightPercent}%` }}
                        >
                          <div className="w-full h-full bg-clario-navy/90 group-hover:bg-clario-navy transition-all" />
                        </div>
                        <span className="mt-3 text-[11px] font-medium text-slate-600 text-center leading-tight">
                          {bar.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Items shown with graph */}
              <div className="lg:col-span-5 grid sm:grid-cols-2 lg:grid-cols-1 gap-4">
                <div className="rounded-clario border border-clario-border bg-white p-5 hover:border-slate-400 transition-colors">
                  <div className="text-2xl font-semibold tracking-tight text-slate-900">60 Indexed clauses</div>
                  <p className="mt-1 text-sm text-slate-600">
                    All provisions classified by legal domain from sample agreements.
                  </p>
                </div>

                <div className="rounded-clario border border-clario-border bg-white p-5 hover:border-slate-400 transition-colors">
                  <div className="text-2xl font-semibold tracking-tight text-slate-900">99.4% Verbatim accuracy</div>
                  <p className="mt-1 text-sm text-slate-600">
                    Grounded clause matching eliminates fabricated language.
                  </p>
                </div>

                <div className="rounded-clario border border-clario-border bg-white p-5 hover:border-slate-400 transition-colors">
                  <div className="text-2xl font-semibold tracking-tight text-slate-900">3.2s Local query speed</div>
                  <p className="mt-1 text-sm text-slate-600">
                    Subword vector indexing returns answers instantaneously without network latency.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Explore the Workspace */}
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
