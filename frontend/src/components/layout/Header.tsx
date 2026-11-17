import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Search,
  Bell,
  CheckCircle2,
  ShieldCheck,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface HeaderProps {
  onOpenSearch: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSearch }) => {
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);

  // Derive title from pathname
  const getPageInfo = () => {
    switch (location.pathname) {
      case '/':
        return { title: 'Intelligence Overview', breadcrumb: 'Dashboard' };
      case '/documents':
        return { title: 'Document Library', breadcrumb: 'Corpus & Metadata' };
      case '/ask':
        return { title: 'Ask Clario', breadcrumb: 'RAG Research Assistant' };
      case '/compare':
        return { title: 'Document Comparison', breadcrumb: 'Comparative Diff & Alignment' };
      case '/search-lab':
        return { title: 'Search Lab & Benchmark', breadcrumb: 'Information Retrieval Analysis' };
      case '/findings':
        return { title: 'Reviewable Findings', breadcrumb: 'Contradiction Audit' };
      case '/reports':
        return { title: 'Intelligence Reports', breadcrumb: 'Executive Dossiers' };
      case '/settings':
        return { title: 'System Settings', breadcrumb: 'Configuration & Models' };
      default:
        return { title: 'Clario', breadcrumb: 'Workspace' };
    }
  };

  const { title, breadcrumb } = getPageInfo();

  return (
    <header className="h-16 bg-white border-b border-clario-border sticky top-0 z-20 px-6 flex items-center justify-between shadow-subtle">
      {/* Title & Breadcrumbs */}
      <div>
        <div className="flex items-center space-x-1.5 text-xs text-clario-text-secondary">
          <span>Clario</span>
          <ChevronRight className="w-3 h-3 text-clario-text-muted" />
          <span className="font-medium text-clario-teal">{breadcrumb}</span>
        </div>
        <h1 className="text-lg font-semibold text-clario-text tracking-tight">{title}</h1>
      </div>

      {/* Action Controls */}
      <div className="flex items-center space-x-4">
        {/* Global Search Button */}
        <button
          onClick={onOpenSearch}
          className="flex items-center space-x-3 bg-clario-ivory hover:bg-clario-ivory-muted text-clario-text-secondary px-3.5 py-1.5 rounded-lg border border-clario-border transition-all hover:border-clario-teal/40 text-xs shadow-sm"
        >
          <Search className="w-4 h-4 text-clario-teal" />
          <span className="hidden sm:inline">Search passages across corpus...</span>
          <kbd className="px-1.5 py-0.5 bg-white border border-clario-border rounded text-[10px] font-mono text-clario-text-secondary shadow-xs">
            ⌘K
          </kbd>
        </button>

        {/* Backend Connectivity Status */}
        <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-clario-sage-light/50 border border-clario-sage text-clario-navy text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Local Engine Active</span>
        </div>

        {/* Notifications Popover Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg text-clario-text-secondary hover:text-clario-text hover:bg-clario-ivory relative transition-colors"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-clario-gold" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-elevated border border-clario-border p-4 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-clario-border mb-3">
                <span className="font-semibold text-xs text-clario-text">System Alerts & Notifications</span>
                <span className="text-[10px] bg-clario-teal/10 text-clario-teal px-1.5 py-0.5 rounded font-medium">3 New</span>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="p-2 rounded-lg bg-clario-ivory border border-clario-border flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-clario-text">Corpus Ingestion Completed</p>
                    <p className="text-[11px] text-clario-text-secondary">6 synthetic test documents indexed with 22 semantic chunks.</p>
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-clario-ivory border border-clario-border flex items-start space-x-2">
                  <ShieldCheck className="w-4 h-4 text-clario-teal shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-clario-text">Contradiction Scanned</p>
                    <p className="text-[11px] text-clario-text-secondary">1 potential policy discrepancy flagged for human review.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Avatar */}
        <div className="w-8 h-8 rounded-full bg-clario-navy text-clario-sage flex items-center justify-center font-bold text-xs ring-2 ring-clario-sage/30">
          AR
        </div>
      </div>
    </header>
  );
};
