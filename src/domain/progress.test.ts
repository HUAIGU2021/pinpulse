import { describe, expect, it } from "vitest";
import type { PinPulseTask } from "./task";
import { applyProgressEvents, applyMarkdownProgress } from "./progress";

const baseTask: PinPulseTask = {
  id: "task-1",
  title: "Task",
  flags: 0,
  progress: 80,
  automaticProgress: 20,
  manualOverride: false,
  connection: "healthy",
  createdAt: "2026-06-12T00:00:00.000Z",
  updatedAt: "2026-06-12T00:00:00.000Z",
  archived: false,
  steps: [],
};

describe("applyProgressEvents", () => {
  it("updates automatic progress from progress events", () => {
    const result = applyProgressEvents(baseTask, [{ type: "progress_updated", progress: 45 }]);
    expect(result.automaticProgress).toBe(45);
  });

  it("adds and completes steps from events", () => {
    const result = applyProgressEvents(baseTask, [
      { type: "step_added", text: "Create shell", ts: "2026-06-12T00:00:00.000Z" },
      { type: "step_completed", text: "Create shell", ts: "2026-06-12T00:01:00.000Z" },
    ]);

    expect(result.steps).toEqual([{ id: "step-create-shell", text: "Create shell", completed: true, updatedAt: "2026-06-12T00:01:00.000Z" }]);
  });
});

describe("applyMarkdownProgress", () => {
  it("does not overwrite visible progress when manual override is active", () => {
    const result = applyMarkdownProgress({ ...baseTask, manualOverride: true, automaticProgress: 20 }, 75);
    expect(result.automaticProgress).toBe(75);
    expect(result.progress).toBe(80);
  });
});
