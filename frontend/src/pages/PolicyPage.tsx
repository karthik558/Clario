import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const policies = {
  terms: {
    title: 'Terms of Service',
    description: 'Guidelines and terms governing your use of Clario for enterprise document intelligence and contract analysis.',
    sections: [
      ['Permitted Document Processing', 'You may upload and process documents and contracts for which you possess legal authorization or internal operational clearance. Always comply with organizational data governance, trade secret policies, and applicable data handling agreements before exporting analytical dossiers or sharing clause redlines.'],
      ['Verification and Reviewing Results', 'Clario is designed to assist professionals by locating verbatim passages, calculating version variance, highlighting conflicting covenants, and drafting proposed clause harmonizations. All generated suggestions, extracted obligations, and audit findings must be reviewed against authoritative executed contracts before relying upon them for legal, financial, or commercial decisions.'],
      ['Intellectual Property and Licensing', 'The underlying Clario software workbench is distributed under the terms of the open-source MIT License. Your proprietary uploaded documents, vector indices, and extracted workspace data remain entirely your organization’s private property and are never used to train external public models.'],
      ['System Availability and Local Operation', 'Clario functions as a local-first software application. System operators and administrators are responsible for local host maintenance, storage volume persistence, hardware provisioning, and local network accessibility.'],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'How contracts, policy documents, and user interaction data are processed and protected within Clario.',
    sections: [
      ['Local-First Data Ownership', 'Clario operates entirely within your infrastructure or designated deployment environment. All uploaded PDF, DOCX, TXT, Excel, and Markdown files, along with chunked vector embeddings and extraction caches, reside in your local SQLite database and local disk volumes.'],
      ['Model Connections and Network Privacy', 'When using local offline models via Ollama, LM Studio, or vLLM, zero document tokens or prompts leave your host machine. If you configure optional cloud-hosted endpoints (such as OpenAI or Google Gemini), only the specific query and retrieved passages relevant to that prompt are transmitted over encrypted TLS connections.'],
      ['Data Deletion and Retention Controls', 'You retain total control over your data lifecycle. Deleting a document from the Documents view instantly removes its file binary, dense vector chunks, and associated review findings from the local database. You may also purge the entire database at any time through the workspace administration settings.'],
      ['Zero Telemetry or Third-Party Tracking', 'Clario does not inject third-party analytical cookies, user surveillance scripts, or telemetry trackers into your workspace. The platform is built to satisfy strict confidentiality requirements for regulated enterprise environments.'],
    ],
  },
  cookies: {
    title: 'Cookie and Storage Policy',
    description: 'Transparent disclosure of browser storage mechanisms utilized by Clario.',
    sections: [
      ['Browser Storage Mechanisms', 'Clario utilizes standard HTML5 Web Storage (localStorage and sessionStorage) rather than third-party tracking cookies. These keys persist user preferences such as your document scope selection, UI layout collapse states, and workspace session continuity.'],
      ['Session Continuity Storage', 'A temporary session key (clario_workspace_entered) is stored in sessionStorage to ensure that once you enter the workspace, refreshing the dashboard or reloading analytical views keeps you in your active workspace without returning to the landing page.'],
      ['Clearing Local Preferences', 'You can clear your local browser storage at any time via your browser’s site settings or developer tools. Clearing storage will simply reset your UI preferences and return you to the default landing view without deleting documents stored on the workspace server.'],
    ],
  },
};

export function PolicyPage({ policy }: { policy: keyof typeof policies }) {
  const { title, description, sections } = policies[policy];

  const enterWorkspace = () => {
    try {
      sessionStorage.setItem('clario_workspace_entered', 'true');
    } catch {
      // Non-fatal
    }
  };

  return (
    <div className="min-h-screen bg-white text-clario-text flex flex-col justify-between">
      {/* Public Website Header matching /home */}
      <header className="bg-clario-navy text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-10">
          <div className="flex items-center gap-2.5">
            <Link to="/home" title="Clario Home">
              <img src="/clario.webp" alt="Clario" width="784" height="196" className="h-8 w-auto" />
            </Link>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/home" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
              Home
            </Link>
            <Link
              to="/"
              onClick={enterWorkspace}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-200 hover:text-white bg-white/10 hover:bg-white/15 px-3.5 py-1.5 rounded-md transition-colors"
            >
              <span>Workspace</span>
              <ArrowUpRight aria-hidden="true" size={15} />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Website Page Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="mb-10 pb-8 border-b border-clario-border">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-[.18em] text-slate-500">Legal Policy</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-[-0.04em] text-clario-text">
              {title}
            </h1>
            <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-600">
              {description}
            </p>
            <div className="mt-5 flex items-center gap-3 text-xs text-slate-400">
              <span>Effective Date: 2026</span>
              <span>•</span>
              <span>Version 2.0</span>
              <span>•</span>
              <span>Enterprise Edition</span>
            </div>
          </div>

          <div className="space-y-6">
            {sections.map(([heading, body], idx) => (
              <section key={heading} className="p-6 rounded-md border border-clario-border bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-4">
                  <span className="w-6 h-6 rounded-md bg-clario-navy text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="space-y-2">
                    <h2 className="text-base sm:text-lg font-semibold text-clario-text tracking-tight">{heading}</h2>
                    <p className="text-sm leading-relaxed text-slate-600 font-normal">{body}</p>
                  </div>
                </div>
              </section>
            ))}
          </div>

          {/* Quick Cross-Policy Navigation */}
          <div className="mt-12 pt-8 border-t border-clario-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-500">
            <span className="font-medium text-slate-700">Other policies & terms:</span>
            <div className="flex flex-wrap gap-4">
              {policy !== 'terms' && (
                <Link to="/terms" className="text-clario-navy font-semibold hover:underline">
                  Terms of Service →
                </Link>
              )}
              {policy !== 'privacy' && (
                <Link to="/privacy" className="text-clario-navy font-semibold hover:underline">
                  Privacy Policy →
                </Link>
              )}
              {policy !== 'cookies' && (
                <Link to="/cookies" className="text-clario-navy font-semibold hover:underline">
                  Cookie Policy →
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Public Website Footer matching /home */}
      <footer className="bg-clario-navy border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col md:flex-row items-center justify-between gap-y-4 px-5 py-7 sm:px-10">
          <div className="flex items-center">
            <Link to="/home">
              <img src="/clario.webp" alt="Clario" width="784" height="196" className="h-7 w-auto" />
            </Link>
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
