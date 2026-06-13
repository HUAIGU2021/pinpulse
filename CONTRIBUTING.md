# Contributing to PinPulse

## Development Setup

```bash
git clone https://github.com/HUAIGU2021/pinpulse.git
cd pinpulse
npm install
```

## Project Structure

```
src/              # React frontend
  components/     # React components
  domain/         # Business logic, types, pure functions
  hooks/          # Custom React hooks
  services/       # API layer (Tauri invoke, sync)
src-tauri/        # Rust backend
  src/
    commands.rs   # Tauri commands (IPC)
    db.rs         # SQLite database layer
    models.rs     # Data structures
    sync.rs       # WebSocket sync
    agent_status.rs
    progress_ingest.rs
```

## Testing

```bash
npm test          # Frontend tests (Vitest)
npm run test:rust # Backend tests (Cargo)
```

## Commit Convention

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `refactor:` code change without feature/fix
- `style:` CSS/formatting
- `test:` test changes

## Pull Request Process

1. Create a feature branch from `main`
2. Write / update tests
3. Ensure all tests pass
4. Open PR with description of changes

## Code Style

- TypeScript strict mode
- React functional components with hooks
- Rust: follow standard conventions (`cargo fmt`, `cargo clippy`)
