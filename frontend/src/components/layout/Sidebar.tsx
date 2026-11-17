import React, { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Files, MessageSquareQuote, GitCompare, FlaskConical, AlertTriangle, FileText, Settings, PanelLeftClose, PanelLeftOpen, Layers, X } from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, mobileOpen, onCloseMobile }) => {
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const sidebar = sidebarRef.current;
    const controls = () => Array.from(sidebar?.querySelectorAll<HTMLElement>('a, button') ?? []).filter(el => el.offsetParent !== null);
    controls()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = controls();
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1]?.focus(); }
      else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0]?.focus(); }
    };
    const media = window.matchMedia('(min-width: 768px)');
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
    { name: 'Findings', path: '/findings', icon: AlertTriangle },
    { name: 'Reports', path: '/reports', icon: FileText },
    { name: 'Search Lab', path: '/search-lab', icon: FlaskConical },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];
  return (
    <>
      {mobileOpen && <button aria-label="Close navigation backdrop" onClick={onCloseMobile} className="fixed inset-0 z-30 bg-clario-navy/40 md:hidden" />}
      <aside ref={sidebarRef} id="workspace-navigation" aria-label="Workspace navigation" className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="flex h-20 shrink-0 items-center gap-3 px-5 border-b border-white/10">
          <Layers className="w-7 h-7 text-clario-sage shrink-0" aria-hidden="true" />
          <div className="sidebar-label"><span className="text-xl font-semibold tracking-tight">Clario</span><p className="text-xs text-slate-400">Document intelligence</p></div>
          <button aria-label="Close navigation" onClick={onCloseMobile} className="md:hidden ml-auto p-2"><X className="w-5 h-5" /></button>
        </div>
        <nav aria-label="Main navigation" className="flex-1 min-h-0 overflow-y-auto px-3 py-6 space-y-1">
          {navItems.map(({ name, path, icon: Icon }) => (
            <NavLink key={path} to={path} end={path === '/'} onClick={onCloseMobile} aria-label={name} title={name}
              className={({ isActive }) => `sidebar-link flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors ${isActive ? 'bg-clario-teal text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
              <Icon className="w-5 h-5 shrink-0" aria-hidden="true" /><span className="sidebar-label">{name}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <button onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} aria-controls="workspace-navigation"
            className="hidden md:flex w-full items-center gap-3 p-3 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white text-sm">
            {collapsed ? <PanelLeftOpen className="w-5 h-5 shrink-0" /> : <PanelLeftClose className="w-5 h-5 shrink-0" />}<span className="sidebar-label">Collapse navigation</span>
          </button>
          <p className="sidebar-label px-3 pt-3 pb-2 text-xs text-slate-400">Your documents. Clearer decisions.</p>
        </div>
      </aside>
    </>
  );
};
