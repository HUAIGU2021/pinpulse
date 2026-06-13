import { clampProgress, type PinPulseTask, type ProgressStep } from "./task";
import type { ProgressEvent } from "./protocol";

function stepId(text: string): string {
  return `step-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function upsertStep(steps: ProgressStep[], text: string, completed: boolean, updatedAt: string): ProgressStep[] {
  const id = stepId(text);
  const existing = steps.find((step) => step.id === id);
  if (!existing) {
    return [...steps, { id, text, completed, updatedAt }];
  }
  return steps.map((step) => (step.id === id ? { ...step, completed, updatedAt } : step));
}

export function applyProgressEvents(task: PinPulseTask, events: ProgressEvent[]): PinPulseTask {
  return events.reduce<PinPulseTask>((current, event) => {
    const updatedAt = event.ts ?? new Date().toISOString();
    if (event.type === "progress_updated" && typeof event.progress === "number") {
      return { ...current, automaticProgress: clampProgress(event.progress), updatedAt };
    }
    if (event.type === "step_added" && event.text) {
      return { ...current, steps: upsertStep(current.steps, event.text, false, updatedAt), updatedAt };
    }
    if (event.type === "step_completed" && event.text) {
      return { ...current, steps: upsertStep(current.steps, event.text, true, updatedAt), updatedAt };
    }
    if (event.type === "step_uncompleted" && event.text) {
      return { ...current, steps: upsertStep(current.steps, event.text, false, updatedAt), updatedAt };
    }
    if (event.type === "deadline_updated" && event.ts) {
      return { ...current, deadline: event.ts, updatedAt };
    }
    return { ...current, updatedAt };
  }, task);
}

export function applyMarkdownProgress(task: PinPulseTask, markdownProgress: number): PinPulseTask {
  return {
    ...task,
    automaticProgress: clampProgress(markdownProgress),
    updatedAt: new Date().toISOString(),
  };
}
