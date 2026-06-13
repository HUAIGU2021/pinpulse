import { useCallback, useEffect, useRef, useState } from "react";
import {
  applySettingsToDOM,
  DEFAULT_SETTINGS,
  mergeSettings,
  type PinPulseSettings,
} from "../domain/settings";

const STORAGE_KEY = "pinpulse-settings";

function loadFromStorage(): Partial<PinPulseSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Partial<PinPulseSettings>;
  } catch {
    return {};
  }
}

function saveToStorage(settings: PinPulseSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* storage full or unavailable */ }
}

export function useSettings() {
  const [settings, setSettings] = useState<PinPulseSettings>(() =>
    mergeSettings(loadFromStorage()),
  );
  const initialized = useRef(false);

  useEffect(() => {
    applySettingsToDOM(settings);
    if (initialized.current) {
      saveToStorage(settings);
    } else {
      initialized.current = true;
    }
  }, [settings]);

  const update = useCallback((patch: Partial<PinPulseSettings>) => {
    setSettings((prev) => mergeSettings({ ...prev, ...patch }));
  }, []);

  const restoreDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }, []);

  return { settings, update, restoreDefaults };
}
