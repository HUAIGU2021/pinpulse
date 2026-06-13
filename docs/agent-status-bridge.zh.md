# Agent 状态桥接设置

PinPulse 会从已绑定文件夹的 `.agent-progress/agent-status.json` 读取 Claude Code 或 Codex 的当前状态，并从 `.agent-progress/agent-status.jsonl` 读取最近状态历史。第一版只接受 `claude`、`codex`、`unknown` 三种 agent 标识；其他工具接入时请先写成 `unknown`。

## 状态灯含义

- 蓝灯：agent 正在运行。
- 黄灯：agent 需要用户输入、权限确认，或运行出错。
- 红灯：agent 当前轮次结束、空闲、已完成，或心跳超时。
- 灰灯：未安装状态桥接，或还没有状态记录。

## 协议文件

当前状态写入：

```text
.agent-progress/agent-status.json
```

历史状态追加写入：

```text
.agent-progress/agent-status.jsonl
```

PinPulse 只接受 `protocolVersion` 为 `1`，且 `agent` 和 `lastSeenAt` 非空的记录。示例：

```json
{
  "protocolVersion": 1,
  "agent": "codex",
  "state": "running",
  "lastSeenAt": "2026-06-13T08:20:00.000Z",
  "source": "pinpulse-agent-status"
}
```

## Claude Code

在项目级 `.claude/settings.json` 中添加 hooks，让 Claude Code 在生命周期事件发生时调用 PinPulse helper。修改已有配置前，先备份现有 `.claude/settings.json`。

示例命令形式：

```bash
pinpulse-agent-status --agent claude --event UserPromptSubmit --state running
pinpulse-agent-status --agent claude --event PermissionRequest --state needs_input
pinpulse-agent-status --agent claude --event Stop --state completed
pinpulse-agent-status --agent claude --event StopFailure --state error
```

如果你在 VS Code 中使用 Claude Code，优先使用项目级 `.claude/settings.json`，这样同一个绑定文件夹里的团队配置和本地状态更容易对齐。

## Codex

在项目级 `.codex/hooks.json` 中添加 hooks，让 Codex 调用 PinPulse helper。

示例命令形式：

```bash
pinpulse-agent-status --agent codex --event UserPromptSubmit --state running
pinpulse-agent-status --agent codex --event PermissionRequest --state needs_input
pinpulse-agent-status --agent codex --event Stop --state completed
pinpulse-agent-status --agent codex --event StopFailure --state error
```

Codex notify 可作为结束兜底：

```bash
pinpulse-agent-status --agent codex --event agent-turn-complete --state completed
```

## 验证方法

在已绑定到 PinPulse 任务的文件夹中运行：

```bash
mkdir -p .agent-progress
pinpulse-agent-status --agent claude --event UserPromptSubmit --state running
```

确认 `.agent-progress/agent-status.json` 已生成，并且其中包含 `protocolVersion`、`agent`、`state` 和 `lastSeenAt`。刷新 PinPulse 的绑定文件夹后，该任务应显示蓝灯。

如果没有安装 helper，也可以手工写入一条记录验证读取层：

```bash
mkdir -p .agent-progress
printf '%s\n' '{"protocolVersion":1,"agent":"claude","state":"running","lastSeenAt":"2026-06-13T08:20:00.000Z","source":"manual-smoke"}' > .agent-progress/agent-status.json
```
