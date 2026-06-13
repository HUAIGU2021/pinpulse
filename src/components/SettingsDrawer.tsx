import { useEffect, useState } from "react";
import { type AnimationSpeed, type PinPulseSettings, type ThemePreset } from "../domain/settings";

type Tab = "behavior" | "deadline" | "appearance" | "theme";

type SettingsDrawerProps = {
  open: boolean;
  settings: PinPulseSettings;
  onUpdate: (patch: Partial<PinPulseSettings>) => void;
  onRestore: () => void;
  onClose: () => void;
};

const REFRESH_OPTIONS = [
  [10_000, "10 秒"],
  [30_000, "30 秒"],
  [60_000, "60 秒"],
  [120_000, "120 秒"],
] as const;

const DELAY_OPTIONS = [
  [500, "0.5 秒"],
  [1_000, "1.0 秒"],
  [2_000, "2.0 秒"],
  [3_000, "3.0 秒"],
] as const;

const HEARTBEAT_OPTIONS = [
  [60_000, "1 分钟"],
  [120_000, "2 分钟"],
  [300_000, "5 分钟"],
  [600_000, "10 分钟"],
] as const;

const STALE_OPTIONS = [
  [900_000, "15 分钟"],
  [1_800_000, "30 分钟"],
  [3_600_000, "60 分钟"],
] as const;

const ANIMATION_OPTIONS = [
  [300, "0.3 秒 (快速)"],
  [700, "0.7 秒 (默认)"],
  [1000, "1.0 秒 (舒缓)"],
  [1500, "1.5 秒 (慢速)"],
] as const;

const SPEED_OPTIONS: [AnimationSpeed, string][] = [
  ["fast", "快速"],
  ["normal", "适中 (默认)"],
  ["slow", "舒缓"],
];

const THEME_OPTIONS: { key: ThemePreset; label: string; desc: string; colors: string[] }[] = [
  { key: "light", label: "米白", desc: "温暖纸张感，护眼舒适", colors: ["#f6f5f0", "#2f7d6d", "#16a34a"] },
  { key: "dark", label: "暗色", desc: "深蓝底色 + 亮绿强调", colors: ["#0f172a", "#4ade80", "#22c55e"] },
  { key: "warm", label: "暖色", desc: "暖黄底色 + 橙色品牌色", colors: ["#fef7ed", "#ea580c", "#f59e0b"] },
];

function SelectControl({ label, value, onChange, options, hint }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  options: readonly (readonly [number, string])[];
  hint?: string;
}) {
  return (
    <div className="settings-field">
      <label className="settings-label">{label}</label>
      <select
        className="settings-select"
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {options.map(([val, text]) => (
          <option key={val} value={String(val)}>{text}</option>
        ))}
      </select>
      {hint ? <span className="settings-hint">{hint}</span> : null}
    </div>
  );
}

function SliderControl({ label, value, onChange, min, max, unit, hint }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  unit: string;
  hint?: string;
}) {
  return (
    <div className="settings-field">
      <label className="settings-label">
        {label}
        <span className="settings-value">{value}{unit}</span>
      </label>
      <input
        type="range"
        className="settings-slider"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="settings-range-labels">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
      {hint ? <span className="settings-hint">{hint}</span> : null}
    </div>
  );
}

