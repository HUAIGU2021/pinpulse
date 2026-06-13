import { invoke } from "@tauri-apps/api/core";

export function invokeCommand<T>(command: string, args?: unknown): Promise<T> {
  return invoke<T>(command, args as Record<string, unknown> | undefined);
}
