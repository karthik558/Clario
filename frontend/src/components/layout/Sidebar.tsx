import React, { useEffect, useRef } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useBackgroundTasks } from '../../context/BackgroundTaskContext';
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
  X,
  Scale,
  ShieldCheck,
  Calendar,
  ShieldAlert,
  BookOpen,
  FileCheck,
  ClipboardCheck,
  EyeOff,
  Cpu,
  CheckCircle2,
  Loader2
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
  onCloseMobile = () => { }
}) => {
  const sidebarRef = useRef<HTMLElement>(null);
  const { activeTasks, tasks, setIsDrawerOpen } = useBackgroundTasks();
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
    { name: 'Policy Checker', path: '/policy-checker', icon: ClipboardCheck },
    { name: 'Redaction Studio', path: '/redact', icon: EyeOff },
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
        <div className={`flex h-16 shrink-0 items-center ${collapsed ? 'justify-center px-3 py-3.5' : 'justify-between px-5 py-3.5 gap-4'} border-b border-white/10`}>
          <Link
            to="/"
            onClick={onCloseMobile}
            className={`flex items-center text-white hover:opacity-90 transition-opacity min-w-0 pr-1 ${collapsed ? 'lg:hidden' : ''}`}
            title="Clario Overview"
          >
            <img src="/clario.webp" alt="Clario" width="784" height="196" className="h-7 w-auto object-contain my-0.5" />
          </Link>

          {/* Desktop Collapse / Expand Button near Clario */}
          <button
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            aria-controls="workspace-navigation"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`hidden lg:flex items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white transition-colors shrink-0 ${collapsed ? 'w-full min-h-9' : 'p-1.5'}`}
          >
            {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>

          {/* Mobile Close Button */}
          <button
            aria-label="Close navigation"
            onClick={onCloseMobile}
            className="lg:hidden ml-auto p-1.5 text-slate-300 hover:text-white rounded-md hover:bg-white/10"
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
                  `sidebar-link flex items-center gap-3 min-h-9 px-3 py-2 rounded-md text-[13px] leading-5 transition-colors ${isActive
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

        {/* Real-time Background Tasks Pill / Trigger */}
        <div className={`shrink-0 border-t border-white/10 ${collapsed ? 'py-2 px-3 text-center' : 'p-2.5'}`}>
          {activeTasks.length > 0 ? (
            collapsed ? (
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="relative w-full min-h-9 flex items-center justify-center rounded-md text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                title={`${activeTasks.length} task${activeTasks.length > 1 ? 's' : ''} running`}
                aria-label="Task running"
              >
                <div className="relative flex items-center justify-center">
                  <Loader2 className="w-[17px] h-[17px] animate-spin text-slate-300" />
                  <span className="absolute -top-1 -right-1 px-1 min-w-3.5 h-3.5 flex items-center justify-center rounded-full text-[9px] font-mono font-bold bg-slate-700 text-slate-200 border border-slate-600">
                    {activeTasks.length}
                  </span>
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-all text-xs"
                title="Click to view live task progress"
              >
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300 shrink-0" />
                  <span className="text-[11px] font-medium text-slate-200">
                    {activeTasks.length > 1 ? 'Tasks running' : 'Task running'}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-200 bg-white/10 border border-white/10 px-1.5 py-0.5 rounded-md font-semibold">
                  {activeTasks.length}
                </span>
              </button>
            )
          ) : tasks.length > 0 ? (
            collapsed ? (
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="w-full min-h-9 flex items-center justify-center rounded-md text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                title={`${tasks.length} task(s) ready`}
                aria-label="Tasks"
              >
                <CheckCircle2 className="w-[17px] h-[17px] text-slate-300" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-all text-xs"
                title="View completed tasks"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-300" />
                  <span className="text-[11px] font-medium text-slate-200">
                    {tasks.length > 1 ? 'Tasks ready' : 'Task ready'}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded-md">
                  {tasks.length}
                </span>
              </button>
            )
          ) : collapsed ? (
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="w-full min-h-9 flex items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              title="Background Tasks"
              aria-label="Background Tasks"
            >
              <Cpu className="w-[17px] h-[17px] opacity-70 hover:opacity-100 transition-opacity" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors"
              title="View background tasks"
            >
              <div className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5" />
                <span>Background Tasks</span>
              </div>
              <span className="font-mono text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-md">
                0
              </span>
            </button>
          )}
        </div>

        <div className={`shrink-0 border-t border-white/10 ${collapsed ? 'py-3 px-3 flex justify-center items-center' : 'px-4 py-3.5'} text-xs text-slate-400`}>
          {collapsed ? (
            <Link
              to="/home"
              className="flex items-center justify-center w-full min-h-9 rounded-md text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              title="Clario"
              aria-label="Clario"
            >
              <img src="/favicon.svg" alt="Clario" className="w-[18px] h-[18px] opacity-80 hover:opacity-100 transition-opacity" />
            </Link>
          ) : (
            <a
              className="flex min-h-8 items-center px-2 py-1 rounded-md hover:text-white transition-colors group text-slate-400"
              href="https://karthiklal.in"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="© 2026 Clario • All rights reserved."
              title="© 2026 Clario • All rights reserved."
            >
              <span>©</span>
              <span className="sidebar-label ml-1.5 text-[11px] text-slate-400 group-hover:text-white transition-colors truncate">2026 Clario • All rights reserved.</span>
            </a>
          )}
        </div>
      </aside>
    </>
  );
};
