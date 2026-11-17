import React from 'react';
import { Search, Menu } from 'lucide-react';

interface HeaderProps {
  onOpenSearch: () => void;
  onOpenNavigation?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSearch, onOpenNavigation }) => {
  return (
    <header className="h-14 shrink-0 bg-white border-b border-clario-border sticky top-0 z-20 px-4 md:px-6 flex items-center gap-3 shadow-subtle">
      {onOpenNavigation && (
        <button
          type="button"
          onClick={onOpenNavigation}
          aria-label="Open navigation menu"
          className="md:hidden p-1.5 -ml-1 rounded-md text-clario-navy hover:bg-slate-100 transition-colors mr-1 shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      <button
        aria-label="Search documents"
        onClick={onOpenSearch}
        className="flex items-center justify-between w-full max-w-sm sm:max-w-md bg-clario-ivory hover:bg-clario-ivory-muted text-clario-text-secondary px-3.5 py-1.5 rounded-md border border-clario-border transition-all hover:border-clario-navy/30 text-xs shadow-xs"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <Search className="w-4 h-4 text-clario-text-secondary shrink-0" />
          <span className="truncate">Search documents...</span>
        </span>
        <kbd className="hidden sm:inline px-1.5 py-0.5 bg-white border border-clario-border rounded text-[10px] font-mono text-clario-text-secondary shadow-xs shrink-0">
          ⌘K / Ctrl K
        </kbd>
      </button>
    </header>
  );
};
