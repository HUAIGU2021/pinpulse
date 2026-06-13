const eventTypes = new Set([
  "step_added",
  "step_updated",
  "step_completed",
  "step_uncompleted",
  "progress_updated",
  "state_changed",
  "deadline_updated",
  "note_added",
]);

export type ProgressEvent = {
  type: string;
  text?: string;
  progress?: number;
  state?: string;
  message?: string;
  source?: string;
  ts?: string;
};

export function isProgressEvent(value: unknown): value is ProgressEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as ProgressEvent;
  if (!eventTypes.has(event.type)) return false;
  if (event.type === "progress_updated") {
    return typeof event.progress === "number" && event.progress >= 0 && event.progress <= 100;
  }
  return true;
}
