use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::Emitter;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AgentRunState {
    Unknown,
    Running,
    NeedsInput,
    Error,
    Idle,
    Completed,
    Stale,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatusSnapshot {
    pub protocol_version: i64,
    pub task_id: Option<String>,
    pub agent: String,
    pub session_id: Option<String>,
    pub state: AgentRunState,
    pub message: Option<String>,
    pub last_event: Option<String>,
    pub last_seen_at: String,
    pub source: Option<String>,
    pub cwd: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatusReadResult {
    pub current: Option<AgentStatusSnapshot>,
    pub history: Vec<AgentStatusSnapshot>,
}

pub fn read_agent_status(folder: &Path) -> Result<AgentStatusReadResult, String> {
    let progress_dir = folder.join(".agent-progress");
    let current = read_current_snapshot(&progress_dir.join("agent-status.json"))?;
    let history = read_history_snapshots(&progress_dir.join("agent-status.jsonl"))?;

    Ok(AgentStatusReadResult { current, history })
}

fn read_current_snapshot(path: &Path) -> Result<Option<AgentStatusSnapshot>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    match serde_json::from_str::<AgentStatusSnapshot>(&content) {
        Ok(snapshot) if is_supported_snapshot(&snapshot) => Ok(Some(snapshot)),
        Ok(_) => Ok(Some(error_snapshot(
            "agent-status.json has an unsupported protocol or invalid fields",
        ))),
        Err(_) => Ok(Some(error_snapshot(
            "agent-status.json could not be parsed",
        ))),
    }
}

fn read_history_snapshots(path: &Path) -> Result<Vec<AgentStatusSnapshot>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let mut history = content
        .lines()
        .filter_map(|line| serde_json::from_str::<AgentStatusSnapshot>(line).ok())
        .filter(is_supported_snapshot)
        .collect::<Vec<_>>();

    if history.len() > 50 {
        history.drain(0..history.len() - 50);
    }

    Ok(history)
}

fn is_supported_snapshot(snapshot: &AgentStatusSnapshot) -> bool {
    snapshot.protocol_version == 1
        && matches!(snapshot.agent.as_str(), "claude" | "codex" | "unknown")
        && !snapshot.last_seen_at.trim().is_empty()
        && chrono::DateTime::parse_from_rfc3339(&snapshot.last_seen_at).is_ok()
}

pub fn find_bound_folder(start_dir: &Path) -> Result<Option<std::path::PathBuf>, String> {
    let mut current = start_dir.to_path_buf();
    loop {
        let task_json = current.join(".agent-progress").join("task.json");
        if task_json.exists() {
            return Ok(Some(current));
        }
        if !current.pop() {
            return Ok(None);
        }
    }
}

pub fn write_agent_status_snapshot(folder: &Path, snapshot: &AgentStatusSnapshot) -> Result<(), String> {
    validate_snapshot(snapshot)?;

    let progress_dir = folder.join(".agent-progress");
    fs::create_dir_all(&progress_dir).map_err(|e| e.to_string())?;

    let target = progress_dir.join("agent-status.json");
    let tmp = progress_dir.join("agent-status.json.tmp");

    let json = serde_json::to_string(snapshot).map_err(|e| e.to_string())?;
    fs::write(&tmp, &json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &target).map_err(|e| e.to_string())?;

    Ok(())
}

pub fn append_agent_status_event(folder: &Path, snapshot: &AgentStatusSnapshot) -> Result<(), String> {
    validate_snapshot(snapshot)?;

    let progress_dir = folder.join(".agent-progress");
    fs::create_dir_all(&progress_dir).map_err(|e| e.to_string())?;

    let mut line = serde_json::to_string(snapshot).map_err(|e| e.to_string())?;
    line.push('\n');

    use std::io::Write;
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(progress_dir.join("agent-status.jsonl"))
        .map_err(|e| e.to_string())?;
    file.write_all(line.as_bytes()).map_err(|e| e.to_string())?;
    file.flush().map_err(|e| e.to_string())?;

    Ok(())
}

fn validate_snapshot(snapshot: &AgentStatusSnapshot) -> Result<(), String> {
    if !matches!(snapshot.agent.as_str(), "claude" | "codex" | "unknown") {
        return Err(format!("unsupported agent: {}", snapshot.agent));
    }
    if matches!(snapshot.state, AgentRunState::Unknown | AgentRunState::Stale) {
        return Err(format!("invalid state for helper write: {:?}", snapshot.state));
    }
    if snapshot.last_seen_at.trim().is_empty() {
        return Err("lastSeenAt is required".into());
    }
    Ok(())
}

pub fn generate_claude_hook_config() -> String {
    let hooks = serde_json::json!({
        "hooks": {
            "SessionStart": [
                {
                    "matcher": "",
                    "hooks": [
                        {
                            "command": "pinpulse-agent-status --agent claude --event SessionStart --state idle",
                            "type": "command"
                        }
                    ]
                }
            ],
            "UserPromptSubmit": [
                {
                    "matcher": "",
                    "hooks": [
                        {
                            "command": "pinpulse-agent-status --agent claude --event UserPromptSubmit --state running",
                            "type": "command"
                        }
                    ]
                }
            ],
            "PreToolUse": [
                {
                    "matcher": "",
                    "hooks": [
                        {
                            "command": "pinpulse-agent-status --agent claude --event PreToolUse --state running",
                            "type": "command"
                        }
                    ]
                }
            ],
            "PostToolUse": [
                {
                    "matcher": "",
                    "hooks": [
                        {
                            "command": "pinpulse-agent-status --agent claude --event PostToolUse --state running",
                            "type": "command"
                        }
                    ]
                }
            ],
            "PermissionRequest": [
                {
                    "matcher": "",
                    "hooks": [
                        {
                            "command": "pinpulse-agent-status --agent claude --event PermissionRequest --state needs_input",
                            "type": "command"
                        }
                    ]
                }
            ],
            "Stop": [
                {
                    "matcher": "",
                    "hooks": [
                        {
                            "command": "pinpulse-agent-status --agent claude --event Stop --state completed",
                            "type": "command"
                        }
                    ]
                }
            ],
            "StopFailure": [
                {
                    "matcher": "",
                    "hooks": [
                        {
                            "command": "pinpulse-agent-status --agent claude --event StopFailure --state error",
                            "type": "command"
                        }
                    ]
                }
            ],
            "SessionEnd": [
                {
                    "matcher": "",
                    "hooks": [
                        {
                            "command": "pinpulse-agent-status --agent claude --event SessionEnd --state idle",
                            "type": "command"
                        }
                    ]
                }
            ]
        }
    });
    serde_json::to_string_pretty(&hooks).unwrap_or_default()
}

