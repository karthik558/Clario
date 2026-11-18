import React, { useEffect, useRef } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Files,
  MessageSquareQuote,
  GitCompare,
  Network,
  FlaskConical,
  AlertTriangle,
  FileText,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
  X,
  Scale,
  ShieldCheck,
  Calendar,
  ShieldAlert,
  BookOpen,
  FileCheck
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggle,
  mobileOpen = false,
  onCloseMobile = () => {}
}) => {
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const sidebar = sidebarRef.current;
    const controls = () => Array.from(sidebar?.querySelectorAll<HTMLElement>('a, button') ?? []).filter(el => el.offsetParent !== null);
    controls()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onCloseMobile(); return; }
      if (event.key !== 'Tab') return;
      const items = controls();
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1]?.focus(); }
      else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0]?.focus(); }
    };
    const media = window.matchMedia('(min-width: 1024px)');
    const resize = () => { if (media.matches) onCloseMobile(); };
    media.addEventListener('change', resize);
    sidebar?.addEventListener('keydown', trap);
    return () => { media.removeEventListener('change', resize); sidebar?.removeEventListener('keydown', trap); previous?.focus(); };
  }, [mobileOpen]);

  const navItems = [
    { name: 'Overview', path: '/', icon: LayoutDashboard },
    { name: 'Documents', path: '/documents', icon: Files },
    { name: 'Ask Clario', path: '/ask', icon: MessageSquareQuote },
    { name: 'Compare versions', path: '/compare', icon: GitCompare },
    { name: 'Knowledge Graph', path: '/graph', icon: Network },
    { name: 'Findings', path: '/findings', icon: AlertTriangle },
    { name: 'Clause Redline', path: '/negotiate', icon: Scale },
    { name: 'Compliance Matrix', path: '/compliance', icon: ShieldCheck },
    { name: 'Obligations Timeline', path: '/obligations', icon: Calendar },
    { name: 'Red Team Critique', path: '/critique', icon: ShieldAlert },
    { name: 'Clause Library', path: '/clauses', icon: BookOpen },
    { name: 'Executive Briefs', path: '/briefs', icon: FileText },
    { name: 'Reports', path: '/reports', icon: FileCheck },
    { name: 'Search Lab', path: '/search-lab', icon: FlaskConical },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <>
      {mobileOpen && <button aria-label="Close navigation backdrop" onClick={onCloseMobile} className="fixed inset-0 z-30 bg-black/50 lg:hidden" />}
      <aside ref={sidebarRef} id="workspace-navigation" aria-label="Workspace navigation" className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className={`flex h-14 shrink-0 items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-4 sm:px-5'} border-b border-white/10`}>
          <Link
            to="/"
            onClick={onCloseMobile}
            className={`flex items-center gap-3 text-white hover:opacity-90 transition-opacity min-w-0 ${collapsed ? 'lg:hidden' : ''}`}
            title="Clario Overview"
          >
            <Layers className="w-7 h-7 text-white shrink-0" aria-hidden="true" />
            <div className="sidebar-label">
              <span className="text-xl font-semibold tracking-tight text-white">Clario</span>
            </div>
          </Link>

          {/* Desktop Collapse / Expand Button near Clario */}
          <button
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            aria-controls="workspace-navigation"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex p-2 rounded-md text-slate-300 hover:bg-white/10 hover:text-white transition-colors shrink-0"
          >
            {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>

          {/* Mobile Close Button */}
          <button
            aria-label="Close navigation"
            onClick={onCloseMobile}
            className="lg:hidden ml-auto p-2 text-slate-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav aria-label="Main navigation" className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-0.5">
          {navItems.map(({ name, path, icon: Icon }) => (
            <React.Fragment key={path}>
              {(path === '/findings' || path === '/reports') && <hr className="mx-3 !my-2 border-white/10" />}
              <NavLink
                to={path}
                end={path === '/'}
                onClick={onCloseMobile}
                aria-label={name}
                title={name}
                className={({ isActive }) =>
                  `sidebar-link flex items-center gap-3 min-h-9 px-3 py-2 rounded-md text-[13px] leading-5 transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon strokeWidth={1.65} className="w-[17px] h-[17px] shrink-0" aria-hidden="true" />
                <span className="sidebar-label truncate min-w-0">{name}</span>
              </NavLink>
            </React.Fragment>
          ))}
        </nav>
        <div className="shrink-0 border-t border-white/10 px-3 py-3 text-xs text-slate-300">
          <a className="flex min-h-8 items-center px-3 rounded-md hover:text-white" href="https://karthiklal.in" target="_blank" rel="noopener noreferrer" aria-label="© 2026 Clario">
            ©<span className="sidebar-label ml-1">2026 Clario</span>
          </a>
        </div>
      </aside>
    </>
  );
};
