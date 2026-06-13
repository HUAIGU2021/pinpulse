import { invokeCommand } from "./tauriApi";

export type SyncSettings = {
  mode: "server" | "client";
  host: string;
  port: number;
};

const STORAGE_KEY = "pinpulse-sync-settings";

export function loadSyncSettings(): SyncSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SyncSettings;
  } catch { /* ignore */ }
  return { mode: "server", host: "", port: 54321 };
}

export function saveSyncSettings(settings: SyncSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function startSyncServer(port: number): Promise<void> {
  return invokeCommand<void>("start_sync_server", { port });
}

export function connectSyncClient(host: string, port: number): Promise<void> {
  return invokeCommand<void>("connect_sync_client", { host, port });
}
