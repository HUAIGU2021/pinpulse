import { beforeEach, describe, expect, it, vi } from "vitest";
import { collapseToMini, setAlwaysOnTop } from "./windowRepository";

const setAlwaysOnTopMock = vi.fn();
const outerSizeMock = vi.fn();
const outerPositionMock = vi.fn();
const setSizeMock = vi.fn();
const setDecorationsMock = vi.fn();
const setPositionMock = vi.fn();

vi.mock("@tauri-apps/api/dpi", () => ({
  PhysicalPosition: class PhysicalPosition {
    constructor(public x: number, public y: number) {}
  },
  PhysicalSize: class PhysicalSize {
    constructor(public width: number, public height: number) {}
  },
}));

vi.mock("@tauri-apps/api/window", () => ({
  currentMonitor: () => Promise.resolve({ position: { x: 10, y: 20 } }),
  getCurrentWindow: () => ({
    outerSize: outerSizeMock,
    outerPosition: outerPositionMock,
    setAlwaysOnTop: setAlwaysOnTopMock,
    setDecorations: setDecorationsMock,
    setPosition: setPositionMock,
    setSize: setSizeMock,
  }),
}));

describe("windowRepository", () => {
  beforeEach(() => {
    setAlwaysOnTopMock.mockReset();
    outerSizeMock.mockReset().mockResolvedValue({ width: 800, height: 600 });
    outerPositionMock.mockReset().mockResolvedValue({ x: 40, y: 50 });
    setSizeMock.mockReset().mockResolvedValue(undefined);
    setDecorationsMock.mockReset().mockResolvedValue(undefined);
    setPositionMock.mockReset().mockResolvedValue(undefined);
  });

  it("delegates always-on-top changes to the current Tauri window", async () => {
    await setAlwaysOnTop(true);
    expect(setAlwaysOnTopMock).toHaveBeenCalledWith(true);
  });

  it("collapses to a 300px wide mini window", async () => {
    await collapseToMini();
    expect(setSizeMock).toHaveBeenCalledWith(expect.objectContaining({ width: 175 }));
    expect(setDecorationsMock).toHaveBeenCalledWith(false);
    expect(setAlwaysOnTopMock).toHaveBeenCalledWith(true);
    expect(setPositionMock).toHaveBeenCalledWith(expect.objectContaining({ x: 10, y: 20 }));
  });
});
