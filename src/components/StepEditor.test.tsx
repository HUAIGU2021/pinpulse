import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StepEditor } from "./StepEditor";

const steps = [
  { id: "step-1", text: "创建窗口", completed: false, updatedAt: "2026-06-12T00:00:00.000Z" },
  { id: "step-2", text: "实现置顶", completed: true, updatedAt: "2026-06-12T00:00:00.000Z" },
];

describe("StepEditor", () => {
  it("renders all steps", () => {
    render(<StepEditor steps={steps} onChange={() => undefined} />);

    expect(screen.getByDisplayValue("创建窗口")).toBeInTheDocument();
    expect(screen.getByDisplayValue("实现置顶")).toBeInTheDocument();
  });

  it("calls onChange when step text is edited", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StepEditor steps={steps} onChange={onChange} />);

    const input = screen.getByDisplayValue("创建窗口");
    await user.clear(input);
    await user.type(input, "新步骤");

    expect(onChange).toHaveBeenCalled();
  });

  it("calls onChange when a step is deleted", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StepEditor steps={steps} onChange={onChange} />);

    const deleteButtons = screen.getAllByLabelText("删除步骤");
    await user.click(deleteButtons[0]);

    expect(onChange).toHaveBeenCalledWith(steps.slice(1));
  });

  it("adds a new step when + button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StepEditor steps={steps} onChange={onChange} />);

    await user.click(screen.getByText("+ 添加步骤"));

    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    expect(lastCall).toHaveLength(3);
    expect(lastCall[2].text).toBe("");
    expect(lastCall[2].completed).toBe(false);
  });
});
