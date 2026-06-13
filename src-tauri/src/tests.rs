use crate::db::{delete_task, init_db, insert_task, list_tasks, update_task};
use crate::models::{ConnectionState, NewTask, ProgressStep};
use rusqlite::Connection;

#[test]
fn rust_test_harness_runs() {
    assert_eq!(2 + 2, 4);
}

#[test]
fn stores_and_lists_tasks_sorted_by_flags_then_creation() {
    let conn = Connection::open_in_memory().expect("in-memory db");
    init_db(&conn).expect("schema");

    insert_task(
        &conn,
        NewTask {
            id: "low".into(),
            title: "Low".into(),
            flags: 1,
            progress: 0,
            automatic_progress: 0,
            manual_override: false,
            deadline: None,
            bound_folder: None,
            connection: ConnectionState::Unbound,
            created_at: "2026-06-10T00:00:00.000Z".into(),
            updated_at: "2026-06-10T00:00:00.000Z".into(),
            notes: None,
            steps: vec![],
        },
    )
    .expect("insert low");

    insert_task(
        &conn,
        NewTask {
            id: "high".into(),
            title: "High".into(),
            flags: 8,
            progress: 0,
            automatic_progress: 0,
            manual_override: false,
            deadline: None,
            bound_folder: None,
            connection: ConnectionState::Healthy,
            created_at: "2026-06-12T00:00:00.000Z".into(),
            updated_at: "2026-06-12T00:00:00.000Z".into(),
            notes: None,
            steps: vec![],
        },
    )
    .expect("insert high");

    let tasks = list_tasks(&conn).expect("list");
    assert_eq!(
        tasks
            .iter()
            .map(|task| task.id.as_str())
            .collect::<Vec<_>>(),
        vec!["high", "low"]
    );
}

#[test]
fn updates_task_fields() {
    let conn = Connection::open_in_memory().expect("in-memory db");
    init_db(&conn).expect("schema");

    insert_task(
        &conn,
        NewTask {
            id: "task-1".into(),
            title: "Old Title".into(),
            flags: 3,
            progress: 0,
            automatic_progress: 0,
            manual_override: false,
            deadline: None,
            bound_folder: None,
            connection: ConnectionState::Unbound,
            created_at: "2026-06-12T00:00:00.000Z".into(),
            updated_at: "2026-06-12T00:00:00.000Z".into(),
            notes: None,
            steps: vec![],
        },
    )
    .expect("insert task");

    let patch = serde_json::json!({ "title": "New Title", "flags": 7 });
    update_task(&conn, "task-1", &patch).expect("update");

    let tasks = list_tasks(&conn).expect("list");
    let task = tasks.iter().find(|t| t.id == "task-1").expect("find task");
    assert_eq!(task.title, "New Title");
    assert_eq!(task.flags, 7);
}

#[test]
fn deletes_task() {
    let conn = Connection::open_in_memory().expect("in-memory db");
    init_db(&conn).expect("schema");

    insert_task(
        &conn,
        NewTask {
            id: "task-del".into(),
            title: "Delete Me".into(),
            flags: 1,
            progress: 0,
            automatic_progress: 0,
            manual_override: false,
            deadline: None,
            bound_folder: None,
            connection: ConnectionState::Unbound,
            created_at: "2026-06-12T00:00:00.000Z".into(),
            updated_at: "2026-06-12T00:00:00.000Z".into(),
            notes: None,
            steps: vec![],
        },
    )
    .expect("insert task");

    delete_task(&conn, "task-del").expect("delete");
    let tasks = list_tasks(&conn).expect("list");
    assert!(tasks.iter().all(|t| t.id != "task-del"));
}

