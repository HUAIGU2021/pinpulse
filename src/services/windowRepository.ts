import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";

export const COMPACT_CSS_WIDTH = 175;

function toPhysicalPx(cssPx: number): number {
  return Math.round(cssPx * (window.devicePixelRatio || 1));
}

let savedBounds: { width: number; height: number; x: number; y: number } | null = null;

export function setAlwaysOnTop(enabled: boolean): Promise<void> {
  return getCurrentWindow().setAlwaysOnTop(enabled);
}

export async function collapseToMini(compactWidth?: number): Promise<void> {
  const win = getCurrentWindow();

  const size = await win.outerSize();
  const pos = await win.outerPosition();
  savedBounds = { width: size.width, height: size.height, x: pos.x, y: pos.y };

  const width = compactWidth ?? COMPACT_CSS_WIDTH;
  await win.setSize(new PhysicalSize(toPhysicalPx(width), toPhysicalPx(800)));
  await win.setDecorations(false);
  await win.setAlwaysOnTop(true);

  const monitor = await currentMonitor();
  if (monitor) {
    const x = monitor.position.x;
    const y = monitor.position.y;
    await win.setPosition(new PhysicalPosition(x, y));
  }
}

export async function restoreFromMini(): Promise<void> {
  const win = getCurrentWindow();

  await win.setDecorations(true);
  await win.setAlwaysOnTop(false);

  if (savedBounds) {
    await win.setSize(new PhysicalSize(savedBounds.width, savedBounds.height));
    await win.setPosition(new PhysicalPosition(savedBounds.x, savedBounds.y));
    savedBounds = null;
  } else {
    await win.setSize(new PhysicalSize(800, 600));
  }
}
