import { describe, expect, it } from "vitest";
import {
  agentStatusColor,
  applyAgentStatusTimeout,
  mergeAgentStatuses,
  parseAgentStatusSnapshot,
  type AgentStatusSnapshot,
} from "./agentStatus";

const now = Date.parse("2026-06-13T08:20:00.000Z");

describe("agent status lights", () => {
  it("maps normalized states to light colors", () => {
    expect(agentStatusColor({ state: "running" })).toBe("green");
    expect(agentStatusColor({ state: "needs_input" })).toBe("yellow");
    expect(agentStatusColor({ state: "error" })).toBe("yellow");
    expect(agentStatusColor({ state: "completed" })).toBe("red");
    expect(agentStatusColor({ state: "idle" })).toBe("red");
    expect(agentStatusColor({ state: "stale" })).toBe("red");
    expect(agentStatusColor(undefined)).toBe("gray");
  });

  it("turns a stale running status red after the timeout", () => {
    const status: AgentStatusSnapshot = {
      protocolVersion: 1,
      agent: "claude",
      state: "running",
      lastSeenAt: "2026-06-13T08:17:30.000Z",
      source: "pinpulse-agent-status",
    };

    expect(applyAgentStatusTimeout(status, now, 120_000).state).toBe("stale");
  });

  it("keeps a recent running status green", () => {
    const status: AgentStatusSnapshot = {
      protocolVersion: 1,
      agent: "codex",
      state: "running",
      lastSeenAt: "2026-06-13T08:19:30.000Z",
      source: "pinpulse-agent-status",
    };

    expect(applyAgentStatusTimeout(status, now, 120_000).state).toBe("running");
  });

  it("marks timestamps more than five minutes in the future as errors", () => {
    const status: AgentStatusSnapshot = {
      protocolVersion: 1,
      agent: "claude",
      state: "running",
      lastSeenAt: "2026-06-13T08:26:00.000Z",
      source: "pinpulse-agent-status",
    };

    const checked = applyAgentStatusTimeout(status, now, 120_000);
    expect(checked.state).toBe("error");
    expect(agentStatusColor(checked)).toBe("yellow");
  });

  it("prioritizes yellow over green and red when merging multiple agents", () => {
    const statuses: AgentStatusSnapshot[] = [
      { protocolVersion: 1, agent: "claude", state: "completed", lastSeenAt: "2026-06-13T08:19:00.000Z", source: "pinpulse-agent-status" },
      { protocolVersion: 1, agent: "codex", state: "running", lastSeenAt: "2026-06-13T08:19:30.000Z", source: "pinpulse-agent-status" },
      { protocolVersion: 1, agent: "unknown", state: "needs_input", lastSeenAt: "2026-06-13T08:19:45.000Z", source: "pinpulse-agent-status" },
    ];

    expect(mergeAgentStatuses(statuses, now).state).toBe("needs_input");
  });

  it("parses valid snapshots and rejects unsupported versions", () => {
    expect(parseAgentStatusSnapshot({ protocolVersion: 1, agent: "claude", state: "running", lastSeenAt: "2026-06-13T08:20:00.000Z" })?.state).toBe("running");
    expect(parseAgentStatusSnapshot({ protocolVersion: 2, agent: "claude", state: "running", lastSeenAt: "2026-06-13T08:20:00.000Z" })).toBeUndefined();
  });
});
