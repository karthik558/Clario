import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Search, Menu, Settings } from 'lucide-react';

interface HeaderProps { onOpenSearch: () => void; onOpenNavigation: () => void; }
const titles: Record<string, string> = { '/': 'Overview', '/documents': 'Documents', '/ask': 'Ask Clario', '/compare': 'Compare versions', '/findings': 'Findings', '/reports': 'Reports', '/search-lab': 'Search Lab', '/settings': 'Settings' };

export const Header: React.FC<HeaderProps> = ({ onOpenSearch, onOpenNavigation }) => {
  const { pathname } = useLocation();
  return (
    <header className="h-20 shrink-0 bg-white border-b border-clario-border sticky top-0 z-20 px-4 md:px-8 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onOpenNavigation} aria-label="Open navigation" className="md:hidden p-2 rounded-lg hover:bg-clario-ivory"><Menu className="w-5 h-5" /></button>
        <div><p className="text-xs text-clario-text-secondary">Document workspace</p><h1 className="text-base font-semibold text-clario-navy">{titles[pathname] || 'Clario'}</h1></div>
      </div>
      <div className="flex items-center gap-3">
        <button aria-label="Search documents" onClick={onOpenSearch} className="flex items-center gap-3 rounded-lg border border-clario-border bg-clario-ivory px-3 py-2 text-sm text-clario-text-secondary hover:border-clario-teal">
          <Search className="w-4 h-4" /><span className="hidden lg:inline">Search documents</span><kbd className="hidden sm:inline text-xs">⌘K / Ctrl K</kbd>
        </button>
        <Link to="/settings" aria-label="Workspace settings" title="Workspace settings" className="p-2 text-clario-text-secondary hover:text-clario-teal"><Settings className="w-5 h-5" /></Link>
      </div>
    </header>
  );
};