pub fn generate_codex_hook_config() -> String {
    let hooks = serde_json::json!({
        "hooks": {
            "SessionStart": [
                {
                    "matcher": "",
                    "hooks": [
                        {
                            "command": "pinpulse-agent-status --agent codex --event SessionStart --state idle",
                            "type": "command"
                        }
                    ]
                }
            ],
            "UserPromptSubmit": [
                {
                    "matcher": "",
                    "hooks": [
                        {
                            "command": "pinpulse-agent-status --agent codex --event UserPromptSubmit --state running",
                            "type": "command"
                        }
                    ]
                }
            ],
            "PreToolUse": [
                {
                    "matcher": "",
                    "hooks": [
                        {
                            "command": "pinpulse-agent-status --agent codex --event PreToolUse --state running",
                            "type": "command"
                        }
                    ]
                }
            ],
            "PostToolUse": [
                {
                    "matcher": "",
                    "hooks": [
                        {
                            "command": "pinpulse-agent-status --agent codex --event PostToolUse --state running",
                            "type": "command"
                        }
                    ]
                }
            ],
            "PermissionRequest": [
                {
                    "matcher": "",
                    "hooks": [
                        {
                            "command": "pinpulse-agent-status --agent codex --event PermissionRequest --state needs_input",
                            "type": "command"
                        }
                    ]
                }
            ],
            "Stop": [
                {
                    "matcher": "",
                    "hooks": [
                        {
                            "command": "pinpulse-agent-status --agent codex --event Stop --state completed",
                            "type": "command"
                        }
                    ]
                }
            ]
        }
    });
    serde_json::to_string_pretty(&hooks).unwrap_or_default()
}

pub fn generate_codex_notify_config() -> String {
    r#"[notify]
agent-turn-complete = "pinpulse-agent-status --agent codex --event agent-turn-complete --state completed"
"#
    .into()
}

pub fn start_agent_status_watcher(
    app: tauri::AppHandle,
    folder: &Path,
) -> Result<(), String> {
    let folder = folder.to_path_buf();
    let progress_dir = folder.join(".agent-progress");
    let status_path = progress_dir.join("agent-status.json");

    if !progress_dir.exists() {
        return Err("bound folder .agent-progress directory not found".into());
    }

    use notify::Watcher;
    use std::sync::mpsc;

    let (tx, rx) = mpsc::channel::<Result<notify::Event, notify::Error>>();

    let mut watcher = notify::recommended_watcher(move |res| {
        let _ = tx.send(res);
    })
    .map_err(|e| e.to_string())?;

    watcher
        .watch(&progress_dir, notify::RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;

    std::thread::spawn(move || {
        let _watcher = watcher;
        for event in rx {
            let event = match event {
                Ok(e) => e,
                Err(_) => continue,
            };

            let is_status_change = event.paths.iter().any(|p| {
                p.file_name()
                    .map_or(false, |name| name == "agent-status.json")
            });

            if !is_status_change {
                continue;
            }

            if let Ok(content) = std::fs::read_to_string(&status_path) {
                if let Ok(snapshot) = serde_json::from_str::<AgentStatusSnapshot>(&content) {
                    if is_supported_snapshot(&snapshot) {
                        let _ = app.emit("agent-status-changed", serde_json::json!({
                            "folder": folder.to_string_lossy(),
                            "status": snapshot,
                        }));
                        if let Some(ref task_id) = snapshot.task_id {
                            let state_str: String = serde_json::to_value(&snapshot.state)
                                .ok()
                                .and_then(|v| v.as_str().map(String::from))
                                .unwrap_or_else(|| "unknown".into());
                            eprintln!("[agent_status] watcher sending AgentStatus: task_id={} state={} agent={}", task_id, state_str, snapshot.agent);
                            crate::sync::try_send_sync(crate::sync::SyncEvent::AgentStatus {
                                task_id: task_id.clone(),
                                status: crate::sync::AgentStatusPayload {
                                    state: state_str,
                                    agent: snapshot.agent.clone(),
                                    session_id: snapshot.session_id.clone(),
                                    last_event: snapshot.last_event.clone(),
                                    last_seen_at: snapshot.last_seen_at.clone(),
                                },
                            });
                        }
                    }
                }
            }
        }
    });

    Ok(())
}

fn error_snapshot(message: &str) -> AgentStatusSnapshot {
    AgentStatusSnapshot {
        protocol_version: 1,
        task_id: None,
        agent: "unknown".into(),
        session_id: None,
        state: AgentRunState::Error,
        message: Some(message.into()),
        last_event: Some("InvalidAgentStatus".into()),
        last_seen_at: chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        source: Some("pinpulse".into()),
        cwd: None,
    }
}
