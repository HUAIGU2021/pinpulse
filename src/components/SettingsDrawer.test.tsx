import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../domain/settings";
import { SettingsDrawer } from "./SettingsDrawer";

function noop() {
  return undefined;
}

describe("SettingsDrawer", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <SettingsDrawer open={false} settings={DEFAULT_SETTINGS} onUpdate={noop} onRestore={noop} onClose={noop} />,
    );
    expect(container.querySelector(".settings-backdrop")).not.toBeInTheDocument();
  });

  it("renders drawer with backdrop when open", () => {
    render(
      <SettingsDrawer open={true} settings={DEFAULT_SETTINGS} onUpdate={noop} onRestore={noop} onClose={noop} />,
    );
    expect(screen.getByRole("complementary")).toBeInTheDocument();
    expect(document.querySelector(".settings-backdrop")).toBeInTheDocument();
  });

  it("shows all 4 tab buttons", () => {
    render(
      <SettingsDrawer open={true} settings={DEFAULT_SETTINGS} onUpdate={noop} onRestore={noop} onClose={noop} />,
    );
    expect(screen.getByText("行为")).toBeInTheDocument();
    expect(screen.getByText("截止")).toBeInTheDocument();
    expect(screen.getByText("视觉")).toBeInTheDocument();
    expect(screen.getByText("主题")).toBeInTheDocument();
  });

  it("switches tabs on click", async () => {
    const user = userEvent.setup();
    render(
      <SettingsDrawer open={true} settings={DEFAULT_SETTINGS} onUpdate={noop} onRestore={noop} onClose={noop} />,
    );
    // First tab (行为) is active by default
    expect(screen.getByText("进度刷新间隔")).toBeInTheDocument();

    await user.click(screen.getByText("截止"));
    expect(screen.getByText("紧急阈值")).toBeInTheDocument();

    await user.click(screen.getByText("视觉"));
    expect(screen.getByText("紧凑模式宽度")).toBeInTheDocument();

    await user.click(screen.getByText("主题"));
    expect(screen.getByText("米白")).toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <SettingsDrawer open={true} settings={DEFAULT_SETTINGS} onUpdate={noop} onRestore={noop} onClose={onClose} />,
    );
    await user.click(document.querySelector(".settings-backdrop")!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when Escape key is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <SettingsDrawer open={true} settings={DEFAULT_SETTINGS} onUpdate={noop} onRestore={noop} onClose={onClose} />,
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onRestore when restore defaults button is clicked", async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    render(
      <SettingsDrawer open={true} settings={DEFAULT_SETTINGS} onUpdate={noop} onRestore={onRestore} onClose={noop} />,
    );
    await user.click(screen.getByText("恢复默认"));
    expect(onRestore).toHaveBeenCalledOnce();
  });
});
