import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Files,
  MessageSquareQuote,
  GitCompare,
  FlaskConical,
  AlertTriangle,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Layers,
  Sparkles,
  Bot
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const [workspace, setWorkspace] = useState('Legal & Compliance');

  const navItems = [
    { name: 'Overview', path: '/', icon: LayoutDashboard },
    { name: 'My Documents', path: '/documents', icon: Files },
    { name: 'Ask Clario', path: '/ask', icon: MessageSquareQuote },
    { name: 'Compare', path: '/compare', icon: GitCompare },
    { name: 'Search Lab', path: '/search-lab', icon: FlaskConical },
    { name: 'Findings', path: '/findings', icon: AlertTriangle },
    { name: 'Reports', path: '/reports', icon: FileText },
    { name: 'Settings & Ollama', path: '/settings', icon: Settings },
  ];

  return (
    <aside
      className={`fixed top-0 bottom-0 left-0 z-30 flex flex-col bg-[#0F1D30] text-white transition-all duration-300 border-r border-[#1B2F4B] shadow-elevated ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/[0.08] bg-[#0C1726]/60 backdrop-blur-xs">
        <div className="flex items-center space-x-3 overflow-hidden">
          {/* Minimal Layered Document Icon */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#477E88] to-[#1E3553] p-2 flex items-center justify-center relative shadow-md shrink-0 border border-white/10">
            <Layers className="w-5 h-5 text-[#A9D5C3]" />
            <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#D4AE72] shadow-xs" />
          </div>

          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight text-white flex items-center space-x-1.5">
                <span>Clario</span>
              </span>
              <span className="text-[10.5px] text-[#A9D5C3]/80 font-medium tracking-wide truncate max-w-[140px]">
                Every document. A clearer answer.
              </span>
            </div>
          )}
        </div>

        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Workspace Selector */}
      {!collapsed ? (
        <div className="px-3.5 py-3 border-b border-white/[0.06]">
          <div className="flex items-center space-x-2 bg-white/[0.04] hover:bg-white/[0.08] rounded-xl px-3 py-2 text-xs text-white border border-white/[0.08] transition-all cursor-pointer">
            <Briefcase className="w-3.5 h-3.5 text-[#D4AE72] shrink-0" />
            <div className="flex-1 overflow-hidden">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 block -mb-0.5">Workspace</span>
              <select
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                className="bg-transparent text-white text-xs font-medium w-full focus:outline-none cursor-pointer truncate"
              >
                <option value="Legal & Compliance" className="bg-[#0F1D30] text-white">Legal & Compliance</option>
                <option value="Enterprise Policies" className="bg-[#0F1D30] text-white">Enterprise Policies</option>
                <option value="Research & ML Labs" className="bg-[#0F1D30] text-white">Research & ML Labs</option>
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-3 flex justify-center border-b border-white/[0.06]">
          <Briefcase className="w-4 h-4 text-[#D4AE72]" />
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-3.5 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all group ${
                  isActive
                    ? 'bg-[#477E88] text-white shadow-card border border-[#A9D5C3]/30 font-semibold'
                    : 'text-slate-300/80 hover:text-white hover:bg-white/[0.06]'
                }`
              }
              title={collapsed ? item.name : undefined}
            >
              <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110`} />
              {!collapsed && <span>{item.name}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Ollama / Engine Status Pill */}
      {!collapsed && (
        <div className="mx-3.5 mb-3 p-3 rounded-xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.08] text-xs">
          <div className="flex items-center justify-between text-[#A9D5C3] font-semibold mb-1">
            <span className="flex items-center space-x-1.5">
              <Bot className="w-3.5 h-3.5 text-[#D4AE72]" />
              <span>Local Model Enabled</span>
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <p className="text-[11px] text-slate-300/70 leading-relaxed font-normal">
            Ollama local inference & hybrid BM25 + dense vectors ready.
          </p>
        </div>
      )}

      {/* User Profile */}
      <div className="p-3.5 border-t border-white/[0.08] bg-[#0C1726]/40 flex items-center space-x-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#D4AE72] to-[#A9D5C3] flex items-center justify-center font-bold text-xs text-[#0F1D30] shrink-0 shadow-md ring-1 ring-white/20">
          AR
        </div>
        {!collapsed && (
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-semibold text-white truncate">Alex Rivera</p>
            <p className="text-[10.5px] text-slate-400 truncate font-medium">Enterprise Intelligence</p>
          </div>
        )}
      </div>
    </aside>
  );
};
