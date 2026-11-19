import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Square,
  CheckCircle2,
  Clock,
  ArrowRight,
  Trash2,
  Layers,
  Cpu,
  Loader2
} from 'lucide-react';
import { useBackgroundTasks, BackgroundTask } from '../../context/BackgroundTaskContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export const BackgroundTaskDrawer: React.FC = () => {
  const navigate = useNavigate();
  const { tasks, activeTasks, isDrawerOpen, setIsDrawerOpen, cancelTask, dismissTask, clearCompleted } = useBackgroundTasks();

  if (!isDrawerOpen) return null;

  const handleViewResult = (route: string) => {
    setIsDrawerOpen(false);
    navigate(route);

    // If route contains a hash, wait for view transition then smoothly scroll and highlight the target element
    const hashIndex = route.indexOf('#');
    if (hashIndex !== -1) {
      const elementId = route.substring(hashIndex + 1);
      setTimeout(() => {
        const el = document.getElementById(elementId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-slate-900', 'ring-offset-2', 'transition-all');
          setTimeout(() => {
            el.classList.remove('ring-2', 'ring-slate-900', 'ring-offset-2');
          }, 3500);
        }
      }, 150);
    }
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
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity"
        onClick={() => setIsDrawerOpen(false)}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l border-slate-200 shadow-xl flex flex-col justify-between">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-slate-900 text-white flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span>Background Tasks</span>
                  {activeTasks.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800">
                      <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-700" />
                      {activeTasks.length} editing
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Completed tasks clear automatically after 5 minutes
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsDrawerOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              aria-label="Close background tasks"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Task List Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {tasks.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-2">
                <Layers className="w-8 h-8 mx-auto text-slate-300 stroke-[1.2]" />
                <p className="text-xs font-medium text-slate-600">No active background tasks</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Tasks triggered in Red Team Critique, Executive Briefs, or Clause Redline continue running here across page navigation.
                </p>
              </div>
            ) : (
              tasks.map((task) => {
                const isRunning = task.status === 'running';

                return (
                  <div
                    key={task.id}
                    className="p-4 rounded-lg border border-slate-200 bg-white shadow-xs space-y-3 transition-all hover:border-slate-300"
                  >
                    {/* Top Row: Category badge & status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getCategoryBadge(task.category)}
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                          <Clock className="w-2.5 h-2.5" />
                          {task.completedAt || task.startedAt}
                        </span>
                      </div>

                      {isRunning ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                          <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                          Editing ({task.progress}%)
                        </span>
                      ) : task.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Ready
                        </span>
                      ) : task.status === 'cancelled' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          Cancelled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          Failed
                        </span>
                      )}
                    </div>

                    {/* Task Title & Concise Stage */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-900 leading-snug">
                        {task.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                        {task.stage}
                      </p>
                    </div>

                    {/* Progress Bar (when running) */}
                    {isRunning && (
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-800 rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(8, task.progress)}%` }}
                        />
                      </div>
                    )}

                    {/* Actions Row */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <div>
                        {isRunning ? (
                          <button
                            type="button"
                            onClick={() => cancelTask(task.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded border border-rose-200 transition-colors"
                          >
                            <Square className="w-3 h-3 fill-current" />
                            <span>End Task</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => dismissTask(task.id)}
                            className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>

                      {task.route && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewResult(task.route)}
                          className="text-xs py-1 px-3"
                        >
                          <span>{isRunning ? 'View in Page' : 'View Result'}</span>
                          <ArrowRight className="w-3.5 h-3.5 ml-1 text-slate-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3.5 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500">
            <span>
              {tasks.length} total • Auto-clears after 5m
            </span>
            {tasks.some((t) => t.status !== 'running') && (
              <button
                type="button"
                onClick={clearCompleted}
                className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 transition-colors font-medium"
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
