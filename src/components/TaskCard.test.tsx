import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { PinPulseTask } from "../domain/task";
import { TaskCard } from "./TaskCard";

const task: PinPulseTask = {
  id: "task-1",
  title: "开发桌面红绿灯提醒",
  flags: 8,
  progress: 55,
  automaticProgress: 64,
  manualOverride: false,
  connection: "healthy",
  deadlineState: "normal",
  createdAt: "2026-06-12T00:00:00.000Z",
  updatedAt: "2026-06-12T00:00:00.000Z",
  archived: false,
  steps: [],
};

function noop() {
  return undefined;
}

describe("TaskCard", () => {
  it("shows title, progress bar, and agent lights", () => {
    render(<TaskCard task={task} onOpenDetails={noop} onProgressCommit={noop} />);

    expect(screen.getByText("开发桌面红绿灯提醒")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "64");
    expect(screen.queryByText("64%")).not.toBeInTheDocument();
    // connection icon should not be rendered
    expect(screen.queryByLabelText("文件夹绑定正常")).not.toBeInTheDocument();
  });

  it("reveals the percentage on progress hover", async () => {
    const user = userEvent.setup();
    render(<TaskCard task={task} onOpenDetails={noop} onProgressCommit={noop} />);

    await user.hover(screen.getByRole("progressbar"));
    expect(screen.getByText("64%")).toBeInTheDocument();
  });

  it("shows red countdown for overdue tasks", () => {
    const overdueTask = { ...task, deadline: new Date(Date.now() - 3600000).toISOString() };
    const { container } = render(<TaskCard task={overdueTask} onOpenDetails={noop} onProgressCommit={noop} />);

    expect(container.querySelector(".deadline-countdown--urgent")).toBeInTheDocument();
  });

  it("shows red countdown for due_soon tasks (within 24h)", () => {
    const dueSoonTask = { ...task, deadline: new Date(Date.now() + 12 * 3600000).toISOString() };
    const { container } = render(<TaskCard task={dueSoonTask} onOpenDetails={noop} onProgressCommit={noop} />);

    expect(container.querySelector(".deadline-countdown--urgent")).toBeInTheDocument();
  });

  it("shows orange countdown for approaching tasks (24-48h)", () => {
    const approachingTask = { ...task, deadline: new Date(Date.now() + 36 * 3600000).toISOString() };
    const { container } = render(<TaskCard task={approachingTask} onOpenDetails={noop} onProgressCommit={noop} />);

    expect(container.querySelector(".deadline-countdown--approaching")).toBeInTheDocument();
  });

  it("shows deadline countdown when deadline is set", () => {
    const futureDate = new Date(Date.now() + 5 * 86400000).toISOString();
    const taskWithDeadline = { ...task, deadline: futureDate };
    render(<TaskCard task={taskWithDeadline} onOpenDetails={noop} onProgressCommit={noop} />);

    expect(screen.getByText(/剩余\d天/)).toBeInTheDocument();
  });

  it("marks the card while its completion animation is running", () => {
    const { container } = render(<TaskCard task={task} completing onOpenDetails={noop} onProgressCommit={noop} />);

    expect(container.querySelector(".task-card--completing")).toBeInTheDocument();
  });

  it("shows a green agent light when the task agent is running", () => {
    render(
      <TaskCard
        task={{ ...task, agentStatus: { protocolVersion: 1, agent: "claude", state: "running", lastSeenAt: new Date().toISOString() } }}
        onOpenDetails={noop}
        onProgressCommit={noop}
      />,
    );

    expect(screen.getByLabelText(/Claude agent 正在运行/)).toBeInTheDocument();
  });

  it("shows a yellow agent light when the task needs input", () => {
    render(
      <TaskCard
        task={{ ...task, agentStatus: { protocolVersion: 1, agent: "codex", state: "needs_input", lastSeenAt: new Date().toISOString() } }}
        onOpenDetails={noop}
        onProgressCommit={noop}
      />,
    );

    expect(screen.getByLabelText(/Codex agent 需要关注/)).toBeInTheDocument();
  });

  it("shows a red agent light when the task agent is completed", () => {
    render(
      <TaskCard
        task={{ ...task, agentStatus: { protocolVersion: 1, agent: "claude", state: "completed", lastSeenAt: new Date().toISOString() } }}
        onOpenDetails={noop}
        onProgressCommit={noop}
      />,
    );

    expect(screen.getByLabelText(/Claude agent 已停止/)).toBeInTheDocument();
  });

  it("shows agent lights in compact mode", () => {
    render(
      <TaskCard
        task={{ ...task, agentStatus: { protocolVersion: 1, agent: "claude", state: "running", lastSeenAt: new Date().toISOString() } }}
        compact
        onOpenDetails={noop}
        onProgressCommit={noop}
      />,
    );

    expect(screen.getByLabelText(/Claude agent 正在运行/)).toBeInTheDocument();
  });
});