#[test]
fn persists_and_reads_steps() {
    let conn = Connection::open_in_memory().expect("in-memory db");
    init_db(&conn).expect("schema");

    let step = ProgressStep {
        id: "step-1".into(),
        text: "创建窗口".into(),
        completed: false,
        updated_at: "2026-06-12T00:00:00.000Z".into(),
    };

    insert_task(
        &conn,
        NewTask {
            id: "task-steps".into(),
            title: "Steps Task".into(),
            flags: 5,
            progress: 0,
            automatic_progress: 0,
            manual_override: false,
            deadline: None,
            bound_folder: None,
            connection: ConnectionState::Unbound,
            created_at: "2026-06-12T00:00:00.000Z".into(),
            updated_at: "2026-06-12T00:00:00.000Z".into(),
            notes: None,
            steps: vec![step],
        },
    )
    .expect("insert task");

    let tasks = list_tasks(&conn).expect("list");
    let task = tasks
        .iter()
        .find(|t| t.id == "task-steps")
        .expect("find task");
    assert_eq!(task.steps.len(), 1);
    assert_eq!(task.steps[0].text, "创建窗口");
}

use crate::folder_binding::{bind_folder_files, BindingManifest};
use tempfile::tempdir;

#[test]
fn creates_agent_progress_binding_files() {
    let dir = tempdir().expect("temp dir");
    let manifest = BindingManifest {
        protocol_version: 1,
        task_id: "task_123".into(),
        title: "开发桌面红绿灯提醒".into(),
        bound_at: "2026-06-12T00:00:00Z".into(),
        app: "PinPulse Desktop".into(),
    };

    bind_folder_files(dir.path(), &manifest).expect("bind folder");

    assert!(dir.path().join(".agent-progress/task.json").exists());
    assert!(dir.path().join(".agent-progress/progress.jsonl").exists());
}

use crate::markdown::checkbox_progress;

#[test]
fn rust_markdown_parser_counts_checkboxes() {
    let progress = checkbox_progress("- [x] A\n- [ ] B\n- [X] C");
    assert_eq!(progress.completed, 2);
    assert_eq!(progress.total, 3);
    assert_eq!(progress.progress, 67);
}

use crate::reminder::{deadline_state, DeadlineState};

use crate::git_status::parse_porcelain_status;

use crate::progress_ingest::read_progress_jsonl;
use std::fs;

#[test]
fn reads_agent_status_snapshot_and_history() {
    use crate::agent_status::{read_agent_status, AgentRunState};

    let dir = tempdir().expect("temp dir");
    let progress_dir = dir.path().join(".agent-progress");
    fs::create_dir_all(&progress_dir).expect("progress dir");
    fs::write(
        progress_dir.join("agent-status.json"),
        r#"{"protocolVersion":1,"agent":"claude","state":"running","lastSeenAt":"2026-06-13T08:20:00.000Z","source":"test"}"#,
    )
    .expect("snapshot");
    fs::write(
        progress_dir.join("agent-status.jsonl"),
        r#"{"protocolVersion":1,"agent":"claude","state":"running","lastSeenAt":"2026-06-13T08:20:00.000Z","source":"test"}
{"protocolVersion":1,"agent":"claude","state":"completed","lastSeenAt":"2026-06-13T08:21:00.000Z","source":"test"}
"#,
    )
    .expect("history");

    let status = read_agent_status(dir.path()).expect("status");
    assert_eq!(
        status.current.expect("current").state,
        AgentRunState::Running
    );
    assert_eq!(status.history.len(), 2);
}

#[test]
fn skips_invalid_agent_status_history_lines() {
    use crate::agent_status::read_agent_status;

    let dir = tempdir().expect("temp dir");
    let progress_dir = dir.path().join(".agent-progress");
    fs::create_dir_all(&progress_dir).expect("progress dir");
    fs::write(
        progress_dir.join("agent-status.jsonl"),
        "not json\n{\"protocolVersion\":1,\"agent\":\"codex\",\"state\":\"needs_input\",\"lastSeenAt\":\"2026-06-13T08:20:00.000Z\"}\n",
    )
    .expect("history");

    let status = read_agent_status(dir.path()).expect("status");
    assert!(status.current.is_none());
    assert_eq!(status.history.len(), 1);
}

