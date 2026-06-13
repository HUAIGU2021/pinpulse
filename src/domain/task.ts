import type { AgentStatusSnapshot } from "./agentStatus";
import type { PinPulseSettings } from "./settings";

export type ConnectionState = "unbound" | "healthy" | "warning";

export type DeadlineState = "none" | "normal" | "approaching" | "due_soon" | "overdue";

export type ProgressStep = {
  id: string;
  text: string;
  completed: boolean;
  updatedAt: string;
};

export type PinPulseTask = {
  id: string;
  title: string;
  flags: number;
  progress: number;
  automaticProgress: number;
  manualOverride: boolean;
  deadline?: string;
  deadlineState?: DeadlineState;
  notes?: string;
  boundFolder?: string;
  connection: ConnectionState;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  steps: ProgressStep[];
  // Runtime-only status read from bound folders; local DB tasks do not persist this.
  agentStatus?: AgentStatusSnapshot;
  agentStatusHistory?: AgentStatusSnapshot[];
};

export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function clampFlags(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(10, Math.round(value)));
}

export function visibleProgress(task: PinPulseTask): number {
  return clampProgress(task.manualOverride ? task.progress : task.automaticProgress);
}

export function applyProgressEvents(task: PinPulseTask, events: { type: string; text?: string; progress?: number }[]): PinPulseTask {
  let steps = task.steps;
  let autoProgress = task.automaticProgress;

  for (const event of events) {
    if (event.type === "step_added" && event.text) {
      const exists = steps.some((s) => s.text === event.text);
      if (!exists) {
        steps = [...steps, { id: `step_${Date.now()}_${steps.length}`, text: event.text, completed: false, updatedAt: new Date().toISOString() }];
      }
    }
    if ((event.type === "step_completed") && event.text) {
      steps = steps.map((s) => (s.text === event.text ? { ...s, completed: true, updatedAt: new Date().toISOString() } : s));
    }
    if (event.type === "progress_updated" && typeof event.progress === "number") {
      autoProgress = clampProgress(event.progress);
    }
  }

  const completedCount = steps.filter((s) => s.completed).length;
  if (steps.length > 0) {
    autoProgress = clampProgress(Math.round((completedCount / steps.length) * 100));
  }

  return { ...task, steps, automaticProgress: autoProgress };
}

export function applyMarkdownProgress(task: PinPulseTask, mdProgress: { completed: number; total: number; progress: number }): PinPulseTask {
  if (mdProgress.total > 0) {
    return { ...task, automaticProgress: clampProgress(mdProgress.progress) };
  }
  return task;
}

export function sortTasks(tasks: PinPulseTask[], settings?: Pick<PinPulseSettings, "deadlineUrgentHours" | "deadlineApproachingHours">): PinPulseTask[] {
  const isUrgent = (t: PinPulseTask) => {
    const s = computeDeadlineState(t.deadline, settings);
    return s === "due_soon" || s === "overdue";
  };

  return [...tasks]
    .filter((task) => !task.archived)
    .sort((left, right) => {
      const lu = isUrgent(left);
      const ru = isUrgent(right);
      if (lu && !ru) return -1;
      if (!lu && ru) return 1;
      if (lu && ru) {
        const dl = Date.parse(left.deadline!);
        const dr = Date.parse(right.deadline!);
        return dl - dr;
      }
      if (right.flags !== left.flags) return right.flags - left.flags;
      return Date.parse(left.createdAt) - Date.parse(right.createdAt);
    });
}

export function computeDeadlineState(deadline?: string, settings?: Pick<PinPulseSettings, "deadlineUrgentHours" | "deadlineApproachingHours">): DeadlineState {
  if (!deadline) return "none";
  const diff = Date.parse(deadline) - Date.now();
  if (!Number.isFinite(diff)) return "none";
  if (diff <= 0) return "overdue";
  const hours = diff / (1000 * 60 * 60);
  const urgentH = settings?.deadlineUrgentHours ?? 24;
  const approachingH = settings?.deadlineApproachingHours ?? 48;
  if (hours <= urgentH) return "due_soon";
  if (hours <= approachingH) return "approaching";
  return "normal";
}

export function deadlineCountdown(deadline?: string, compact?: boolean): string | null {
  if (!deadline) return null;
  const diff = Date.parse(deadline) - Date.now();
  if (!Number.isFinite(diff)) return null;
  if (diff <= 0) return compact ? "逾期" : "已逾期";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (compact) {
    if (days >= 1) return `${days}d`;
    return `${hours}h`;
  }
  if (days >= 1) return `剩余${days}天`;
  return `剩余${hours}小时`;
}
