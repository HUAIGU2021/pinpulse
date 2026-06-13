import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import { TaskCard } from "./components/TaskCard";
import { TaskDetails } from "./components/TaskDetails";
import { SettingsDrawer } from "./components/SettingsDrawer";
import { useSettings } from "./hooks/useSettings";
import { applyAgentStatusTimeout, type AgentStatusSnapshot } from "./domain/agentStatus";
import { applyMarkdownProgress, applyProgressEvents, clampFlags, clampProgress, sortTasks, visibleProgress, type PinPulseTask } from "./domain/task";
import { bindFolder, createTask, deleteTask, listTasks, refreshBoundFolder, updateTask, watchAgentStatus } from "./services/taskRepository";
import { collapseToMini, COMPACT_CSS_WIDTH, restoreFromMini } from "./services/windowRepository";
import SyncSettings from "./components/SyncSettings";
import { connectSyncClient, loadSyncSettings, startSyncServer } from "./services/syncService";
import "./styles.css";

const defaultTasks: PinPulseTask[] = [
  {
    id: "task-desktop-reminder",
    title: "开发桌面红绿灯提醒",
    flags: 8,
    progress: 0,
    automaticProgress: 36,
    manualOverride: false,
    connection: "healthy",
    deadlineState: "none",
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
    archived: false,
    steps: [],
  },
  {
    id: "task-figure-cleanup",
    title: "整理论文图表",
    flags: 5,
    progress: 0,
    automaticProgress: 58,
    manualOverride: false,
    connection: "unbound",
    deadlineState: "none",
    createdAt: "2026-06-12T01:00:00.000Z",
    updatedAt: "2026-06-12T01:00:00.000Z",
    archived: false,
    steps: [],
  },
];

