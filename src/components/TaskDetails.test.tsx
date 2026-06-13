import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PinPulseTask } from "../domain/task";
import { TaskDetails } from "./TaskDetails";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: () => Promise.resolve(null),
}));

const task: PinPulseTask = {
  id: "task-1",
  title: "开发桌面红绿灯提醒",
  flags: 7,
  progress: 20,
  automaticProgress: 40,
  manualOverride: false,
  deadline: "2026-06-20T08:00:00.000Z",
  deadlineState: "normal",
  boundFolder: "/projects/reminder",
  connection: "healthy",
  createdAt: "2026-06-12T00:00:00.000Z",
  updatedAt: "2026-06-12T00:00:00.000Z",
  archived: false,
  steps: [],
};

const noop = () => undefined;

describe("TaskDetails", () => {
  it("renders editable task details and action buttons", () => {
    render(
      <TaskDetails
        task={task}
        
        onClose={noop}
        onUpdateTask={noop}
        onChangeFlags={noop}
        onComplete={noop}
        onBindFolder={noop}
        onSetDeadline={noop}
      />,
    );

    expect(screen.getByDisplayValue("开发桌面红绿灯提醒")).toBeInTheDocument();
    expect(screen.getByText("项目路径：/projects/reminder")).toBeInTheDocument();
    expect(screen.getByText("绑定")).toBeInTheDocument();
    expect(screen.getByText("完成")).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <TaskDetails
        task={task}
        
        onClose={onClose}
        onUpdateTask={noop}
        onChangeFlags={noop}
        onComplete={noop}
        onBindFolder={noop}
        onSetDeadline={noop}
      />,
    );

    await user.click(screen.getByLabelText("关闭任务详情"));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows flag badge with flag emoji", () => {
    render(
      <TaskDetails
        task={task}
        
        onClose={noop}
        onUpdateTask={noop}
        onChangeFlags={noop}
        onComplete={noop}
        onBindFolder={noop}
        onSetDeadline={noop}
      />,
    );

    expect(screen.getByText("7 🚩")).toBeInTheDocument();
  });


  it("calls onChangeFlags with decremented value", async () => {
    const user = userEvent.setup();
    const onChangeFlags = vi.fn();
    render(
      <TaskDetails
        task={task}
        
        onClose={noop}
        onUpdateTask={noop}
        onChangeFlags={onChangeFlags}
        onComplete={noop}
        onBindFolder={noop}
        onSetDeadline={noop}
      />,
    );

    await user.click(screen.getByLabelText("降低优先级"));
    expect(onChangeFlags).toHaveBeenCalledWith("task-1", 6);
  });

  it("shows formatted deadline in header", () => {
    render(
      <TaskDetails
        task={task}
        
        onClose={noop}
        onUpdateTask={noop}
        onChangeFlags={noop}
        onComplete={noop}
        onBindFolder={noop}
        onSetDeadline={noop}
      />,
    );

    expect(screen.getByText(/截止时间：2026-06-20 \d{2}:\d{2}/)).toBeInTheDocument();
  });

  it("shows notes textarea", () => {
    render(
      <TaskDetails
        task={task}
        
        onClose={noop}
        onUpdateTask={noop}
        onChangeFlags={noop}
        onComplete={noop}
        onBindFolder={noop}
        onSetDeadline={noop}
      />,
    );

    expect(screen.getByPlaceholderText("添加备注...")).toBeInTheDocument();
  });

  it("shows only the latest three agent status events", () => {
    render(
      <TaskDetails
        task={{
          ...task,
          agentStatusHistory: [
            { protocolVersion: 1, agent: "claude", state: "running", lastEvent: "Oldest", lastSeenAt: "2026-06-13T08:18:00.000Z" },
            { protocolVersion: 1, agent: "claude", state: "running", lastEvent: "Second", lastSeenAt: "2026-06-13T08:19:00.000Z" },
            { protocolVersion: 1, agent: "claude", state: "needs_input", lastEvent: "Third", lastSeenAt: "2026-06-13T08:20:00.000Z" },
            { protocolVersion: 1, agent: "claude", state: "completed", lastEvent: "Latest", lastSeenAt: "2026-06-13T08:21:00.000Z" },
          ],
        }}
        
        onClose={noop}
        onUpdateTask={noop}
        onChangeFlags={noop}
        onComplete={noop}
        onBindFolder={noop}
        onSetDeadline={noop}
      />,
    );

    expect(screen.queryByText("Oldest")).not.toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByText("Third")).toBeInTheDocument();
    expect(screen.getByText("Latest")).toBeInTheDocument();
  });

  it("saves the selected deadline when Save is clicked", async () => {
    const user = userEvent.setup();
    const onSetDeadline = vi.fn();
    render(
      <TaskDetails
        task={{ ...task, deadline: undefined }}
        
        onClose={noop}
        onUpdateTask={noop}
        onChangeFlags={noop}
        onComplete={noop}
        onBindFolder={noop}
        onSetDeadline={onSetDeadline}
      />,
    );

    await user.click(screen.getByText("截止日期"));
    await user.type(screen.getByLabelText("选择截止日期"), "2026-06-13T23:59");
    await user.click(screen.getByText("保存"));

    expect(onSetDeadline).toHaveBeenCalledWith("task-1", expect.stringMatching(/^2026-06-13T/));
  });

  it("saves the selected deadline when Enter is pressed", async () => {
    const user = userEvent.setup();
    const onSetDeadline = vi.fn();
    render(
      <TaskDetails
        task={{ ...task, deadline: undefined }}
        
        onClose={noop}
        onUpdateTask={noop}
        onChangeFlags={noop}
        onComplete={noop}
        onBindFolder={noop}
        onSetDeadline={onSetDeadline}
      />,
    );

    await user.click(screen.getByText("截止日期"));
    await user.type(screen.getByLabelText("选择截止日期"), "2026-06-13T23:59{Enter}");

    expect(onSetDeadline).toHaveBeenCalledWith("task-1", expect.stringMatching(/^2026-06-13T/));
  });

  it("clears the deadline when Delete is clicked", async () => {
    const user = userEvent.setup();
    const onSetDeadline = vi.fn();
    render(
      <TaskDetails
        task={task}
        
        onClose={noop}
        onUpdateTask={noop}
        onChangeFlags={noop}
        onComplete={noop}
        onBindFolder={noop}
        onSetDeadline={onSetDeadline}
      />,
    );

    await user.click(screen.getByText("截止日期"));
    await user.click(screen.getByText("删除"));

    expect(onSetDeadline).toHaveBeenCalledWith("task-1", undefined);
  });

  it("shows recent agent status events", () => {
    render(
      <TaskDetails
        task={{
          ...task,
          agentStatusHistory: [
            { protocolVersion: 1, agent: "claude", state: "running", lastEvent: "UserPromptSubmit", lastSeenAt: "2026-06-13T08:19:00.000Z" },
            { protocolVersion: 1, agent: "claude", state: "completed", lastEvent: "Stop", lastSeenAt: "2026-06-13T08:21:00.000Z" },
          ],
        }}
        
        onClose={noop}
        onUpdateTask={noop}
        onChangeFlags={noop}
        onComplete={noop}
        onBindFolder={noop}
        onSetDeadline={noop}
      />,
    );

    expect(screen.getByText("Agent 状态")).toBeInTheDocument();
    expect(screen.getByText(/UserPromptSubmit/)).toBeInTheDocument();
    expect(screen.getByText(/Stop/)).toBeInTheDocument();
  });
});
