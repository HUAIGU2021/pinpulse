# PinPulse Desktop

桌面进度面板 — 窗口置顶悬浮，追踪个人项目任务进度。

*Desktop progress panel — always-on-top floating window for tracking personal project tasks.*

## 功能特性 / Features

- **窗口置顶** / Always-on-top — 始终悬浮在其他窗口上方
- **任务卡片** / Task cards — 标题、进度条、文件夹绑定状态一目了然
- **Flag 排序** / Flag sorting — 按优先级 0-10 排列任务
- **进度条** / Progress bar — 鼠标悬停显示精确百分比
- **文件夹绑定** / Folder binding — 通过 `.agent-progress/` 协议与 AI Agent 协作
- **Agent 状态灯** / Agent status light — 显示 Claude Code / Codex 的红黄绿状态
- **完成动画** / Completion animation — 任务完成时碎片消散动画
- **跨机同步** / Cross-machine sync — WebSocket 实时同步多台机器
- **设置面板** / Settings drawer — 10 项可配置参数

## 快速开始 / Quick Start

```bash
git clone https://github.com/HUAIGU2021/pinpulse.git
cd pinpulse
npm install
npm run tauri dev
```

## 构建 / Build

```bash
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/`。
*Build artifacts in `src-tauri/target/release/bundle/`.*

## Agent 协议 / Agent Protocol

PinPulse 通过项目文件夹中的 `.agent-progress/` 与 AI Agent 协作：

```
project/
  .agent-progress/
    task.json          # 任务元信息
    progress.jsonl     # 进度事件流 (JSON Lines)
    agent-status.json  # Agent 状态 (红/黄/绿)
```

### progress.jsonl 事件类型

```jsonl
{"type":"step_added","text":"创建窗口","source":"claude","ts":"2026-06-12T00:00:00Z"}
{"type":"step_completed","text":"创建窗口","source":"claude","ts":"2026-06-12T00:30:00Z"}
{"type":"progress_updated","progress":45,"source":"claude"}
```

支持: `step_added`, `step_updated`, `step_completed`, `step_uncompleted`, `progress_updated`, `state_changed`, `deadline_updated`, `note_added`

### Markdown Checklist 解析

自动解析项目目录下 `PLAN.md` 中的 markdown checkbox:

```markdown
- [x] 初始化项目
- [ ] 实现置顶窗口
- [X] 添加任务卡片
```

## 技术栈 / Tech Stack

- **前端**: React 19 + TypeScript + Vite
- **后端**: Rust + Tauri v2 + SQLite
- **通信**: WebSocket (跨机同步)
- **测试**: Vitest (前端) + Cargo test (Rust)

## License

MIT
