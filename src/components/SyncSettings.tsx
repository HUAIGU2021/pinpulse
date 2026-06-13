import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  connectSyncClient,
  loadSyncSettings,
  saveSyncSettings,
  startSyncServer,
  type SyncSettings,
} from "../services/syncService";

export default function SyncSettings({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<SyncSettings>(loadSyncSettings);
  const [status, setStatus] = useState<string>("disconnected");
  const [draft, setDraft] = useState<SyncSettings>(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<string>("sync-connection-status", (event) => {
      setStatus(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  const handleSave = useCallback(() => {
    saveSyncSettings(draft);
    setSettings(draft);

    if (draft.mode === "server") {
      startSyncServer(draft.port);
    } else {
      connectSyncClient(draft.host, draft.port);
    }
    onClose();
  }, [draft, onClose]);

  const statusLabel =
    status === "connected" ? "● 已连接" : "○ 未连接 — 正在重试...";

  return (
    <div
      className="sync-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sync-panel" onClick={(e) => e.stopPropagation()}>
        <h2>同步设置</h2>

        <label className="sync-radio">
          <input
            type="radio"
            name="mode"
            value="server"
            checked={draft.mode === "server"}
            onChange={() => setDraft({ ...draft, mode: "server" })}
          />
          本机作为服务端 (Server)
        </label>

        <label className="sync-radio">
          <input
            type="radio"
            name="mode"
            value="client"
            checked={draft.mode === "client"}
            onChange={() => setDraft({ ...draft, mode: "client" })}
          />
          连接远端 (Client)
        </label>

        {draft.mode === "client" ? (
          <label className="sync-field">
            远端 IP:
            <input
              type="text"
              value={draft.host}
              onChange={(e) => setDraft({ ...draft, host: e.target.value })}
              placeholder="192.168.1.100"
            />
          </label>
        ) : null}

        <label className="sync-field">
          端口:
          <input
            type="number"
            value={draft.port}
            onChange={(e) =>
              setDraft({ ...draft, port: Number(e.target.value) || 54321 })
            }
          />
        </label>

        <p
          className={`sync-status sync-status--${status === "connected" ? "connected" : "disconnected"}`}
        >
          状态: {statusLabel}
        </p>

        <div className="sync-actions">
          <button type="button" onClick={handleSave}>
            保存
          </button>
          <button type="button" className="sync-cancel" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
