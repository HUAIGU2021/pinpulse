import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { DEFAULT_SETTINGS } from "./domain/settings";
import type { BoundFolderRefresh } from "./services/taskRepository";

const repositoryMocks = vi.hoisted(() => ({
  listTasks: vi.fn(),
  bindFolder: vi.fn(),
  refreshBoundFolder: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  watchAgentStatus: vi.fn(),
}));

vi.mock("./services/taskRepository", () => ({
  listTasks: repositoryMocks.listTasks,
  bindFolder: repositoryMocks.bindFolder,
  refreshBoundFolder: repositoryMocks.refreshBoundFolder,
  updateTask: repositoryMocks.updateTask,
  deleteTask: repositoryMocks.deleteTask,
  watchAgentStatus: repositoryMocks.watchAgentStatus,
}));

vi.mock("./services/windowRepository", () => ({
  collapseToMini: () => Promise.resolve(),
  restoreFromMini: () => Promise.resolve(),
}));

vi.mock("./hooks/useSettings", () => ({
  useSettings: () => ({
    settings: DEFAULT_SETTINGS,
    update: vi.fn(),
    restoreDefaults: vi.fn(),
  }),
}));

const eventListeners: Map<string, (event: { folder: string; status: unknown }) => void> = new Map();

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((eventName: string, callback: (event: { folder: string; status: unknown }) => void) => {
    eventListeners.set(eventName, callback);
    return Promise.resolve(() => {
      eventListeners.delete(eventName);
    });
  }),
}));

const boundTask = {
  id: "task-bound",
  title: "绑定任务",
  flags: 4,
  progress: 0,
  automaticProgress: 0,
  manualOverride: false,
  boundFolder: "/projects/bound",
  connection: "healthy" as const,
  deadlineState: "none" as const,
  createdAt: "2026-06-12T00:00:00.000Z",
  updatedAt: "2026-06-12T00:00:00.000Z",
  archived: false,
  steps: [],
};

function refreshResult(state: "idle" | "running" | "completed"): BoundFolderRefresh {
  return {
    events: [],
    markdownProgress: { completed: 0, total: 0, progress: 0 },
    agentStatus: {
      current: { protocolVersion: 1, agent: "claude", state, lastSeenAt: new Date().toISOString() },
      history: [],
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  eventListeners.clear();
});

describe("App", () => {
  it("shows the PinPulse desktop shell title after loading", async () => {
    repositoryMocks.listTasks.mockResolvedValue([]);
    repositoryMocks.refreshBoundFolder.mockResolvedValue({ events: [], markdownProgress: { completed: 0, total: 0, progress: 0 } });
    repositoryMocks.updateTask.mockResolvedValue(undefined);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "PinPulse" })).toBeInTheDocument();
    });
  });

  it("starts file watchers and registers event listener for bound folders", async () => {
    vi.useFakeTimers();
    repositoryMocks.listTasks.mockResolvedValue([boundTask]);
    repositoryMocks.watchAgentStatus.mockResolvedValue(undefined);
    repositoryMocks.refreshBoundFolder.mockResolvedValue(refreshResult("idle"));
    repositoryMocks.updateTask.mockResolvedValue(undefined);

    render(<App />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(repositoryMocks.watchAgentStatus).toHaveBeenCalledWith(boundTask.boundFolder);
    expect(eventListeners.has("agent-status-changed")).toBe(true);
  });

  it("does not start another progress refresh while the previous refresh is still pending", async () => {
    vi.useFakeTimers();
    repositoryMocks.listTasks.mockResolvedValue([boundTask]);
    repositoryMocks.watchAgentStatus.mockResolvedValue(undefined);
    repositoryMocks.updateTask.mockResolvedValue(undefined);
    let resolveFirst: (value: BoundFolderRefresh) => void = () => undefined;
    repositoryMocks.refreshBoundFolder.mockImplementationOnce(
      () => new Promise<BoundFolderRefresh>((resolve) => {
        resolveFirst = resolve;
      }),
    );
    repositoryMocks.refreshBoundFolder.mockResolvedValue(refreshResult("completed"));

    render(<App />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(repositoryMocks.refreshBoundFolder).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(repositoryMocks.refreshBoundFolder).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst(refreshResult("running"));
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
    });

    expect(repositoryMocks.refreshBoundFolder).toHaveBeenCalledTimes(2);
  });
});
