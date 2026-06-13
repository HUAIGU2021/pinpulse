import { useCallback, useEffect, useRef, useState } from "react";
import { agentStatusColor, type AgentLightColor, type AgentStatusSnapshot } from "../domain/agentStatus";
import type { PinPulseSettings } from "../domain/settings";
import { clampProgress, computeDeadlineState, deadlineCountdown, visibleProgress, type ConnectionState, type PinPulseTask } from "../domain/task";

function deadlineCountdownClass(deadline?: string, settings?: Pick<PinPulseSettings, "deadlineUrgentHours" | "deadlineApproachingHours">): string {
  const state = computeDeadlineState(deadline, settings);
  if (state === "overdue" || state === "due_soon") return "deadline-countdown--urgent";
  if (state === "approaching") return "deadline-countdown--approaching";
  return "";
}

type TaskCardProps = {
  task: PinPulseTask;
  compact?: boolean;
  completing?: boolean;
  isOpen?: boolean;
  onOpenDetails: (taskId: string) => void;
  onProgressCommit: (taskId: string, progress: number) => void;
  settings?: PinPulseSettings;
};

function agentName(agent?: AgentStatusSnapshot["agent"]): string {
  if (agent === "claude") return "Claude";
  if (agent === "codex") return "Codex";
  return "未知";
}

function agentStatusLabel(status?: AgentStatusSnapshot): string {
  if (!status || status.state === "unknown") return "未检测到 agent 状态桥接";
  const name = agentName(status.agent);
  if (status.state === "running") return `${name} agent 正在运行`;
  if (status.state === "needs_input" || status.state === "error") return `${name} agent 需要关注`;
  return `${name} agent 已停止`;
}

function isStale(status?: AgentStatusSnapshot, timeoutMs = 30 * 60 * 1000): boolean {
  if (!status?.lastSeenAt) return false;
  return Date.now() - Date.parse(status.lastSeenAt) > timeoutMs;
}

function AgentLights({ status, connection, staleTimeoutMs }: { status?: AgentStatusSnapshot; connection?: ConnectionState; staleTimeoutMs: number }) {
  const active: AgentLightColor = connection === "unbound" ? "gray" : agentStatusColor(status);
  const label = connection === "unbound" ? "未连接目录" : agentStatusLabel(status);
  const [settling, setSettling] = useState(false);
  const [stale, setStale] = useState(() => isStale(status, staleTimeoutMs));
  const prevActive = useRef(active);

  useEffect(() => {
    if (prevActive.current !== active) {
      prevActive.current = active;
      setSettling(true);
      const timer = setTimeout(() => setSettling(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [active]);

  useEffect(() => {
    setStale(isStale(status, staleTimeoutMs));
    if (!status?.lastSeenAt) return;
    const elapsed = Date.now() - Date.parse(status.lastSeenAt);
    const remaining = staleTimeoutMs - elapsed;
    if (remaining <= 0) return;
    const timer = setTimeout(() => setStale(true), remaining);
    return () => clearTimeout(timer);
  }, [status?.lastSeenAt, staleTimeoutMs]);

  return (
    <span
      className={`agent-light-bar agent-light-bar--${active}${settling ? " agent-light-bar--settling" : ""}${stale ? " agent-light-bar--stale" : ""}`}
      aria-label={label}
      title={label}
    />
  );
}

export function TaskCard({ task, compact, completing, isOpen, onOpenDetails, onProgressCommit, settings }: TaskCardProps) {
  const [showPercent, setShowPercent] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const dragProgressRef = useRef(0);
  const shellRef = useRef<HTMLDivElement>(null);
  const progress = visibleProgress(task);
  const countdown = deadlineCountdown(task.deadline, compact);
  const staleTimeoutMs = settings?.agentStaleTimeoutMs ?? 30 * 60 * 1000;

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const shell = shellRef.current;
    if (!shell) return;

    const rect = shell.getBoundingClientRect();
    const pct = clampProgress(Math.round(((event.clientX - rect.left) / rect.width) * 100));
    setDragProgress(pct);
    dragProgressRef.current = pct;
    setDragging(true);

    const handlePointerMove = (e: PointerEvent) => {
      const r = shell.getBoundingClientRect();
      const p = clampProgress(Math.round(((e.clientX - r.left) / r.width) * 100));
      setDragProgress(p);
      dragProgressRef.current = p;
    };

    const handlePointerUp = () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      setDragging(false);
      onProgressCommit(task.id, dragProgressRef.current);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  }, [task.id, onProgressCommit]);

  const displayProgress = dragging ? dragProgress : progress;

  return (
    <article
      className={`task-card${isOpen ? " task-card--open" : ""}${completing ? " task-card--completing" : ""}`}
      data-task-id={task.id}
      onClick={() => onOpenDetails(task.id)}
      onDoubleClick={(e) => { if (!compact) e.stopPropagation(); }}
      style={{ cursor: "pointer" }}
    >
      <div className="task-card-row">
        <span className="task-title-text">{task.title}</span>
        <div className="task-card-right">
          {countdown ? <span className={`deadline-countdown ${deadlineCountdownClass(task.deadline, settings)}`}>{countdown}</span> : null}
          <AgentLights status={task.agentStatus} connection={task.connection} staleTimeoutMs={staleTimeoutMs} />
        </div>
      </div>

      <div
        ref={shellRef}
        className="progress-shell"
        onPointerDown={handlePointerDown}
        onMouseEnter={() => setShowPercent(true)}
        onMouseLeave={() => setShowPercent(false)}
        style={{ touchAction: "none" }}
      >
        <span
          className="progress-fill"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={displayProgress}
          style={{ width: `${displayProgress}%` }}
        />
        {showPercent || dragging ? <span className="progress-percent">{displayProgress}%</span> : null}
      </div>
    </article>
  );
}
