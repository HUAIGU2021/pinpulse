export type AnimationSpeed = "fast" | "normal" | "slow";
export type ThemePreset = "light" | "dark" | "warm";

export type PinPulseSettings = {
  progressRefreshIntervalMs: number;
  autoCompleteDelayMs: number;
  agentHeartbeatTimeoutMs: number;
  agentStaleTimeoutMs: number;
  deadlineUrgentHours: number;
  deadlineApproachingHours: number;
  compactWidth: number;
  compactMaxCards: number;
  completionAnimationMs: number;
  agentHistoryCount: number;
  animationSpeed: AnimationSpeed;
  theme: ThemePreset;
};

export const DEFAULT_SETTINGS: PinPulseSettings = {
  progressRefreshIntervalMs: 30_000,
  autoCompleteDelayMs: 1_000,
  agentHeartbeatTimeoutMs: 120_000,
  agentStaleTimeoutMs: 1_800_000,
  deadlineUrgentHours: 24,
  deadlineApproachingHours: 48,
  compactWidth: 175,
  compactMaxCards: 5,
  completionAnimationMs: 700,
  agentHistoryCount: 3,
  animationSpeed: "normal",
  theme: "light",
};

type CssVarMap = Record<string, string>;

export const themePresets: Record<ThemePreset, CssVarMap> = {
  light: {
    "--bg-app": "#f6f5f0",
    "--surface": "#ffffff",
    "--surface-raised": "#fffefa",
    "--surface-muted": "#eeebe2",
    "--text-main": "#1f2933",
    "--text-muted": "#667085",
    "--text-soft": "#8a8f98",
    "--border-soft": "#ddd8cc",
    "--border-strong": "#cfc8ba",
    "--brand": "#2f7d6d",
    "--brand-light": "#7bbf91",
    "--brand-soft": "#dff7f0",
    "--success": "#16a34a",
    "--warning": "#f59e0b",
    "--danger": "#ef4444",
  },
  dark: {
    "--bg-app": "#0f172a",
    "--surface": "#1e293b",
    "--surface-raised": "#1e293b",
    "--surface-muted": "#334155",
    "--text-main": "#f1f5f9",
    "--text-muted": "#94a3b8",
    "--text-soft": "#64748b",
    "--border-soft": "#334155",
    "--border-strong": "#475569",
    "--brand": "#4ade80",
    "--brand-light": "#86efac",
    "--brand-soft": "#052e16",
    "--success": "#22c55e",
    "--warning": "#fbbf24",
    "--danger": "#ef4444",
  },
  warm: {
    "--bg-app": "#fef7ed",
    "--surface": "#ffffff",
    "--surface-raised": "#fffbf5",
    "--surface-muted": "#fde8d0",
    "--text-main": "#431407",
    "--text-muted": "#9a3412",
    "--text-soft": "#b45309",
    "--border-soft": "#fcd9b8",
    "--border-strong": "#f5a623",
    "--brand": "#ea580c",
    "--brand-light": "#f59e0b",
    "--brand-soft": "#fef3c7",
    "--success": "#16a34a",
    "--warning": "#f59e0b",
    "--danger": "#dc2626",
  },
};

const ANIMATION_SPEEDS: Record<AnimationSpeed, CssVarMap> = {
  fast: { "--motion-fast": "80ms", "--motion-medium": "150ms", "--motion-complete": "400ms" },
  normal: { "--motion-fast": "140ms", "--motion-medium": "260ms", "--motion-complete": "760ms" },
  slow: { "--motion-fast": "240ms", "--motion-medium": "420ms", "--motion-complete": "1200ms" },
};

const VALID_ANIMATION_SPEEDS: Set<string> = new Set(["fast", "normal", "slow"]);
const VALID_THEMES: Set<string> = new Set(["light", "dark", "warm"]);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function mergeSettings(partial: Partial<PinPulseSettings>): PinPulseSettings {
  const merged = { ...DEFAULT_SETTINGS, ...partial };

  merged.compactWidth = clamp(merged.compactWidth, 140, 240);
  merged.compactMaxCards = clamp(merged.compactMaxCards, 3, 10);
  merged.agentHistoryCount = clamp(merged.agentHistoryCount, 1, 10);
  merged.deadlineUrgentHours = clamp(merged.deadlineUrgentHours, 1, 72);
  merged.deadlineApproachingHours = clamp(merged.deadlineApproachingHours, 2, 168);

  if (partial.deadlineUrgentHours !== undefined && merged.deadlineUrgentHours >= merged.deadlineApproachingHours) {
    merged.deadlineApproachingHours = merged.deadlineUrgentHours;
    merged.deadlineApproachingHours = clamp(merged.deadlineApproachingHours, 2, 168);
  }

  if (!VALID_ANIMATION_SPEEDS.has(merged.animationSpeed)) {
    merged.animationSpeed = DEFAULT_SETTINGS.animationSpeed;
  }

  if (!VALID_THEMES.has(merged.theme)) {
    merged.theme = DEFAULT_SETTINGS.theme;
  }

  return merged;
}

export function applySettingsToDOM(settings: PinPulseSettings): void {
  const root = document.documentElement;

  const themeVars = themePresets[settings.theme];
  for (const [key, value] of Object.entries(themeVars)) {
    root.style.setProperty(key, value);
  }

  const motionVars = ANIMATION_SPEEDS[settings.animationSpeed];
  for (const [key, value] of Object.entries(motionVars)) {
    root.style.setProperty(key, value);
  }

  root.style.setProperty("--compact-width", `${settings.compactWidth}px`);
  root.style.setProperty("--compact-max-cards", String(settings.compactMaxCards));
}
