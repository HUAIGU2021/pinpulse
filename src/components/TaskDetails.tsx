import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { type PinPulseSettings } from "../domain/settings";
import { type PinPulseTask } from "../domain/task";
import { generateAgentHookConfig, type AgentHookConfig } from "../services/taskRepository";

function formatDeadline(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `截止时间：${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type TaskDetailsProps = {
  task: PinPulseTask;
  settings?: PinPulseSettings;
  onClose: () => void;
  onUpdateTask: (taskId: string, patch: Partial<PinPulseTask>) => void;
  onChangeFlags: (taskId: string, flags: number) => void;
  onComplete: (taskId: string) => void;
  onBindFolder: (taskId: string, folder: string) => void;
  onSetDeadline: (taskId: string, deadline: string | undefined) => void;
};

function toDatetimeLocalValue(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function deadlineInputToIso(value: string): string | undefined {
  if (!value) return undefined;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59` : value;
  const d = new Date(normalized);
  if (!Number.isFinite(d.getTime())) return undefined;
  return d.toISOString();
}

export function TaskDetails({ task, settings, onClose, onUpdateTask, onChangeFlags, onComplete, onBindFolder, onSetDeadline }: TaskDetailsProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState(() => toDatetimeLocalValue(task.deadline));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftNotes, setDraftNotes] = useState(task.notes || "");
  const [titleDirty, setTitleDirty] = useState(false);
  const [notesDirty, setNotesDirty] = useState(false);

  // Reset drafts when switching to a different task
  useEffect(() => {
    setDraftTitle(task.title);
    setDraftNotes(task.notes || "");
    setTitleDirty(false);
    setNotesDirty(false);
  }, [task.id]);

  // Sync external title updates when not locally dirty
  useEffect(() => {
    if (!titleDirty) {
      setDraftTitle(task.title);
    }
  }, [task.title]);

  // Sync external notes updates when not locally dirty
  useEffect(() => {
    if (!notesDirty) {
      setDraftNotes(task.notes || "");
    }
  }, [task.notes]);

  function handleDeadlineSave() {
    const iso = deadlineInputToIso(deadlineInput);
    if (iso) {
      onSetDeadline(task.id, iso);
    }
    setShowDatePicker(false);
  }

  function handleDeadlineDelete() {
    onSetDeadline(task.id, undefined);
    setDeadlineInput("");
    setShowDatePicker(false);
  }

  async function handleBindFolder() {
    const result = await open({ directory: true, multiple: false });
    if (result) {
      onBindFolder(task.id, String(result));
    }
  }

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  function confirmTitle() {
    onUpdateTask(task.id, { title: draftTitle });
    setTitleDirty(false);
  }

  function confirmNotes() {
    onUpdateTask(task.id, { notes: draftNotes });
    setNotesDirty(false);
  }

  function handleTitleChange(value: string) {
    setDraftTitle(value);
    setTitleDirty(value !== task.title);
  }

  function handleNotesChange(value: string) {
    setDraftNotes(value);
    setNotesDirty(value !== (task.notes || ""));
  }

  return (
    <aside className="task-details task-details--connected" aria-label="任务详情" onDoubleClick={(e) => e.stopPropagation()}>
      <div className="details-header">
        <input
          className="details-title-input"
          aria-label="任务标题"
          value={draftTitle}
          onChange={(event) => handleTitleChange(event.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && titleDirty) confirmTitle();
          }}
        />
        {titleDirty ? (
          <button type="button" className="details-confirm-btn" onClick={confirmTitle} aria-label="确认标题">
            确认
          </button>
        ) : null}
      </div>

      {task.deadline ? (
        <p className="details-deadline">{formatDeadline(task.deadline)}</p>
      ) : null}

      {task.boundFolder ? <p className="details-meta">项目路径：{task.boundFolder}</p> : null}

      <div className="details-actions">
        <button type="button" onClick={() => onChangeFlags(task.id, Math.max(0, task.flags - 1))} aria-label="降低优先级">
          -
        </button>
        <span className="flags-badge">{task.flags} 🚩</span>
        <button type="button" onClick={() => onChangeFlags(task.id, Math.min(10, task.flags + 1))} aria-label="提高优先级">
          +
        </button>
        <button type="button" onClick={handleBindFolder}>
          绑定
        </button>
        <button
          type="button"
          onClick={() => {
            setDeadlineInput(toDatetimeLocalValue(task.deadline));
            setShowDatePicker(!showDatePicker);
          }}
        >
          截止日期
        </button>
        <button type="button" className="complete-action" onClick={() => onComplete(task.id)}>
          完成
        </button>
        <div className="details-actions-right">
          <button type="button" onClick={onClose} aria-label="关闭任务详情">
            关闭
          </button>
        </div>
      </div>

      {showDatePicker ? (
        <div className="inline-picker">
          <input
            type="datetime-local"
            aria-label="选择截止日期"
            value={deadlineInput}
            onChange={(e) => setDeadlineInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleDeadlineSave();
            }}
            autoFocus
          />
          <button type="button" onClick={handleDeadlineSave}>保存</button>
          <button type="button" className="inline-picker-delete" onClick={handleDeadlineDelete}>删除</button>
        </div>
      ) : null}

      <div className="notes-row">
        <h2 className="notes-label">备注</h2>
        <textarea
          ref={textareaRef}
          className="notes-input"
          aria-label="任务备注"
          value={draftNotes}
          onChange={(event) => {
            handleNotesChange(event.target.value);
            if (textareaRef.current) autoGrow(textareaRef.current);
          }}
          placeholder="添加备注..."
          rows={1}
        />
        {notesDirty ? (
          <button type="button" className="details-confirm-btn" onClick={confirmNotes} aria-label="确认备注">
            确认
          </button>
        ) : null}
      </div>

      {task.agentStatusHistory && task.agentStatusHistory.length > 0 ? (
        <section className="agent-status-section">
          <h2 className="notes-label">Agent 状态</h2>
          <ol className="agent-status-history">
            {task.agentStatusHistory.slice(-(settings?.agentHistoryCount ?? 3)).map((event) => (
              <li key={`${event.agent}-${event.lastSeenAt}-${event.lastEvent ?? event.state}`}>
                <span>{event.agent}</span>
                <span>{event.lastEvent ?? event.state}</span>
                <time dateTime={event.lastSeenAt}>{new Date(event.lastSeenAt).toLocaleTimeString()}</time>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {task.boundFolder ? <HookConfigPanel folder={task.boundFolder} /> : null}
    </aside>
  );
}

function HookConfigPanel({ folder }: { folder: string }) {
  const [agent, setAgent] = useState<"claude" | "codex" | "codex-notify">("claude");
  const [config, setConfig] = useState<AgentHookConfig | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  async function loadConfig() {
    const result = await generateAgentHookConfig({ folder, agent });
    setConfig(result);
    setShowPanel(true);
  }

  async function handleCopy() {
    if (!config) return;
    await navigator.clipboard.writeText(config.configJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!showPanel) {
    return (
      <section className="hook-config-section">
        <button type="button" className="hook-config-toggle" onClick={loadConfig}>
          安装 Agent 状态桥接
        </button>
      </section>
    );
  }

  return (
    <section className="hook-config-section">
      <div className="hook-config-header">
        <h2 className="notes-label">安装状态桥接</h2>
        <button type="button" className="hook-config-close" onClick={() => setShowPanel(false)} aria-label="关闭">
          ×
        </button>
      </div>
      <div className="hook-config-agent-toggle">
        <button
          type="button"
          className={agent === "claude" ? "active" : ""}
          onClick={() => { setAgent("claude"); loadConfig(); }}
        >
          Claude Code
        </button>
        <button
          type="button"
          className={agent === "codex" ? "active" : ""}
          onClick={() => { setAgent("codex"); loadConfig(); }}
        >
          Codex
        </button>
        <button
          type="button"
          className={agent === "codex-notify" ? "active" : ""}
          onClick={() => { setAgent("codex-notify"); loadConfig(); }}
        >
          Codex Notify
        </button>
      </div>
      {config ? (
        <>
          <p className="hook-config-path">
            保存到 <code>{config.targetPath}</code>
          </p>
          <pre className="hook-config-pre">{config.configJson}</pre>
          <button type="button" className="hook-config-copy" onClick={handleCopy}>
            {copied ? "已复制" : "复制配置"}
          </button>
        </>
      ) : null}
    </section>
  );
}