export default function App() {
  const [tasks, setTasks] = useState<PinPulseTask[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [showingArchive, setShowingArchive] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const { settings, update: updateSettings, restoreDefaults } = useSettings();
  const sortedTasks = useMemo(() => sortTasks(tasks, settings), [tasks, settings]);
  const archivedTasks = useMemo(
    () => tasks.filter((t) => t.archived).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [tasks],
  );
  const shellRef = useRef<HTMLDivElement>(null);
  const tasksRef = useRef<PinPulseTask[]>([]);
  const lastHeightRef = useRef(0);
  const syncStartedRef = useRef(false);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    if (!collapsed || !shellRef.current) return;
    lastHeightRef.current = 0;
    const el = shellRef.current;
    const dpr = window.devicePixelRatio || 1;
    const observer = new ResizeObserver(() => {
      const h = el.clientHeight;
      if (h > 0 && h !== lastHeightRef.current) {
        lastHeightRef.current = h;
        getCurrentWindow().setSize(new PhysicalSize(Math.round(COMPACT_CSS_WIDTH * dpr), Math.round(h * dpr)));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [collapsed, sortedTasks]);

  useEffect(() => {
    listTasks()
      .then((dbTasks) => {
        if (dbTasks.length === 0) {
          setTasks(defaultTasks);
          for (const task of defaultTasks) {
            updateTask(task.id, { ...task });
          }
        } else {
          setTasks(dbTasks);
        }
      })
      .catch(() => setTasks(defaultTasks))
      .finally(() => setLoaded(true));
  }, []);

  const watchedFoldersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    let timeoutId: number | undefined;
    const unlistenFns: (() => void)[] = [];

    const startFolderWatcher = async (folder: string) => {
      if (watchedFoldersRef.current.has(folder)) return;
      try {
        await watchAgentStatus(folder);
        watchedFoldersRef.current.add(folder);
      } catch { /* watcher may already be active */ }
    };

    const startAllWatchers = async () => {
      const boundTasks = tasksRef.current.filter((task) => task.boundFolder && !task.archived);
      for (const task of boundTasks) {
        await startFolderWatcher(task.boundFolder!);
      }
    };

    const setupEventListener = async () => {
      try {
        const unlisten = await listen<{ folder: string; status: AgentStatusSnapshot }>(
          "agent-status-changed",
          (event) => {
            const { folder, status } = event.payload;
            setTasks((items) =>
              items.map((item) =>
                item.boundFolder === folder
                  ? { ...item, agentStatus: applyAgentStatusTimeout(status), updatedAt: new Date().toISOString() }
                  : item,
              ),
            );
          },
        );
        unlistenFns.push(unlisten);
      } catch { /* event system unavailable */ }
    };

    const refreshProgress = async () => {
      const boundTasks = tasksRef.current.filter((task) => task.boundFolder && !task.archived);
      if (boundTasks.length === 0) return;

      const updates = await Promise.all(
        boundTasks.map(async (task) => {
          try {
            const refresh = await refreshBoundFolder(task.boundFolder!);
            let updated = applyProgressEvents(task, refresh.events);
            updated = applyMarkdownProgress(updated, refresh.markdownProgress);
            const patch: Record<string, unknown> = {
              automaticProgress: updated.automaticProgress,
              steps: updated.steps,
              agentStatusHistory: refresh.agentStatus?.history ?? [],
              connection: "healthy" as const,
              updatedAt: new Date().toISOString(),
            };
            if (refresh.agentStatus?.current) {
              patch.agentStatus = applyAgentStatusTimeout(refresh.agentStatus.current);
            }
            return { taskId: task.id, patch };
          } catch {
            return {
              taskId: task.id,
              patch: {
                connection: "warning" as const,
                updatedAt: new Date().toISOString(),
              },
            };
          }
        }),
      );

      setTasks((items) =>
        items.map((item) => {
          const update = updates.find((entry) => entry.taskId === item.id);
          return update ? { ...item, ...update.patch } : item;
        }),
      );
    };

    const runFallbackLoop = async () => {
      await refreshProgress();
      if (!cancelled) {
        timeoutId = window.setTimeout(runFallbackLoop, settings.progressRefreshIntervalMs);
      }
    };

    startAllWatchers();
    setupEventListener();
    runFallbackLoop();

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      unlistenFns.forEach((fn) => fn());
    };
  }, [loaded]);

  // Sync startup
  useEffect(() => {
    if (!loaded || syncStartedRef.current) return;
    syncStartedRef.current = true;
    const syncSettings = loadSyncSettings();
    if (syncSettings.mode === "server") {
      startSyncServer(syncSettings.port).catch(() => {});
    } else if (syncSettings.host) {
      connectSyncClient(syncSettings.host, syncSettings.port).catch(() => {});
    }

    const unlistenFns: (() => void)[] = [];

    listen("sync-tasks-updated", () => {
      listTasks().then((dbTasks) => {
        setTasks((prev) => {
          const dbMap = new Map(dbTasks.map((t) => [t.id, t]));
          const merged = prev
            .filter((t) => dbMap.has(t.id))
            .map((t) => {
              const db = dbMap.get(t.id)!;
              dbMap.delete(t.id);
              return { ...db, agentStatus: t.agentStatus, agentStatusHistory: t.agentStatusHistory };
            });
          const news = Array.from(dbMap.values()).filter(
            (t) => !prev.find((p) => p.id === t.id),
          );
          return [...merged, ...news];
        });
      }).catch(() => {});
    }).then((fn) => { unlistenFns.push(fn); });

    listen<{ taskId: string; status: { state: string; agent: string; sessionId?: string; lastEvent?: string; lastSeenAt: string } }>(
      "sync-agent-status",
      (event) => {
        const { taskId, status } = event.payload;
        setTasks((items) =>
          items.map((item) =>
            item.id === taskId
              ? {
                  ...item,
                  agentStatus: {
                    protocolVersion: 1,
                    taskId,
                    agent: status.agent as "claude" | "codex" | "unknown",
                    sessionId: status.sessionId ?? undefined,
                    state: status.state as AgentStatusSnapshot["state"],
                    lastEvent: status.lastEvent ?? undefined,
                    lastSeenAt: status.lastSeenAt,
                  },
                }
              : item,
          ),
        );
      },
    ).then((fn) => { unlistenFns.push(fn); });

    return () => {
      unlistenFns.forEach((fn) => fn());
    };
  }, [loaded]);

  const finishCompletion = useCallback((taskId: string) => {
    setTasks((items) => items.map((item) => (item.id === taskId ? { ...item, archived: true, updatedAt: new Date().toISOString() } : item)));
    setCompletingTaskId(null);
    updateTask(taskId, { archived: true });
  }, []);

  useEffect(() => {
    if (!completingTaskId) return;
    const timer = window.setTimeout(() => finishCompletion(completingTaskId), settings.completionAnimationMs);
    return () => window.clearTimeout(timer);
  }, [completingTaskId, finishCompletion]);

  const autoCompleteTimersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const currentTimers = autoCompleteTimersRef.current;
    for (const task of tasks) {
      const progress = visibleProgress(task);
      if (!task.archived && progress >= 100 && completingTaskId !== task.id && !currentTimers.has(task.id)) {
        const timer = window.setTimeout(() => {
          setCompletingTaskId(task.id);
          currentTimers.delete(task.id);
        }, settings.autoCompleteDelayMs);
        currentTimers.set(task.id, timer);
      } else if (progress < 100 && currentTimers.has(task.id)) {
        window.clearTimeout(currentTimers.get(task.id));
        currentTimers.delete(task.id);
      }
    }
    // Clean up timers for tasks no longer in the list
    const activeIds = new Set(tasks.map((t) => t.id));
    for (const [id, timer] of currentTimers) {
      if (!activeIds.has(id)) {
        window.clearTimeout(timer);
        currentTimers.delete(id);
      }
    }
  }, [tasks, completingTaskId]);

  const changeFlags = useCallback((taskId: string, flags: number) => {
    const clamped = clampFlags(flags);
    setTasks((items) => items.map((item) => (item.id === taskId ? { ...item, flags: clamped } : item)));
    updateTask(taskId, { flags: clamped });
  }, []);

  const handleProgressCommit = useCallback((taskId: string, progress: number) => {
    const clamped = clampProgress(progress);
    setTasks((items) =>
      items.map((item) =>
        item.id === taskId ? { ...item, progress: clamped, manualOverride: true, updatedAt: new Date().toISOString() } : item,
      ),
    );
    updateTask(taskId, { progress: clamped, manualOverride: true });
  }, []);

  const handleUpdateTask = useCallback((taskId: string, patch: Partial<PinPulseTask>) => {
    setTasks((items) =>
      items.map((item) => (item.id === taskId ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item)),
    );
    updateTask(taskId, patch as Record<string, unknown>);
  }, []);

  const handleBindFolder = useCallback(async (taskId: string, folder: string) => {
    const task = tasks.find((t) => t.id === taskId);
    const trimmed = folder.trim();
    if (!task || !trimmed) return;

    try {
      await bindFolder({ taskId: task.id, title: task.title, folder: trimmed });

      if (!watchedFoldersRef.current.has(trimmed)) {
        try {
          await watchAgentStatus(trimmed);
          watchedFoldersRef.current.add(trimmed);
        } catch { /* watcher start failed */ }
      }

      const refresh = await refreshBoundFolder(trimmed);
      let updated = applyProgressEvents(task, refresh.events);
      updated = applyMarkdownProgress(updated, refresh.markdownProgress);

      setTasks((items) =>
        items.map((item) =>
          item.id === taskId
            ? {
                ...item,
                ...updated,
                boundFolder: trimmed,
                connection: "healthy",
                ...(refresh.agentStatus?.current ? { agentStatus: applyAgentStatusTimeout(refresh.agentStatus.current) } : {}),
                agentStatusHistory: refresh.agentStatus?.history ?? [],
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      updateTask(taskId, { boundFolder: trimmed, connection: "healthy", automaticProgress: updated.automaticProgress, steps: updated.steps });
    } catch {
      // folder binding failed silently
    }
  }, [tasks]);

  const handleSetDeadline = useCallback((taskId: string, deadline: string | undefined) => {
    setTasks((items) =>
      items.map((item) => (item.id === taskId ? { ...item, deadline, updatedAt: new Date().toISOString() } : item)),
    );
    updateTask(taskId, { deadline });
  }, []);

  async function toggleCollapsed() {
    if (collapsed) {
      await restoreFromMini();
    } else {
      await collapseToMini(settings.compactWidth);
    }
    setCollapsed(!collapsed);
  }

  const handleRestoreTask = useCallback((taskId: string) => {
    setTasks((items) => items.map((item) => {
      if (item.id !== taskId) return item;
      const auto = item.automaticProgress >= 100 ? 99 : item.automaticProgress;
      return { ...item, archived: false, progress: 0, manualOverride: false, automaticProgress: auto, updatedAt: new Date().toISOString() };
    }));
    updateTask(taskId, { archived: false, progress: 0, manualOverride: false });
  }, []);

  const handleDeleteTask = useCallback((taskId: string) => {
    setTasks((items) => items.filter((item) => item.id !== taskId));
    deleteTask(taskId);
  }, []);

  const handleCreateTask = useCallback(async () => {
    const task = await createTask({ title: "新任务", flags: 0 });
    setTasks((items) => [task, ...items]);
    setOpenTaskId(task.id);
  }, []);

  if (!loaded) {
    return (
      <main className="app-shell">
        <header className="app-header">
          <h1>PinPulse</h1>
        </header>
        <p>加载中...</p>
      </main>
    );
  }

  return (
    <main
      ref={shellRef}
      className={`app-shell${collapsed ? " app-shell--collapsed" : ""}`}
      onDoubleClick={toggleCollapsed}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpenTaskId(null);
      }}
    >
      {!collapsed ? (
        <header className="app-header">
          <h1>PinPulse</h1>
          <div className="header-buttons">
            <button
              type="button"
              className="add-task-btn"
              onClick={handleCreateTask}
              aria-label="添加任务"
            >
              +
            </button>
            <button
              type="button"
              className="archive-toggle"
              onClick={() => setShowingArchive(!showingArchive)}
            >
              {showingArchive ? "← 返回" : "✓"}
            </button>
            <button
              type="button"
              className="settings-gear"
              onClick={() => setShowSyncSettings(true)}
              aria-label="同步设置"
            >
              ⇄
            </button>
            <button
              type="button"
              className="settings-gear"
              onClick={() => setSettingsOpen(true)}
              aria-label="打开设置"
            >
              ⚙
            </button>
          </div>
        </header>
      ) : null}
      {showingArchive ? (
        <section className="task-list" aria-label="已完成任务">
          {archivedTasks.length === 0 ? (
            <p className="archive-empty">暂无已完成任务</p>
          ) : (
            archivedTasks.map((task) => (
              <div key={task.id} className="archive-row">
                <div>
                  <span className="archive-title">{task.title}</span>
                  <span className="archive-time">
                    完成于 {new Date(task.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="archive-actions">
                  <button type="button" className="archive-restore" onClick={() => handleRestoreTask(task.id)}>
                    恢复
                  </button>
                  <button type="button" className="archive-delete" onClick={() => handleDeleteTask(task.id)}>
                    删除
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      ) : (
        <section className="task-list" aria-label="活跃任务">
          {sortedTasks.map((task) => (
            <div key={task.id} style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
              <TaskCard
                task={task}
                compact={collapsed}
                completing={completingTaskId === task.id}
                isOpen={openTaskId === task.id}
                onOpenDetails={setOpenTaskId}
                onProgressCommit={handleProgressCommit}
                settings={settings}
              />
              {!collapsed && openTaskId === task.id ? (
                <TaskDetails
                  task={task}
                  settings={settings}
                  onClose={() => setOpenTaskId(null)}
                  onUpdateTask={handleUpdateTask}
                  onChangeFlags={changeFlags}
                  onComplete={setCompletingTaskId}
                  onBindFolder={handleBindFolder}
                  onSetDeadline={handleSetDeadline}
                />
              ) : null}
            </div>
          ))}
        </section>
      )}
      {showSyncSettings ? (
        <SyncSettings onClose={() => setShowSyncSettings(false)} />
      ) : null}
      <SettingsDrawer
        open={settingsOpen}
        settings={settings}
        onUpdate={updateSettings}
        onRestore={restoreDefaults}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}