export function SettingsDrawer({ open, settings, onUpdate, onRestore, onClose }: SettingsDrawerProps) {
  const [tab, setTab] = useState<Tab>("behavior");

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="settings-backdrop" onClick={onClose} />
      <aside className="settings-drawer" role="complementary" aria-label="设置面板">
        <div className="settings-drawer-header">
          <h2>设置</h2>
          <button type="button" className="settings-close" onClick={onClose} aria-label="关闭设置">
            ×
          </button>
        </div>

        <nav className="settings-tabs">
          {([
            ["behavior", "行为"],
            ["deadline", "截止"],
            ["appearance", "视觉"],
            ["theme", "主题"],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`settings-tab${tab === key ? " settings-tab--active" : ""}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="settings-body">
          {tab === "behavior" ? (
            <>
              <div className="settings-section">
                <p className="settings-section-title">定时任务</p>
                <SelectControl
                  label="进度刷新间隔"
                  value={settings.progressRefreshIntervalMs}
                  onChange={(v) => onUpdate({ progressRefreshIntervalMs: v })}
                  options={REFRESH_OPTIONS}
                  hint="后台轮询 Agent 进度的频率"
                />
                <SelectControl
                  label="自动归档延迟"
                  value={settings.autoCompleteDelayMs}
                  onChange={(v) => onUpdate({ autoCompleteDelayMs: v })}
                  options={DELAY_OPTIONS}
                  hint="进度达100%后延迟多久自动完成"
                />
              </div>
              <div className="settings-section">
                <p className="settings-section-title">Agent 检测</p>
                <SelectControl
                  label="Agent 心跳超时"
                  value={settings.agentHeartbeatTimeoutMs}
                  onChange={(v) => onUpdate({ agentHeartbeatTimeoutMs: v })}
                  options={HEARTBEAT_OPTIONS}
                />
                <SelectControl
                  label="Agent 陈旧标记"
                  value={settings.agentStaleTimeoutMs}
                  onChange={(v) => onUpdate({ agentStaleTimeoutMs: v })}
                  options={STALE_OPTIONS}
                  hint="多久无更新指示灯变暗"
                />
              </div>
            </>
          ) : tab === "deadline" ? (
            <>
              <div className="settings-section">
                <p className="settings-section-title">时间阈值</p>
                <SliderControl
                  label="紧急阈值"
                  value={settings.deadlineUrgentHours}
                  onChange={(v) => {
                    const approaching = Math.max(settings.deadlineApproachingHours, v);
                    onUpdate({ deadlineUrgentHours: v, deadlineApproachingHours: approaching });
                  }}
                  min={1}
                  max={72}
                  unit="h"
                  hint="剩余多少小时内标记为「即将到期」"
                />
                <SliderControl
                  label="临近阈值"
                  value={settings.deadlineApproachingHours}
                  onChange={(v) => onUpdate({ deadlineApproachingHours: v })}
                  min={2}
                  max={168}
                  unit="h"
                  hint="剩余多少小时内标记为「临近截止」"
                />
              </div>
              <div className="settings-section">
                <p className="settings-section-title">效果预览</p>
                <div className="settings-deadline-preview">
                  <span className="settings-deadline-band settings-deadline-band--urgent">
                    &lt;{settings.deadlineUrgentHours}h 紧急
                  </span>
                  <span className="settings-deadline-band settings-deadline-band--approaching">
                    {settings.deadlineUrgentHours}-{settings.deadlineApproachingHours}h 临近
                  </span>
                  <span className="settings-deadline-band settings-deadline-band--normal">
                    &gt;{settings.deadlineApproachingHours}h 正常
                  </span>
                </div>
              </div>
            </>
          ) : tab === "appearance" ? (
            <>
              <div className="settings-section">
                <p className="settings-section-title">紧凑模式</p>
                <SliderControl
                  label="紧凑模式宽度"
                  value={settings.compactWidth}
                  onChange={(v) => onUpdate({ compactWidth: v })}
                  min={140}
                  max={240}
                  unit="px"
                />
                <SliderControl
                  label="紧凑最大卡片数"
                  value={settings.compactMaxCards}
                  onChange={(v) => onUpdate({ compactMaxCards: v })}
                  min={3}
                  max={10}
                  unit=""
                />
              </div>
              <div className="settings-section">
                <p className="settings-section-title">动画与显示</p>
                <SelectControl
                  label="完成动画时长"
                  value={settings.completionAnimationMs}
                  onChange={(v) => onUpdate({ completionAnimationMs: v })}
                  options={ANIMATION_OPTIONS}
                />
                <div className="settings-field">
                  <label className="settings-label">动画速度</label>
                  <select
                    className="settings-select"
                    value={settings.animationSpeed}
                    onChange={(e) => onUpdate({ animationSpeed: e.target.value as AnimationSpeed })}
                  >
                    {SPEED_OPTIONS.map(([val, text]) => (
                      <option key={val} value={val}>{text}</option>
                    ))}
                  </select>
                  <span className="settings-hint">影响 hover、过渡、完成动画的速度</span>
                </div>
                <SliderControl
                  label="Agent 历史条数"
                  value={settings.agentHistoryCount}
                  onChange={(v) => onUpdate({ agentHistoryCount: v })}
                  min={1}
                  max={10}
                  unit=""
                />
              </div>
            </>
          ) : (
            <div className="settings-section">
              <p className="settings-section-title">配色方案</p>
              <div className="settings-theme-grid">
                {THEME_OPTIONS.map(({ key, label, desc, colors }) => (
                  <button
                    key={key}
                    type="button"
                    className={`settings-theme-card${settings.theme === key ? " settings-theme-card--active" : ""}`}
                    onClick={() => onUpdate({ theme: key })}
                  >
                    <div className="settings-theme-swatches">
                      {colors.map((c) => (
                        <span key={c} className="settings-theme-swatch" style={{ background: c }} />
                      ))}
                    </div>
                    <div className="settings-theme-info">
                      <strong>{label}</strong>
                      <span>{desc}</span>
                    </div>
                    {settings.theme === key ? <span className="settings-theme-check">✓</span> : null}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="settings-footer">
          <button type="button" className="settings-restore" onClick={onRestore}>
            恢复默认
          </button>
        </div>
      </aside>
    </>
  );
}
