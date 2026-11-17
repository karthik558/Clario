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
  Sparkles
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
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside
      className={`fixed top-0 bottom-0 left-0 z-30 flex flex-col bg-clario-navy text-white transition-all duration-300 border-r border-clario-navy-light ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
        <div className="flex items-center space-x-3 overflow-hidden">
          {/* Clario Minimal Layered Document Icon */}
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-clario-teal to-clario-navy-light p-1.5 flex items-center justify-center relative shadow-sm shrink-0">
            <Layers className="w-5 h-5 text-clario-sage" />
            <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-clario-gold animate-pulse" />
          </div>

          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-lg tracking-tight text-white flex items-center space-x-1">
                <span>Clario</span>
                <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-clario-teal/30 text-clario-sage font-mono">v1.0</span>
              </span>
              <span className="text-[10px] text-clario-sage-light tracking-wide truncate max-w-[140px]">
                Every document. A clearer answer.
              </span>
            </div>
          )}
        </div>

        <button
          onClick={onToggle}
          className="p-1 rounded-md text-clario-sage-light hover:text-white hover:bg-white/10 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Workspace Selector */}
      {!collapsed ? (
        <div className="px-3 py-3 border-b border-white/5">
          <label className="text-[10px] font-medium tracking-wider uppercase text-clario-sage-light/70 px-2 mb-1 block">
            Workspace
          </label>
          <div className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white border border-white/10 cursor-pointer transition-colors">
            <Briefcase className="w-3.5 h-3.5 text-clario-gold" />
            <select
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              className="bg-transparent text-white text-xs w-full focus:outline-none cursor-pointer"
            >
              <option value="Legal & Compliance" className="bg-clario-navy text-white">Legal & Compliance</option>
              <option value="Enterprise Policies" className="bg-clario-navy text-white">Enterprise Policies</option>
              <option value="Research & ML Labs" className="bg-clario-navy text-white">Research & ML Labs</option>
            </select>
          </div>
        </div>
      ) : (
        <div className="py-3 flex justify-center border-b border-white/5">
          <Briefcase className="w-4 h-4 text-clario-gold" />
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-clario text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-clario-teal text-white shadow-sm border border-clario-teal-light/40'
                    : 'text-clario-sage-light/80 hover:text-white hover:bg-white/5'
                }`
              }
              title={collapsed ? item.name : undefined}
            >
              <Icon className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-105`} />
              {!collapsed && <span>{item.name}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* AI Engine Status Pill */}
      {!collapsed && (
        <div className="mx-3 mb-3 p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs">
          <div className="flex items-center space-x-2 text-clario-sage font-medium mb-1">
            <Sparkles className="w-3.5 h-3.5 text-clario-gold" />
            <span>Hybrid Retrieval Ready</span>
          </div>
          <p className="text-[11px] text-clario-sage-light/70 leading-relaxed">
            BM25 + Semantic Vector Search enabled with zero external cost.
          </p>
        </div>
      )}

      {/* User Profile */}
      <div className="p-3 border-t border-white/10 flex items-center space-x-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-clario-gold to-clario-sage flex items-center justify-center font-bold text-xs text-clario-navy shrink-0 shadow">
          AR
        </div>
        {!collapsed && (
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-semibold text-white truncate">Alex Rivera</p>
            <p className="text-[10px] text-clario-sage-light/70 truncate">Enterprise Research Analyst</p>
          </div>
        )}
      </div>
    </aside>
  );
};
