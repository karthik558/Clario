import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAskSelection } from '../documents/AskSources';
import { QuickAsk } from './QuickAsk';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { GlobalSearchModal } from './GlobalSearchModal';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { BackgroundTaskDrawer } from './BackgroundTaskDrawer';
import { DocumentViewerModal } from '../documents/DocumentViewerModal';
import { SearchResultItem } from '../../types';
import { Keyboard } from 'lucide-react';

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

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('clario_sidebar_collapsed');
      if (saved !== null) {
        return saved === 'true';
      }
    } catch {
      // Non-fatal if storage is unavailable
    }
    return false;
  });

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('clario_sidebar_collapsed', String(next));
      } catch {
        // Non-fatal if storage is unavailable
      }
      return next;
    });
  };

  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('clario_sidebar_mobile_open');
      if (saved !== null) {
        return saved === 'true';
      }
    } catch {
      // Non-fatal if storage is unavailable
    }
    return false;
  });

  const handleSetMobileNavOpen = (open: boolean) => {
    setMobileNavOpen(open);
    try {
      localStorage.setItem('clario_sidebar_mobile_open', String(open));
    } catch {
      // Non-fatal if storage is unavailable
    }
  };
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<Pick<SearchResultItem, 'document_id' | 'chunk_id' | 'page_number'> | null>(null);

  useEffect(() => {
    let pendingG = false;
    let timeoutId: any = null;

    const handler = (event: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isInput =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'SELECT' ||
        activeEl?.isContentEditable;

      // Command + K for Search Modal
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchModalOpen((open) => !open);
        return;
      }

      // If user is inside an input, don't trigger single-key or sequence shortcuts
      if (isInput) return;

      // ? for Keyboard Shortcuts HUD
      if (event.key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault();
        setShortcutsModalOpen((open) => !open);
        return;
      }

      // G sequence navigation: G then O, D, A, C, N, M, S
      if (event.key.toLowerCase() === 'g' && !pendingG) {
        pendingG = true;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          pendingG = false;
        }, 1200);
        return;
      }

      if (pendingG) {
        pendingG = false;
        clearTimeout(timeoutId);
        const k = event.key.toLowerCase();
        if (k === 'o') navigate('/');
        else if (k === 'd') navigate('/documents');
        else if (k === 'a') navigate('/ask');
        else if (k === 'c') navigate('/compare');
        else if (k === 'n') navigate('/negotiate');
        else if (k === 'm') navigate('/compliance');
        else if (k === 's') navigate('/settings');
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      clearTimeout(timeoutId);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={handleToggleSidebar}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => handleSetMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 ml-0 ${
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        <Header
          onOpenSearch={() => setSearchModalOpen(true)}
          onOpenNavigation={() => handleSetMobileNavOpen(true)}
        />

        <main className="mx-auto max-w-[100rem] flex-1 p-4 sm:p-6 lg:p-8 w-full min-w-0">
          <Outlet context={{ askDraft, setAskDraft, selection }} />
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-clario-border px-4 py-4 text-xs text-clario-text-secondary sm:px-6 lg:px-8">
          <div className="flex items-center gap-5">
            <Link to="/home">About Clario</Link>
            <nav aria-label="Legal" className="flex gap-5">
              <Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/cookies">Cookies</Link>
            </nav>
          </div>
          <button
            type="button"
            onClick={() => setShortcutsModalOpen(true)}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 transition-colors font-medium cursor-pointer"
            title="Keyboard shortcuts HUD (?)"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Shortcuts <kbd className="px-1.5 py-0.2 bg-slate-100 rounded-md border text-[10px] text-slate-500 font-mono">?</kbd></span>
          </button>
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

      {/* Keyboard Shortcuts HUD (?) */}
      <KeyboardShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
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
