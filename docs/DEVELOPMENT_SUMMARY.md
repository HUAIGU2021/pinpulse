# PinPulse 开发历程总结

## 项目概述

PinPulse 是一个桌面进度面板应用，用于追踪个人项目的任务进度。窗口默认置顶悬浮，方便在编码过程中随时查看当前任务状态。支持与 AI Agent (Claude Code / Codex) 协作。

## 开发时间线

### 2026-06-12: MVP 阶段
- Tauri v2 + React 19 项目初始化
- 置顶窗口、任务卡片、进度条
- Flag 排序 (0-10)
- SQLite 本地持久化存储
- 文件夹绑定协议 (.agent-progress/)
- Agent 进度通过 progress.jsonl 更新
- Markdown checkbox 进度解析
- 截止日期提醒状态

### 2026-06-12: 体验打磨
- 完成动画 (碎片消散 + 自动归档)
- Agent 状态灯 (红黄绿)
- 紧凑布局 (175px 宽度)
- 绿色状态灯
- 点击空白关闭详情面板
- 已完成任务归档（支持恢复和删除）

### 2026-06-13: 成熟阶段
- 跨机实时同步 (WebSocket)
- 设置面板 (10 项参数, 4 个 tab)
- 设置持久化存储
- Windows 前端同步
- 任务标题/备注编辑确认按钮（防止同步覆盖）
- Agent 状态同步修复

## 架构演进

### 早期
- 纯 React 状态管理，无持久化
- 单窗口，无跨机通信

### 中期
- 引入 SQLite 持久化 (通过 Tauri Rust backend)
- 文件系统监听 (notify crate) 监听 .agent-progress/ 变更
- Rust 命令层: commands.rs, db.rs, models.rs

### 成熟期
- WebSocket 同步服务 (sync.rs)
- Agent 状态 helper (agent_status.rs)
- 设置系统 (settings domain + useSettings hook)
- 跨平台代码统一 (macOS + Windows)

## 技术决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 框架 | Tauri v2 | 比 Electron 轻量，Rust 后端性能好 |
| 前端 | React 19 | 生态成熟 |
| 数据库 | SQLite (rusqlite bundled) | 嵌入式、零配置 |
| 同步 | WebSocket | 实时双向通信 |
| 文件监听 | notify crate | 跨平台，支持 fsevent/inotify |
| 测试 | Vitest + Cargo test | 快、与 Vite 集成好 |

## 功能清单

- [x] 置顶窗口
- [x] 任务 CRUD + 卡片展示
- [x] Flag 优先级排序
- [x] 进度条 + 悬停百分比
- [x] 步骤勾选 (手动 + Markdown 解析)
- [x] 完成动画 + 自动归档
- [x] 文件夹绑定协议
- [x] Agent 进度事件流 (progress.jsonl)
- [x] Agent 状态灯 (红/黄/绿)
- [x] 跨机 WebSocket 同步
- [x] 设置面板 (10 参数)
- [x] macOS + Windows 支持

## 测试覆盖

- 前端测试: ~130 个测试用例 (Vitest)
- Rust 测试: 28 个测试用例 (Cargo test)
- 测试文件: 14 个
