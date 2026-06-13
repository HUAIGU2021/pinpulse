import { describe, expect, it } from "vitest";
import { isProgressEvent } from "./protocol";

describe("isProgressEvent", () => {
  it("accepts valid progress events", () => {
    expect(isProgressEvent({ type: "progress_updated", progress: 35, source: "codex", ts: "2026-06-12T00:00:00Z" })).toBe(true);
    expect(isProgressEvent({ type: "step_added", text: "Create shell", source: "claude", ts: "2026-06-12T00:00:00Z" })).toBe(true);
  });

  it("rejects invalid progress values and missing type", () => {
    expect(isProgressEvent({ type: "progress_updated", progress: 120 })).toBe(false);
    expect(isProgressEvent({ progress: 10 })).toBe(false);
  });
});
