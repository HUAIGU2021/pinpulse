import { describe, expect, it } from "vitest";
import { checkboxProgress } from "./markdownProgress";

describe("checkboxProgress", () => {
  it("calculates progress from markdown checkboxes", () => {
    const markdown = ["- [x] 初始化项目", "- [ ] 实现置顶窗口", "- [X] 添加任务卡片"].join("\n");
    expect(checkboxProgress(markdown)).toEqual({ completed: 2, total: 3, progress: 67 });
  });

  it("returns zero progress when no checkbox exists", () => {
    expect(checkboxProgress("# Plan")).toEqual({ completed: 0, total: 0, progress: 0 });
  });
});