#[test]
fn ignores_invalid_or_unsupported_agent_status_snapshots() {
    use crate::agent_status::{read_agent_status, AgentRunState};

    let dir = tempdir().expect("temp dir");
    let progress_dir = dir.path().join(".agent-progress");
    fs::create_dir_all(&progress_dir).expect("progress dir");
    fs::write(progress_dir.join("agent-status.json"), "{not json").expect("snapshot");
    fs::write(
        progress_dir.join("agent-status.jsonl"),
        "{\"protocolVersion\":2,\"agent\":\"codex\",\"state\":\"running\",\"lastSeenAt\":\"2026-06-13T08:20:00.000Z\"}\n{\"protocolVersion\":1,\"agent\":\"\",\"state\":\"running\",\"lastSeenAt\":\"2026-06-13T08:21:00.000Z\"}\n{\"protocolVersion\":1,\"agent\":\"codex\",\"state\":\"running\",\"lastSeenAt\":\"\"}\n",
    )
    .expect("history");

    let status = read_agent_status(dir.path()).expect("status");
    let current = status.current.expect("current error");
    assert_eq!(current.agent, "unknown");
    assert_eq!(current.state, AgentRunState::Error);
    assert!(current
        .message
        .expect("message")
        .contains("agent-status.json"));
    assert!(status.history.is_empty());
}

#[test]
fn unsupported_current_agent_status_protocol_becomes_error_snapshot() {
    use crate::agent_status::{read_agent_status, AgentRunState};

    let dir = tempdir().expect("temp dir");
    let progress_dir = dir.path().join(".agent-progress");
    fs::create_dir_all(&progress_dir).expect("progress dir");
    fs::write(
        progress_dir.join("agent-status.json"),
        r#"{"protocolVersion":2,"agent":"claude","state":"running","lastSeenAt":"2026-06-13T08:20:00.000Z"}"#,
    )
    .expect("snapshot");

    let status = read_agent_status(dir.path()).expect("status");
    let current = status.current.expect("current error");
    assert_eq!(current.agent, "unknown");
    assert_eq!(current.state, AgentRunState::Error);
    assert_eq!(current.last_event.as_deref(), Some("InvalidAgentStatus"));
}

