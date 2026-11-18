import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { GlobalSearchModal } from './GlobalSearchModal';
import { DocumentViewerModal } from '../documents/DocumentViewerModal';
import { SearchResultItem } from '../../types';

export const Layout: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResultItem | null>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchModalOpen(open => !open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ml-0 ${
          sidebarCollapsed ? 'md:ml-20' : 'md:ml-64'
        }`}
      >
        <Header
          onOpenSearch={() => setSearchModalOpen(true)}
          onOpenNavigation={() => setMobileNavOpen(true)}
        />

        <main className="mx-auto max-w-[100rem] flex-1 p-4 sm:p-6 lg:p-8 w-full min-w-0">
          <Outlet />
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-clario-border px-4 py-4 text-xs text-clario-text-secondary sm:px-6 lg:px-8">
          <a href="https://karthiklal.in" target="_blank" rel="noopener noreferrer">© 2026 Clario</a>
          <nav aria-label="Legal" className="flex gap-5">
            <Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/cookies">Cookies</Link>
          </nav>
        </footer>
      </div>

      {/* Global Search Dialog (⌘K) */}
      <GlobalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onSelectResult={setSelectedResult}
      />

      <DocumentViewerModal
        documentId={selectedResult?.document_id ?? null}
        highlightChunkId={selectedResult?.chunk_id}
        highlightPage={selectedResult?.page_number}
        onClose={() => setSelectedResult(null)}
      />
    </div>
  );
};
