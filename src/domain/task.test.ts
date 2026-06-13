import { describe, expect, it } from "vitest";
import { computeDeadlineState, deadlineCountdown, sortTasks, visibleProgress, type PinPulseTask } from "./task";

function task(overrides: Partial<PinPulseTask>): PinPulseTask {
  return {
    id: "task-1",
    title: "Task",
    flags: 0,
    progress: 0,
    automaticProgress: 0,
    manualOverride: false,
    connection: "unbound",
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
    archived: false,
    steps: [],
    ...overrides,
  };
}

describe("sortTasks", () => {
  it("sorts active tasks by flags descending then creation time ascending", () => {
    const tasks = [
      task({ id: "old-low", flags: 1, createdAt: "2026-06-10T00:00:00.000Z" }),
      task({ id: "new-high", flags: 8, createdAt: "2026-06-12T00:00:00.000Z" }),
      task({ id: "old-high", flags: 8, createdAt: "2026-06-11T00:00:00.000Z" }),
      task({ id: "archived", flags: 10, archived: true }),
    ];

    expect(sortTasks(tasks).map((item) => item.id)).toEqual(["old-high", "new-high", "old-low"]);
  });
});

describe("visibleProgress", () => {
  it("uses manual progress when manual override is active", () => {
    expect(visibleProgress(task({ progress: 72, automaticProgress: 20, manualOverride: true }))).toBe(72);
  });

  it("uses automatic progress when manual override is inactive", () => {
    expect(visibleProgress(task({ progress: 72, automaticProgress: 20, manualOverride: false }))).toBe(20);
  });
});

describe("deadlineCountdown", () => {
  it("returns null for missing deadline", () => {
    expect(deadlineCountdown(undefined)).toBeNull();
  });

  it("returns 已逾期 for past deadline", () => {
    const past = new Date(Date.now() - 3600000).toISOString();
    expect(deadlineCountdown(past)).toBe("已逾期");
  });

  it("returns remaining hours when less than 24h", () => {
    const soon = new Date(Date.now() + 5 * 3600000).toISOString();
    expect(deadlineCountdown(soon)).toBe("剩余5小时");
  });

  it("returns remaining days when more than 24h", () => {
    const later = new Date(Date.now() + 3 * 86400000 + 3600000).toISOString();
    expect(deadlineCountdown(later)).toBe("剩余3天");
  });
});

describe("computeDeadlineState", () => {
  it("returns none for undefined deadline", () => {
    expect(computeDeadlineState(undefined)).toBe("none");
  });

  it("returns overdue for past deadline", () => {
    const past = new Date(Date.now() - 3600000).toISOString();
    expect(computeDeadlineState(past)).toBe("overdue");
  });

  it("returns due_soon within 24 hours", () => {
    const soon = new Date(Date.now() + 12 * 3600000).toISOString();
    expect(computeDeadlineState(soon)).toBe("due_soon");
  });

  it("returns approaching within 48 hours", () => {
    const approaching = new Date(Date.now() + 36 * 3600000).toISOString();
    expect(computeDeadlineState(approaching)).toBe("approaching");
  });

  it("returns normal beyond 48 hours", () => {
    const far = new Date(Date.now() + 72 * 3600000).toISOString();
    expect(computeDeadlineState(far)).toBe("normal");
  });
});
