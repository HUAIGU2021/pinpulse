import { beforeEach, describe, expect, it, vi } from "vitest";
import { bindFolder, createTask, deleteTask, listTasks, refreshBoundFolder, updateTask } from "./taskRepository";

const invokeMock = vi.fn();

vi.mock("./tauriApi", () => ({
  invokeCommand: (command: string, args?: unknown) => invokeMock(command, args),
}));

describe("taskRepository", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("lists tasks through Tauri", async () => {
    invokeMock.mockResolvedValueOnce([{ id: "task-1", title: "A" }]);
    await expect(listTasks()).resolves.toEqual([{ id: "task-1", title: "A" }]);
    expect(invokeMock).toHaveBeenCalledWith("list_tasks", undefined);
  });

  it("creates a task through Tauri", async () => {
    invokeMock.mockResolvedValueOnce({ id: "task-1" });
    await createTask({ title: "A", flags: 3 });
    expect(invokeMock).toHaveBeenCalledWith("create_task", { input: { title: "A", flags: 3 } });
  });

  it("refreshes a bound folder through Tauri", async () => {
    invokeMock.mockResolvedValueOnce({ events: [], markdownProgress: { completed: 0, total: 0, progress: 0 } });
    await refreshBoundFolder("/project");
    expect(invokeMock).toHaveBeenCalledWith("refresh_bound_folder", { folder: "/project" });
  });

  it("binds a folder through Tauri", async () => {
    invokeMock.mockResolvedValueOnce(undefined);
    await bindFolder({ taskId: "task-1", title: "Test", folder: "/project" });
    expect(invokeMock).toHaveBeenCalledWith("bind_folder", {
      input: { taskId: "task-1", title: "Test", folder: "/project" },
    });
  });

  it("updates a task through Tauri", async () => {
    invokeMock.mockResolvedValueOnce(undefined);
    await updateTask("task-1", { title: "Updated" });
    expect(invokeMock).toHaveBeenCalledWith("update_task", { id: "task-1", patch: { title: "Updated" } });
  });

  it("deletes a task through Tauri", async () => {
    invokeMock.mockResolvedValueOnce(undefined);
    await deleteTask("task-1");
    expect(invokeMock).toHaveBeenCalledWith("delete_task", { id: "task-1" });
  });
});
