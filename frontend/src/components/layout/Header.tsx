import React from 'react';
import { Link } from 'react-router-dom';
import { Search, Settings, Menu } from 'lucide-react';

interface HeaderProps {
  onOpenSearch: () => void;
  onOpenNavigation?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSearch, onOpenNavigation }) => {
  return (
    <header className="h-14 shrink-0 bg-white border-b border-clario-border sticky top-0 z-20 px-4 md:px-8 flex items-center justify-between gap-3 shadow-subtle">
      <div className="flex items-center space-x-2">
        {onOpenNavigation && (
          <button
            type="button"
            onClick={onOpenNavigation}
            aria-label="Open navigation menu"
            className="md:hidden p-1.5 -ml-1 rounded-md text-clario-navy hover:bg-slate-100 transition-colors mr-1"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex items-center space-x-3">
        <button
          aria-label="Search documents"
          onClick={onOpenSearch}
          className="flex items-center space-x-3 bg-clario-ivory hover:bg-clario-ivory-muted text-clario-text-secondary px-3.5 py-1.5 rounded-md border border-clario-border transition-all hover:border-clario-navy/30 text-xs shadow-xs"
        >
          <Search className="w-4 h-4 text-clario-text-secondary" />
          <span className="hidden sm:inline">Search documents...</span>
          <kbd className="hidden sm:inline px-1.5 py-0.5 bg-white border border-clario-border rounded text-[10px] font-mono text-clario-text-secondary shadow-xs">
            ⌘K / Ctrl K
          </kbd>
        </button>

        <Link
          to="/settings"
          aria-label="Workspace settings"
          title="Workspace settings"
          className="p-2 rounded-md text-clario-text-secondary hover:text-clario-navy hover:bg-clario-ivory transition-colors"
        >
          <Settings className="w-4 h-4" />
        </Link>
      </div>
    </header>
  );
};
