export type AgentKind = "claude" | "codex" | "unknown";
export type AgentRunState = "unknown" | "running" | "needs_input" | "error" | "idle" | "completed" | "stale";
export type AgentLightColor = "red" | "yellow" | "green" | "gray";

export type AgentStatusSnapshot = {
  protocolVersion: 1;
  taskId?: string;
  agent: AgentKind;
  sessionId?: string;
  state: AgentRunState;
  message?: string;
  lastEvent?: string;
  lastSeenAt: string;
  source?: string;
  cwd?: string;
};

const validAgents = new Set<AgentKind>(["claude", "codex", "unknown"]);
const validStates = new Set<AgentRunState>(["unknown", "running", "needs_input", "error", "idle", "completed", "stale"]);

export function parseAgentStatusSnapshot(value: unknown): AgentStatusSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  if (candidate.protocolVersion !== 1) return undefined;
  if (typeof candidate.agent !== "string" || !validAgents.has(candidate.agent as AgentKind)) return undefined;
  if (typeof candidate.state !== "string" || !validStates.has(candidate.state as AgentRunState)) return undefined;
  if (typeof candidate.lastSeenAt !== "string" || Number.isNaN(Date.parse(candidate.lastSeenAt))) return undefined;

  return {
    protocolVersion: 1,
    taskId: typeof candidate.taskId === "string" ? candidate.taskId : undefined,
    agent: candidate.agent as AgentKind,
    sessionId: typeof candidate.sessionId === "string" ? candidate.sessionId : undefined,
    state: candidate.state as AgentRunState,
    message: typeof candidate.message === "string" ? candidate.message : undefined,
    lastEvent: typeof candidate.lastEvent === "string" ? candidate.lastEvent : undefined,
    lastSeenAt: candidate.lastSeenAt,
    source: typeof candidate.source === "string" ? candidate.source : undefined,
    cwd: typeof candidate.cwd === "string" ? candidate.cwd : undefined,
  };
}

export function applyAgentStatusTimeout(status: AgentStatusSnapshot, nowMs = Date.now(), timeoutMs = 120_000): AgentStatusSnapshot {
  const seenAt = Date.parse(status.lastSeenAt);
  if (!Number.isFinite(seenAt)) return { ...status, state: "error", message: status.message ?? "Agent status timestamp is invalid" };
  if (seenAt - nowMs > 300_000) return { ...status, state: "error", message: status.message ?? "Agent status timestamp is in the future" };
  if (status.state !== "running") return status;
  if (nowMs - seenAt > timeoutMs) {
    return { ...status, state: "stale", message: status.message ?? "Agent status heartbeat timed out" };
  }
  return status;
}

export function agentStatusColor(status?: Pick<AgentStatusSnapshot, "state">): AgentLightColor {
  if (!status || status.state === "unknown") return "gray";
  if (status.state === "running") return "green";
  if (status.state === "needs_input" || status.state === "error") return "yellow";
  return "red";
}

export function mergeAgentStatuses(statuses: AgentStatusSnapshot[], nowMs = Date.now(), timeoutMs = 120_000): AgentStatusSnapshot {
  const normalized = statuses.map((status) => applyAgentStatusTimeout(status, nowMs, timeoutMs));
  const [selected] = [...normalized].sort((left, right) => statusScore(right) - statusScore(left) || Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt));

  return selected ?? {
    protocolVersion: 1,
    agent: "unknown",
    state: "unknown",
    lastSeenAt: new Date(nowMs).toISOString(),
    source: "pinpulse",
  };
}

function statusScore(status: AgentStatusSnapshot): number {
  if (status.state === "needs_input" || status.state === "error") return 4;
  if (status.state === "running") return 3;
  if (status.state === "completed" || status.state === "idle" || status.state === "stale") return 2;
  return 1;
}
