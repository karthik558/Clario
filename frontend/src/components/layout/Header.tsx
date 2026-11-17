import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Search,
  Bell,
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
  Bot
} from 'lucide-react';

interface HeaderProps {
  onOpenSearch: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSearch }) => {
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);

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
        return { title: 'System Settings & Ollama', breadcrumb: 'Configuration & Local Models' };
      default:
        return { title: 'Clario', breadcrumb: 'Workspace' };
    }
  };

  const { title, breadcrumb } = getPageInfo();

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-[#E4E8E6] sticky top-0 z-20 px-8 flex items-center justify-between shadow-subtle transition-all">
      {/* Title & Breadcrumbs */}
      <div>
        <div className="flex items-center space-x-1.5 text-[11px] text-[#748293] font-medium tracking-wide">
          <span>Clario</span>
          <ChevronRight className="w-3 h-3 text-[#96A3B2]" />
          <span className="font-semibold text-[#477E88]">{breadcrumb}</span>
        </div>
        <h1 className="text-base font-bold text-[#14263D] tracking-tight">{title}</h1>
      </div>

      {/* Action Controls */}
      <div className="flex items-center space-x-3.5">
        {/* Global Search Button */}
        <button
          onClick={onOpenSearch}
          className="flex items-center space-x-3 bg-[#F8F7F3] hover:bg-[#F0EFEA] text-[#748293] hover:text-[#233448] px-3.5 py-1.5 rounded-xl border border-[#E4E8E6] transition-all hover:border-[#477E88]/40 text-xs shadow-xs"
        >
          <Search className="w-3.5 h-3.5 text-[#477E88]" />
          <span className="hidden sm:inline font-medium">Search cross-document index...</span>
          <kbd className="px-1.5 py-0.5 bg-white border border-[#E4E8E6] rounded-md text-[10px] font-mono text-[#748293] shadow-xs">
            ⌘K
          </kbd>
        </button>

        {/* Engine Status Badge */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#A9D5C3]/20 border border-[#A9D5C3]/60 text-[#14263D] text-xs font-semibold shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Local Engine Active</span>
        </div>

        {/* Notifications Popover Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-xl text-[#748293] hover:text-[#233448] hover:bg-[#F8F7F3] relative transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#D4AE72] ring-2 ring-white" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-elevated border border-[#E4E8E6] p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#E4E8E6] mb-3">
                <span className="font-bold text-xs text-[#14263D]">Workspace Alerts</span>
                <span className="text-[10px] bg-[#477E88]/10 text-[#477E88] px-2 py-0.5 rounded-full font-bold">2 Active</span>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-[#F8F7F3] border border-[#E4E8E6] flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-[#14263D]">Indexed Ready</p>
                    <p className="text-[11px] text-[#748293] leading-relaxed">6 documents segmented into 22 semantic chunks.</p>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F8F7F3] border border-[#E4E8E6] flex items-start space-x-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#477E88] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-[#14263D]">Contradictions Flagged</p>
                    <p className="text-[11px] text-[#748293] leading-relaxed">1 substantive divergence identified between v1 and v2 retention policies.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Avatar */}
        <div className="w-8 h-8 rounded-full bg-[#14263D] text-[#A9D5C3] flex items-center justify-center font-bold text-xs ring-2 ring-[#A9D5C3]/40 shadow-xs">
          AR
        </div>
      </div>
    </header>
  );
};
