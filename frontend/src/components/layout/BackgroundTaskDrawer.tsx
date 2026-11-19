import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Square,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Terminal,
  Trash2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers
} from 'lucide-react';
import { useBackgroundTasks, BackgroundTask } from '../../context/BackgroundTaskContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export const BackgroundTaskDrawer: React.FC = () => {
  const navigate = useNavigate();
  const { tasks, activeTasks, isDrawerOpen, setIsDrawerOpen, cancelTask, dismissTask, clearCompleted } = useBackgroundTasks();
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});

  if (!isDrawerOpen) return null;

  const toggleLog = (id: string) => {
    setExpandedLogIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getCategoryBadge = (category: BackgroundTask['category']) => {
    switch (category) {
      case 'critique':
        return <Badge variant="navy" size="sm">Red Team Critique</Badge>;
      case 'brief':
        return <Badge variant="teal" size="sm">Executive Brief</Badge>;
      case 'redline':
        return <Badge variant="gold" size="sm">Clause Redline</Badge>;
      case 'report':
        return <Badge variant="sage" size="sm">PDF Dossier</Badge>;
      case 'counter':
        return <Badge variant="navy" size="sm">AI Counter</Badge>;
      default:
        return <Badge variant="gray" size="sm">Background AI</Badge>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={() => setIsDrawerOpen(false)}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l border-slate-200 shadow-xl flex flex-col justify-between">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-slate-900 text-white flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span>Background Tasks & AI Logs</span>
                  {activeTasks.length > 0 && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-rose-100 text-rose-700 animate-pulse">
                      {activeTasks.length} active
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Monitor, inspect live logs, or terminate active operations.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsDrawerOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              aria-label="Close background task manager"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Task List Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {tasks.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-2">
                <Layers className="w-8 h-8 mx-auto text-slate-300 stroke-[1.2]" />
                <p className="text-xs font-medium text-slate-600">No background tasks</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Tasks triggered in Red Team Critique, Executive Briefs, or Clause Redline will run here and persist across page navigation.
                </p>
              </div>
            ) : (
              tasks.map((task) => {
                const isRunning = task.status === 'running';
                const isExpanded = expandedLogIds[task.id] ?? isRunning;

                return (
                  <div
                    key={task.id}
                    className={`p-3.5 rounded-lg border transition-all space-y-2.5 ${
                      isRunning
                        ? 'border-slate-900/30 bg-slate-50/50 shadow-xs'
                        : task.status === 'completed'
                        ? 'border-slate-200 bg-white'
                        : 'border-slate-200 bg-slate-50/30'
                    }`}
                  >
                    {/* Top Row: Title, Scope, and Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {getCategoryBadge(task.category)}
                          <span className="text-[10px] font-mono text-slate-400">
                            {task.startedAt}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 mt-1 truncate">
                          {task.title}
                        </h4>
                        {task.targetScope && (
                          <p className="text-[11px] text-slate-500 truncate">
                            Scope: {task.targetScope}
                          </p>
                        )}
                      </div>

                      {/* Status indicator */}
                      <div>
                        {isRunning ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                            Running
                          </span>
                        ) : task.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Done
                          </span>
                        ) : task.status === 'cancelled' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                            Cancelled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                            Failed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar & Stage */}
                    {isRunning && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-600 font-medium truncate">
                            {task.stage}
                          </span>
                          <span className="font-mono text-slate-500 font-bold ml-2">
                            {task.progress}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-slate-900 transition-all duration-300 rounded-full"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {!isRunning && (
                      <p className="text-[11px] text-slate-600 italic">
                        {task.stage}
                      </p>
                    )}

                    {/* Live Terminal / Log Viewer */}
                    <div className="rounded-md border border-slate-200 bg-slate-900 text-slate-200 overflow-hidden text-[11px] font-mono">
                      <button
                        type="button"
                        onClick={() => toggleLog(task.id)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 bg-slate-800 text-slate-300 hover:text-white transition-colors"
                      >
                        <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider">
                          <Terminal className="w-3 h-3 text-slate-400" />
                          Live Activity Log ({task.logs.length})
                        </span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      {isExpanded && (
                        <div className="p-2 space-y-1 max-h-32 overflow-y-auto selection:bg-slate-700 text-[10.5px]">
                          {task.logs.map((log, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 leading-tight">
                              <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>
                              <span
                                className={
                                  log.type === 'error'
                                    ? 'text-rose-400'
                                    : log.type === 'warning'
                                    ? 'text-amber-300'
                                    : log.type === 'success'
                                    ? 'text-emerald-300'
                                    : 'text-slate-300'
                                }
                              >
                                {log.message}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        {isRunning && (
                          <button
                            type="button"
                            onClick={() => cancelTask(task.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1 rounded border border-rose-200 transition-colors"
                            title="Forcefully terminate this task"
                          >
                            <Square className="w-3 h-3 fill-current" />
                            <span>End Task</span>
                          </button>
                        )}
                        {!isRunning && (
                          <button
                            type="button"
                            onClick={() => dismissTask(task.id)}
                            className="text-[11px] text-slate-400 hover:text-slate-600 hover:underline"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>

                      {task.route && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsDrawerOpen(false);
                            navigate(task.route);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                          <span>{isRunning ? 'View in Page' : 'View Result'}</span>
                          <ArrowRight className="w-3 h-3 text-slate-500" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              {activeTasks.length} running • {tasks.length} total
            </span>
            {tasks.some((t) => t.status !== 'running') && (
              <button
                type="button"
                onClick={clearCompleted}
                className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-900 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear Completed</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
