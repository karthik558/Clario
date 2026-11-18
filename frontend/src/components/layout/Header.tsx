import React from 'react';
import { Search, Menu } from 'lucide-react';

interface HeaderProps {
  onOpenSearch: () => void;
  onOpenNavigation?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSearch, onOpenNavigation }) => {
  return (
    <header className="h-16 shrink-0 bg-white border-b border-clario-border sticky top-0 z-20 px-4 md:px-6 flex items-center gap-3">
      {onOpenNavigation && (
        <button
          type="button"
          onClick={onOpenNavigation}
          aria-label="Open navigation menu"
          className="lg:hidden p-1.5 -ml-1 rounded-md text-clario-navy hover:bg-slate-100 transition-colors mr-1 shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      <button
        aria-label="Search documents"
        onClick={onOpenSearch}
        className="flex items-center justify-between w-full max-w-sm bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 px-3.5 py-1.5 rounded-md border border-slate-200 hover:border-slate-300 transition-all text-xs shadow-xs outline-none focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="truncate">Search documents…</span>
        </span>
        <kbd className="hidden sm:inline px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono text-slate-500 shadow-xs shrink-0">
          ⌘K / Ctrl K
        </kbd>
      </button>
    </header>
  );
};
