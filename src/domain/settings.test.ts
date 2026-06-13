import { describe, expect, it } from "vitest";
import {
  applySettingsToDOM,
  DEFAULT_SETTINGS,
  mergeSettings,
  themePresets,
  type ThemePreset,
} from "./settings";

describe("DEFAULT_SETTINGS", () => {
  it("has all keys defined with values matching current hardcoded constants", () => {
    expect(DEFAULT_SETTINGS.progressRefreshIntervalMs).toBe(30_000);
    expect(DEFAULT_SETTINGS.autoCompleteDelayMs).toBe(1_000);
    expect(DEFAULT_SETTINGS.agentHeartbeatTimeoutMs).toBe(120_000);
    expect(DEFAULT_SETTINGS.agentStaleTimeoutMs).toBe(1_800_000);
    expect(DEFAULT_SETTINGS.deadlineUrgentHours).toBe(24);
    expect(DEFAULT_SETTINGS.deadlineApproachingHours).toBe(48);
    expect(DEFAULT_SETTINGS.compactWidth).toBe(175);
    expect(DEFAULT_SETTINGS.compactMaxCards).toBe(5);
    expect(DEFAULT_SETTINGS.completionAnimationMs).toBe(700);
    expect(DEFAULT_SETTINGS.agentHistoryCount).toBe(3);
    expect(DEFAULT_SETTINGS.animationSpeed).toBe("normal");
    expect(DEFAULT_SETTINGS.theme).toBe("light");
  });
});

describe("mergeSettings", () => {
  it("returns defaults when partial is empty", () => {
    const result = mergeSettings({});
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it("overrides specified keys", () => {
    const result = mergeSettings({ compactWidth: 200 });
    expect(result.compactWidth).toBe(200);
    expect(result.progressRefreshIntervalMs).toBe(DEFAULT_SETTINGS.progressRefreshIntervalMs);
  });

  it("validates compactWidth range", () => {
    expect(mergeSettings({ compactWidth: 100 }).compactWidth).toBe(140);
    expect(mergeSettings({ compactWidth: 300 }).compactWidth).toBe(240);
  });

  it("validates compactMaxCards range", () => {
    expect(mergeSettings({ compactMaxCards: 1 }).compactMaxCards).toBe(3);
    expect(mergeSettings({ compactMaxCards: 20 }).compactMaxCards).toBe(10);
  });

  it("validates agentHistoryCount range", () => {
    expect(mergeSettings({ agentHistoryCount: 0 }).agentHistoryCount).toBe(1);
    expect(mergeSettings({ agentHistoryCount: 15 }).agentHistoryCount).toBe(10);
  });

  it("validates deadlineUrgentHours range", () => {
    expect(mergeSettings({ deadlineUrgentHours: 0 }).deadlineUrgentHours).toBe(1);
    expect(mergeSettings({ deadlineUrgentHours: 100 }).deadlineUrgentHours).toBe(72);
  });

  it("validates deadlineApproachingHours range", () => {
    expect(mergeSettings({ deadlineApproachingHours: 1 }).deadlineApproachingHours).toBe(2);
    expect(mergeSettings({ deadlineApproachingHours: 200 }).deadlineApproachingHours).toBe(168);
  });

  it("enforces urgent < approaching constraint by pushing approaching up when urgent exceeds it", () => {
    const result = mergeSettings({ deadlineUrgentHours: 60, deadlineApproachingHours: 48 });
    expect(result.deadlineUrgentHours).toBe(60);
    expect(result.deadlineApproachingHours).toBe(60);
  });

  it("falls back to default for invalid animationSpeed", () => {
    const result = mergeSettings({ animationSpeed: "invalid" as "fast" });
    expect(result.animationSpeed).toBe(DEFAULT_SETTINGS.animationSpeed);
  });

  it("falls back to default for invalid theme", () => {
    const result = mergeSettings({ theme: "nonexistent" as ThemePreset });
    expect(result.theme).toBe(DEFAULT_SETTINGS.theme);
  });
});

describe("themePresets", () => {
  it("has light, dark, and warm keys", () => {
    expect(themePresets).toHaveProperty("light");
    expect(themePresets).toHaveProperty("dark");
    expect(themePresets).toHaveProperty("warm");
  });

  it("light theme matches current :root CSS defaults", () => {
    const light = themePresets.light;
    expect(light["--bg-app"]).toBe("#f6f5f0");
    expect(light["--brand"]).toBe("#2f7d6d");
    expect(light["--success"]).toBe("#16a34a");
    expect(light["--warning"]).toBe("#f59e0b");
    expect(light["--danger"]).toBe("#ef4444");
    expect(light["--surface"]).toBe("#ffffff");
  });

  it("every preset has all 14 required CSS variable keys", () => {
    const keys = [
      "--bg-app", "--surface", "--surface-raised", "--surface-muted",
      "--text-main", "--text-muted", "--text-soft",
      "--border-soft", "--border-strong",
      "--brand", "--brand-light", "--brand-soft",
      "--success", "--warning", "--danger",
    ];
    for (const [name, preset] of Object.entries(themePresets)) {
      for (const key of keys) {
        expect(preset[key], `${name} missing ${key}`).toBeDefined();
        expect(preset[key], `${name}.${key} must be a hex string`).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });
});

describe("applySettingsToDOM", () => {
  it("sets all theme CSS variables on document.documentElement.style", () => {
    const settings = mergeSettings({ theme: "dark" });
    applySettingsToDOM(settings);

    const darkVars = themePresets.dark;
    for (const [key, value] of Object.entries(darkVars)) {
      expect(document.documentElement.style.getPropertyValue(key)).toBe(value);
    }
  });

  it("sets animation speed CSS variables", () => {
    applySettingsToDOM(mergeSettings({ animationSpeed: "fast" }));
    expect(document.documentElement.style.getPropertyValue("--motion-fast")).toBe("80ms");
    expect(document.documentElement.style.getPropertyValue("--motion-medium")).toBe("150ms");
    expect(document.documentElement.style.getPropertyValue("--motion-complete")).toBe("400ms");

    applySettingsToDOM(mergeSettings({ animationSpeed: "normal" }));
    expect(document.documentElement.style.getPropertyValue("--motion-fast")).toBe("140ms");
    expect(document.documentElement.style.getPropertyValue("--motion-medium")).toBe("260ms");
    expect(document.documentElement.style.getPropertyValue("--motion-complete")).toBe("760ms");

    applySettingsToDOM(mergeSettings({ animationSpeed: "slow" }));
    expect(document.documentElement.style.getPropertyValue("--motion-fast")).toBe("240ms");
    expect(document.documentElement.style.getPropertyValue("--motion-medium")).toBe("420ms");
    expect(document.documentElement.style.getPropertyValue("--motion-complete")).toBe("1200ms");
  });

  it("sets --compact-width and --compact-max-cards CSS variables", () => {
    applySettingsToDOM(mergeSettings({ compactWidth: 200, compactMaxCards: 7 }));
    expect(document.documentElement.style.getPropertyValue("--compact-width")).toBe("200px");
    expect(document.documentElement.style.getPropertyValue("--compact-max-cards")).toBe("7");
  });
});
