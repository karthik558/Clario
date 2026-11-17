import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { DocumentViewerModal } from '../documents/DocumentViewerModal';
import { SearchResultItem } from '../../types';
import { GlobalSearchModal } from './GlobalSearchModal';

export const Layout: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResultItem | null>(null);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchModalOpen(open => !open);
      }
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    contentRef.current?.setAttribute('inert', '');
    return () => { document.body.style.overflow = previous; contentRef.current?.removeAttribute('inert'); };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-clario-ivory text-clario-text flex">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(value => !value)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div ref={contentRef}
        className={`min-w-0 flex-1 flex flex-col transition-[margin] duration-200 ${
          sidebarCollapsed ? 'md:ml-20' : 'md:ml-64'
        }`}
      >
        <Header onOpenSearch={() => setSearchModalOpen(true)} onOpenNavigation={() => setMobileOpen(true)} />

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Global Search Dialog (⌘K) */}
      <GlobalSearchModal
        onSelectResult={setSelectedResult}
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
      />
      <DocumentViewerModal documentId={selectedResult?.document_id ?? null} highlightChunkId={selectedResult?.chunk_id} highlightPage={selectedResult?.page_number} onClose={() => setSelectedResult(null)} />
    </div>
  );
};