#[test]
fn keeps_only_latest_fifty_agent_status_history_entries_in_order() {
    use crate::agent_status::read_agent_status;

    let dir = tempdir().expect("temp dir");
    let progress_dir = dir.path().join(".agent-progress");
    fs::create_dir_all(&progress_dir).expect("progress dir");
    let lines = (0..55)
        .map(|index| {
            format!(
                r#"{{"protocolVersion":1,"agent":"codex","state":"running","message":"event-{index}","lastSeenAt":"2026-06-13T08:{:02}:00.000Z"}}"#,
                index % 60
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    fs::write(progress_dir.join("agent-status.jsonl"), lines).expect("history");

    let status = read_agent_status(dir.path()).expect("status");
    assert_eq!(status.history.len(), 50);
    assert_eq!(status.history[0].message.as_deref(), Some("event-5"));
    assert_eq!(status.history[49].message.as_deref(), Some("event-54"));
}

#[test]
fn reads_valid_progress_jsonl_events_and_skips_invalid_lines() {
    let dir = tempdir().expect("temp dir");
    let file = dir.path().join("progress.jsonl");
    fs::write(
        &file,
        "{\"type\":\"step_added\",\"text\":\"Create shell\",\"source\":\"codex\",\"ts\":\"2026-06-12T00:00:00Z\"}\nnot-json\n{\"type\":\"progress_updated\",\"progress\":40,\"source\":\"codex\"}\n",
    )
    .expect("write events");

    let events = read_progress_jsonl(&file).expect("read events");
    assert_eq!(events.len(), 2);
    assert_eq!(events[0].event_type, "step_added");
    assert_eq!(events[1].progress, Some(40));
}

#[test]
fn deadline_state_returns_none_for_missing_deadline() {
    assert_eq!(
        deadline_state(None, "2026-06-12T00:00:00Z"),
        DeadlineState::None
    );
}

#[test]
fn deadline_state_returns_overdue_for_past_deadline() {
    assert_eq!(
        deadline_state(Some("2026-06-10T00:00:00Z"), "2026-06-12T00:00:00Z"),
        DeadlineState::Overdue
    );
}

#[test]
fn deadline_state_returns_due_soon_within_24_hours() {
    assert_eq!(
        deadline_state(Some("2026-06-12T12:00:00Z"), "2026-06-12T00:00:00Z"),
        DeadlineState::DueSoon
    );
}

#[test]
fn deadline_state_returns_approaching_within_48_hours() {
    assert_eq!(
        deadline_state(Some("2026-06-13T23:00:00Z"), "2026-06-12T00:00:00Z"),
        DeadlineState::Approaching
    );
}

#[test]
fn deadline_state_returns_normal_for_far_future() {
    assert_eq!(
        deadline_state(Some("2026-06-20T00:00:00Z"), "2026-06-12T00:00:00Z"),
        DeadlineState::Normal
    );
}

#[test]
fn parses_git_porcelain_counts() {
    let summary = parse_porcelain_status(" M src/main.rs\nA  src/lib.rs\n?? README.md\n");
    assert_eq!(summary.dirty_count, 3);
    assert_eq!(summary.staged_count, 1);
}

use crate::agent_status::{find_bound_folder, write_agent_status_snapshot, append_agent_status_event, AgentRunState, AgentStatusSnapshot};

#[test]
fn writes_agent_status_snapshot_atomically() {
    let dir = tempdir().expect("temp dir");
    let progress_dir = dir.path().join(".agent-progress");
    fs::create_dir_all(&progress_dir).expect("progress dir");
    fs::write(
        progress_dir.join("task.json"),
        r#"{"protocolVersion":1,"taskId":"task_123","title":"Test","boundAt":"2026-06-13T00:00:00.000Z","app":"PinPulse Desktop"}"#,
    )
    .expect("task.json");

    let snapshot = AgentStatusSnapshot {
        protocol_version: 1,
        task_id: Some("task_123".into()),
        agent: "claude".into(),
        session_id: None,
        state: AgentRunState::Running,
        message: None,
        last_event: Some("UserPromptSubmit".into()),
        last_seen_at: "2026-06-13T08:20:00.000Z".into(),
        source: Some("pinpulse-agent-status".into()),
        cwd: Some(dir.path().to_string_lossy().into()),
    };

    write_agent_status_snapshot(dir.path(), &snapshot).expect("write snapshot");

    let content = fs::read_to_string(progress_dir.join("agent-status.json")).expect("read");
    let parsed: AgentStatusSnapshot = serde_json::from_str(&content).expect("parse");
    assert_eq!(parsed.state, AgentRunState::Running);
    assert_eq!(parsed.agent, "claude");
    assert_eq!(parsed.last_event.as_deref(), Some("UserPromptSubmit"));
}

#[test]
fn appends_agent_status_event_to_jsonl() {
    let dir = tempdir().expect("temp dir");
    let progress_dir = dir.path().join(".agent-progress");
    fs::create_dir_all(&progress_dir).expect("progress dir");
    fs::write(
        progress_dir.join("task.json"),
        r#"{"protocolVersion":1,"taskId":"task_123","title":"Test","boundAt":"2026-06-13T00:00:00.000Z","app":"PinPulse Desktop"}"#,
    )
    .expect("task.json");

    let snapshot = AgentStatusSnapshot {
        protocol_version: 1,
        task_id: Some("task_123".into()),
        agent: "codex".into(),
        session_id: None,
        state: AgentRunState::Running,
        message: None,
        last_event: Some("UserPromptSubmit".into()),
        last_seen_at: "2026-06-13T08:20:00.000Z".into(),
        source: Some("pinpulse-agent-status".into()),
        cwd: Some(dir.path().to_string_lossy().into()),
    };

    append_agent_status_event(dir.path(), &snapshot).expect("append 1");
    append_agent_status_event(dir.path(), &snapshot).expect("append 2");

    let content = fs::read_to_string(progress_dir.join("agent-status.jsonl")).expect("read");
    let lines: Vec<_> = content.lines().collect();
    assert_eq!(lines.len(), 2);
    assert!(lines[0].contains("UserPromptSubmit"));
    assert!(lines[1].contains("UserPromptSubmit"));
}

#[test]
fn finds_bound_folder_from_cwd() {
    let dir = tempdir().expect("temp dir");
    let progress_dir = dir.path().join(".agent-progress");
    fs::create_dir_all(&progress_dir).expect("progress dir");
    fs::write(
        progress_dir.join("task.json"),
        r#"{"protocolVersion":1,"taskId":"task_123","title":"Test","boundAt":"2026-06-13T00:00:00.000Z","app":"PinPulse Desktop"}"#,
    )
    .expect("task.json");

    assert_eq!(
        find_bound_folder(dir.path()).expect("find from root"),
        Some(dir.path().to_path_buf())
    );
}

#[test]
fn finds_bound_folder_from_subdirectory() {
    let dir = tempdir().expect("temp dir");
    let progress_dir = dir.path().join(".agent-progress");
    fs::create_dir_all(&progress_dir).expect("progress dir");
    fs::write(
        progress_dir.join("task.json"),
        r#"{"protocolVersion":1,"taskId":"task_123","title":"Test","boundAt":"2026-06-13T00:00:00.000Z","app":"PinPulse Desktop"}"#,
    )
    .expect("task.json");

    let sub = dir.path().join("src").join("components");
    fs::create_dir_all(&sub).expect("create sub dir");

    assert_eq!(
        find_bound_folder(&sub).expect("find from sub"),
        Some(dir.path().to_path_buf())
    );
}

#[test]
fn returns_none_when_not_in_bound_folder() {
    let dir = tempdir().expect("temp dir");
    // No .agent-progress/task.json created

    assert_eq!(
        find_bound_folder(dir.path()).expect("find"),
        None
    );
}

#[test]
fn rejects_invalid_agent_and_state_in_write() {
    let dir = tempdir().expect("temp dir");
    let progress_dir = dir.path().join(".agent-progress");
    fs::create_dir_all(&progress_dir).expect("progress dir");
    fs::write(
        progress_dir.join("task.json"),
        r#"{"protocolVersion":1,"taskId":"task_123","title":"Test","boundAt":"2026-06-13T00:00:00.000Z","app":"PinPulse Desktop"}"#,
    )
    .expect("task.json");

    let invalid_agent = AgentStatusSnapshot {
        protocol_version: 1,
        task_id: Some("task_123".into()),
        agent: "gemini".into(),
        session_id: None,
        state: AgentRunState::Running,
        message: None,
        last_event: None,
        last_seen_at: "2026-06-13T08:20:00.000Z".into(),
        source: Some("pinpulse-agent-status".into()),
        cwd: Some(dir.path().to_string_lossy().into()),
    };
    assert!(write_agent_status_snapshot(dir.path(), &invalid_agent).is_err());

    let invalid_state = AgentStatusSnapshot {
        protocol_version: 1,
        task_id: Some("task_123".into()),
        agent: "claude".into(),
        session_id: None,
        state: AgentRunState::Unknown,
        message: None,
        last_event: None,
        last_seen_at: "2026-06-13T08:20:00.000Z".into(),
        source: Some("pinpulse-agent-status".into()),
        cwd: Some(dir.path().to_string_lossy().into()),
    };
    assert!(write_agent_status_snapshot(dir.path(), &invalid_state).is_err());
}

use crate::agent_status::{generate_claude_hook_config, generate_codex_hook_config, generate_codex_notify_config};

#[test]
fn generates_claude_hook_config_snippet() {
    let config = generate_claude_hook_config();
    let parsed: serde_json::Value = serde_json::from_str(&config).expect("valid json");
    let hooks = parsed.get("hooks").expect("has hooks");

    assert!(hooks.get("UserPromptSubmit").is_some());
    assert!(hooks.get("PermissionRequest").is_some());
    assert!(hooks.get("Stop").is_some());
    assert!(hooks.get("StopFailure").is_some());
    assert!(config.contains("pinpulse-agent-status --agent claude"));
}

#[test]
fn generates_codex_hook_config_snippet() {
    let config = generate_codex_hook_config();
    let parsed: serde_json::Value = serde_json::from_str(&config).expect("valid json");
    let hooks = parsed.get("hooks").expect("has hooks");

    assert!(hooks.get("UserPromptSubmit").is_some());
    assert!(hooks.get("PermissionRequest").is_some());
    assert!(hooks.get("Stop").is_some());
    assert!(config.contains("pinpulse-agent-status --agent codex"));
}

#[test]
fn generates_codex_notify_config_snippet() {
    let config = generate_codex_notify_config();
    assert!(config.contains("[notify]"));
    assert!(config.contains("agent-turn-complete"));
    assert!(config.contains("pinpulse-agent-status --agent codex --event agent-turn-complete --state completed"));
}
