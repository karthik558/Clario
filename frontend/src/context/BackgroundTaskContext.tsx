import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

export interface TaskLogEntry {
  timestamp: string;
  message: string;
  type?: 'info' | 'progress' | 'success' | 'warning' | 'error';
}

export interface BackgroundTask {
  id: string;
  title: string;
  category: 'critique' | 'brief' | 'redline' | 'report' | 'scan' | 'counter';
  targetScope?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  stage: string;
  logs: TaskLogEntry[];
  startedAt: string;
  completedAt?: string;
  result?: any;
  error?: string;
  route: string;
  abortController?: AbortController;
}

interface BackgroundTaskContextType {
  tasks: BackgroundTask[];
  activeTasks: BackgroundTask[];
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  startTask: <T = any>(config: {
    title: string;
    category: BackgroundTask['category'];
    targetScope?: string;
    route: string;
    initialStage?: string;
    executor: (
      updateProgress: (progress: number, stage: string, log?: string) => void,
      signal: AbortSignal
    ) => Promise<T>;
  }) => Promise<T>;
  cancelTask: (taskId: string) => void;
  dismissTask: (taskId: string) => void;
  clearCompleted: () => void;
  getLatestTask: (category: BackgroundTask['category']) => BackgroundTask | undefined;
}

const BackgroundTaskContext = createContext<BackgroundTaskContextType | null>(null);

function formatTime(d: Date = new Date()): string {
  return d.toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const BackgroundTaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<BackgroundTask[]>(() => {
    try {
      const saved = sessionStorage.getItem('clario_bg_tasks');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Clean out aborted running tasks from previous session reload
        return parsed.map((t: any) => t.status === 'running' ? { ...t, status: 'completed', stage: 'Restored from previous session' } : t);
      }
    } catch {
      // Ignore storage errors
    }
    return [];
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const tasksRef = useRef<BackgroundTask[]>(tasks);
  tasksRef.current = tasks;

  // Persist tasks in sessionStorage
  useEffect(() => {
    try {
      const serializable = tasks.map(({ abortController, ...rest }) => rest);
      sessionStorage.setItem('clario_bg_tasks', JSON.stringify(serializable.slice(0, 20)));
    } catch {
      // Ignore storage errors
    }
  }, [tasks]);

  const activeTasks = tasks.filter((t) => t.status === 'running');

  const startTask = async <T = any,>(config: {
    title: string;
    category: BackgroundTask['category'];
    targetScope?: string;
    route: string;
    initialStage?: string;
    executor: (
      updateProgress: (progress: number, stage: string, log?: string) => void,
      signal: AbortSignal
    ) => Promise<T>;
  }): Promise<T> => {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const controller = new AbortController();
    const now = formatTime();

    const newTask: BackgroundTask = {
      id: taskId,
      title: config.title,
      category: config.category,
      targetScope: config.targetScope,
      status: 'running',
      progress: 5,
      stage: config.initialStage || 'Initializing task...',
      logs: [
        {
          timestamp: now,
          message: `Task started: ${config.title} ${config.targetScope ? `(${config.targetScope})` : ''}`,
          type: 'info',
        },
      ],
      startedAt: now,
      route: config.route,
      abortController: controller,
    };

    setTasks((prev) => [newTask, ...prev.slice(0, 19)]);

    const updateProgress = (progress: number, stage: string, logMessage?: string) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId || t.status !== 'running') return t;
          const nextLogs = logMessage
            ? [...t.logs, { timestamp: formatTime(), message: logMessage, type: 'progress' as const }]
            : t.logs;
          return {
            ...t,
            progress: Math.min(100, Math.max(0, progress)),
            stage,
            logs: nextLogs,
          };
        })
      );
    };

    try {
      const result = await config.executor(updateProgress, controller.signal);
      const finishedTime = formatTime();

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            status: 'completed',
            progress: 100,
            stage: 'Completed successfully',
            completedAt: finishedTime,
            result,
            logs: [
              ...t.logs,
              {
                timestamp: finishedTime,
                message: 'Task completed successfully.',
                type: 'success',
              },
            ],
          };
        })
      );
      return result;
    } catch (err: any) {
      const failedTime = formatTime();
      const isCancelled = controller.signal.aborted || err?.name === 'AbortError' || err?.message?.includes('aborted');

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            status: isCancelled ? 'cancelled' : 'failed',
            stage: isCancelled ? 'Cancelled by user' : (err?.message || 'Task failed'),
            completedAt: failedTime,
            error: err?.message || 'Task execution failed',
            logs: [
              ...t.logs,
              {
                timestamp: failedTime,
                message: isCancelled ? 'Task cancelled by user.' : `Execution error: ${err?.message || 'Unknown error'}`,
                type: isCancelled ? 'warning' : 'error',
              },
            ],
          };
        })
      );
      throw err;
    }
  };

  const cancelTask = (taskId: string) => {
    const task = tasksRef.current.find((t) => t.id === taskId);
    if (task && task.status === 'running') {
      try {
        task.abortController?.abort();
      } catch {
        // Ignore
      }
      const now = formatTime();
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'cancelled',
                stage: 'Terminated by user from sidebar',
                completedAt: now,
                logs: [
                  ...t.logs,
                  {
                    timestamp: now,
                    message: 'Task forcefully terminated by user from background manager.',
                    type: 'warning',
                  },
                ],
              }
            : t
        )
      );
    }
  };

  const dismissTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const clearCompleted = () => {
    setTasks((prev) => prev.filter((t) => t.status === 'running'));
  };

  const getLatestTask = (category: BackgroundTask['category']) => {
    return tasks.find((t) => t.category === category);
  };

  return (
    <BackgroundTaskContext.Provider
      value={{
        tasks,
        activeTasks,
        isDrawerOpen,
        setIsDrawerOpen,
        startTask,
        cancelTask,
        dismissTask,
        clearCompleted,
        getLatestTask,
      }}
    >
      {children}
    </BackgroundTaskContext.Provider>
  );
};

const defaultFallbackContext: BackgroundTaskContextType = {
  tasks: [],
  activeTasks: [],
  isDrawerOpen: false,
  setIsDrawerOpen: () => {},
  startTask: async <T,>(config: any): Promise<T> => {
    return config.executor(() => {});
  },
  cancelTask: () => {},
  dismissTask: () => {},
  clearCompleted: () => {},
  getLatestTask: () => undefined,
};

export const useBackgroundTasks = () => {
  const context = useContext(BackgroundTaskContext);
  if (!context) {
    return defaultFallbackContext;
  }
  return context;
};
