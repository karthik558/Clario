import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAskSelection } from '../documents/AskSources';
import { QuickAsk } from './QuickAsk';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { GlobalSearchModal } from './GlobalSearchModal';
import { BackgroundTaskDrawer } from './BackgroundTaskDrawer';
import { DocumentViewerModal } from '../documents/DocumentViewerModal';
import { SearchResultItem } from '../../types';

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const [askDraft, setAskDraft] = useState<string | null>(null);
  const { pathname, search } = useLocation();
  const selection = useAskSelection();
  useEffect(() => {
    const params = new URLSearchParams(search);
    const ids = params.getAll('document').filter(Boolean);
    if (pathname !== '/ask' || !ids.length) return;
    selection.select([...new Set(ids)]);
    params.delete('document');
    navigate({ pathname, search: params.toString() }, { replace: true });
  }, [pathname, search, navigate]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    try {
      sessionStorage.setItem('clario_workspace_entered', 'true');
    } catch {
      // Non-fatal if storage is unavailable
    }
  }, []);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<Pick<SearchResultItem, 'document_id' | 'chunk_id' | 'page_number'> | null>(null);

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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 ml-0 ${
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        <Header
          onOpenSearch={() => setSearchModalOpen(true)}
          onOpenNavigation={() => setMobileNavOpen(true)}
        />

        <main className="mx-auto max-w-[100rem] flex-1 p-4 sm:p-6 lg:p-8 w-full min-w-0">
          <Outlet context={{ askDraft, setAskDraft, selection }} />
        </main>
        <footer className="flex flex-wrap items-center justify-start gap-3 border-t border-clario-border px-4 py-4 text-xs text-clario-text-secondary sm:px-6 lg:px-8">
          <Link to="/home">About Clario</Link>
          <nav aria-label="Legal" className="flex gap-5">
            <Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/cookies">Cookies</Link>
          </nav>
        </footer>
        {pathname.replace(/\/$/, '') !== '/ask' && <div className="h-12" aria-hidden="true" />}
      </div>

      {pathname.replace(/\/$/, '') !== '/ask' && <QuickAsk selection={selection}
        onExpand={draft => { setAskDraft(draft); navigate('/ask'); }}
        onSearch={() => setSearchModalOpen(true)}
        onSource={setSelectedResult}
      />}

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

      {/* Global Background Tasks & Activity Log Drawer */}
      <BackgroundTaskDrawer />
    </div>
  );
};
