# Changelog

## v0.1.0 (2026-06-13)

Initial release.

### Features
- Always-on-top desktop window
- Task cards with flag sorting (0-10)
- Progress bar with hover percentage
- Step checklist (manual + markdown parsing)
- Completion animation with auto-archive
- Folder binding via `.agent-progress/` protocol
- Agent status light (red/yellow/green)
- Cross-machine real-time sync via WebSocket
- Settings panel (10 configurable parameters)
- macOS + Windows support

### Tech
- Tauri v2 + React 19 + TypeScript + Vite
- Rust backend with SQLite (rusqlite)
- Vitest + Cargo test (~140 test cases)
