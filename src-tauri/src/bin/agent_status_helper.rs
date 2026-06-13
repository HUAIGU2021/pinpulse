use std::env;
use std::fs;

use pinpulse_desktop_lib::agent_status::{
    append_agent_status_event, find_bound_folder, write_agent_status_snapshot, AgentRunState,
    AgentStatusSnapshot,
};

fn main() {
    let mut agent = String::new();
    let mut event = String::new();
    let mut state_str = String::new();

    let args: Vec<String> = env::args().collect();
    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--agent" => {
                i += 1;
                if i < args.len() {
                    agent = args[i].clone();
                }
            }
            "--event" => {
                i += 1;
                if i < args.len() {
                    event = args[i].clone();
                }
            }
            "--state" => {
                i += 1;
                if i < args.len() {
                    state_str = args[i].clone();
                }
            }
            _ => {}
        }
        i += 1;
    }

    if agent.is_empty() || event.is_empty() || state_str.is_empty() {
        eprintln!(
            "Usage: pinpulse-agent-status --agent <claude|codex|unknown> --event <event> --state <running|needs_input|error|idle|completed>"
        );
        std::process::exit(0);
    }

    let state = match state_str.as_str() {
        "running" => AgentRunState::Running,
        "needs_input" => AgentRunState::NeedsInput,
        "error" => AgentRunState::Error,
        "idle" => AgentRunState::Idle,
        "completed" => AgentRunState::Completed,
        _ => {
            eprintln!("Unsupported state: {state_str}");
            std::process::exit(0);
        }
    };

    let cwd = match env::current_dir() {
        Ok(d) => d,
        Err(_) => {
            eprintln!("Cannot determine current directory");
            std::process::exit(0);
        }
    };

    let bound_folder = match find_bound_folder(&cwd) {
        Ok(Some(folder)) => folder,
        Ok(None) => {
            // Not in a bound folder — exit silently
            std::process::exit(0);
        }
        Err(e) => {
            eprintln!("Error finding bound folder: {e}");
            std::process::exit(0);
        }
    };

    let task_id = read_task_id(&bound_folder.join(".agent-progress").join("task.json"))
        .unwrap_or_else(|| "unknown".into());

    let session_id = env::var("CLAUDE_SESSION_ID")
        .or_else(|_| env::var("CODEX_SESSION_ID"))
        .ok();

    let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);

    let snapshot = AgentStatusSnapshot {
        protocol_version: 1,
        task_id: Some(task_id),
        agent,
        session_id,
        state,
        message: None,
        last_event: Some(event),
        last_seen_at: now,
        source: Some("pinpulse-agent-status".into()),
        cwd: Some(cwd.to_string_lossy().into()),
    };

    if let Err(e) = write_agent_status_snapshot(&bound_folder, &snapshot) {
        eprintln!("Error writing agent status snapshot: {e}");
        std::process::exit(0);
    }

    if let Err(e) = append_agent_status_event(&bound_folder, &snapshot) {
        eprintln!("Error appending agent status event: {e}");
        std::process::exit(0);
    }
}

fn read_task_id(path: &std::path::Path) -> Option<String> {
    let content = fs::read_to_string(path).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&content).ok()?;
    parsed
        .get("taskId")?
        .as_str()
        .map(|s| s.to_string())
}
