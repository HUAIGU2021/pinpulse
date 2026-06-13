use crate::agent_status::{
    generate_claude_hook_config, generate_codex_hook_config, generate_codex_notify_config,
    read_agent_status, start_agent_status_watcher, AgentStatusReadResult,
};
use crate::db::{
    delete_task as delete_task_from_db, get_task_by_id, init_db, insert_task,
    list_tasks as list_tasks_from_db, update_task as update_task_in_db,
};
use crate::sync::{self, try_send_sync, SyncEvent};
use crate::folder_binding::{bind_folder_files, BindingManifest};
use crate::git_status::{sample_git_status, GitStatusSummary};
use crate::markdown::{checkbox_progress, CheckboxProgress};
use crate::models::{ConnectionState, NewTask, Task};
use crate::progress_ingest::{read_progress_jsonl, ProgressEvent};
use chrono::Utc;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskInput {
    pub title: String,
    pub flags: i64,
}

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.join("pinpulse.sqlite3"))
}

fn open_db(app: &AppHandle) -> Result<Connection, String> {
    let conn = Connection::open(db_path(app)?).map_err(|error| error.to_string())?;
    init_db(&conn).map_err(|error| error.to_string())?;
    Ok(conn)
}

#[tauri::command]
pub fn list_tasks(app: AppHandle) -> Result<Vec<Task>, String> {
    let conn = open_db(&app)?;
    let now = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    let mut tasks = list_tasks_from_db(&conn).map_err(|error| error.to_string())?;
    for task in &mut tasks {
        task.deadline_state = task.compute_deadline_state(&now);
    }
    Ok(tasks)
}

#[tauri::command]
pub fn create_task(app: AppHandle, input: CreateTaskInput) -> Result<Task, String> {
    let conn = open_db(&app)?;
    let now = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    let id = format!("task_{}", Utc::now().timestamp_millis());

    insert_task(
        &conn,
        NewTask {
            id: id.clone(),
            title: input.title,
            flags: input.flags.clamp(0, 10),
            progress: 0,
            automatic_progress: 0,
            manual_override: false,
            deadline: None,
            notes: None,
            bound_folder: None,
            connection: ConnectionState::Unbound,
            created_at: now.clone(),
            updated_at: now,
            steps: vec![],
        },
    )
    .map_err(|error| error.to_string())?;

    let tasks = list_tasks_from_db(&conn).map_err(|error| error.to_string())?;
    let now = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    let created = tasks
        .into_iter()
        .find(|task| task.id == id)
        .map(|mut task| {
            task.deadline_state = task.compute_deadline_state(&now);
            task
        })
        .ok_or_else(|| "created task not found".to_string())?;

    try_send_sync(SyncEvent::TaskChanged {
        action: "created".into(),
        task: created.clone(),
    });

    Ok(created)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BindFolderInput {
    pub task_id: String,
    pub title: String,
    pub folder: String,
}

#[tauri::command]
pub fn bind_folder(app: AppHandle, input: BindFolderInput) -> Result<(), String> {
    let now = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    let manifest = BindingManifest {
        protocol_version: 1,
        task_id: input.task_id.clone(),
        title: input.title,
        bound_at: now,
        app: "PinPulse Desktop".into(),
    };
    bind_folder_files(std::path::Path::new(&input.folder), &manifest)?;

    let conn = open_db(&app)?;
    let patch = serde_json::json!({
        "boundFolder": input.folder,
        "connection": "healthy",
    });
    update_task_in_db(&conn, &input.task_id, &patch).map_err(|error| error.to_string())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoundFolderRefresh {
    pub events: Vec<ProgressEvent>,
    pub markdown_progress: CheckboxProgress,
    pub agent_status: AgentStatusReadResult,
}

#[tauri::command]
pub fn refresh_bound_folder(folder: String) -> Result<BoundFolderRefresh, String> {
    let root = std::path::Path::new(&folder);
    let events = read_progress_jsonl(&root.join(".agent-progress/progress.jsonl"))?;

    let mut markdown = String::new();
    for file_name in ["PLAN.md"] {
        let path = root.join(file_name);
        if path.exists() {
            markdown.push_str(&fs::read_to_string(path).map_err(|error| error.to_string())?);
            markdown.push('\n');
        }
    }

    Ok(BoundFolderRefresh {
        events,
        markdown_progress: checkbox_progress(&markdown),
        agent_status: read_agent_status(root)?,
    })
}

#[tauri::command]
pub fn git_status(folder: String) -> GitStatusSummary {
    sample_git_status(std::path::Path::new(&folder))
}

#[tauri::command]
pub fn update_task(app: AppHandle, id: String, patch: serde_json::Value) -> Result<(), String> {
    let conn = open_db(&app)?;
    update_task_in_db(&conn, &id, &patch).map_err(|error| error.to_string())?;

    if let Ok(Some(updated)) = get_task_by_id(&conn, &id) {
        let archiving = patch
            .get("archived")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        try_send_sync(SyncEvent::TaskChanged {
            action: if archiving { "deleted" } else { "updated" }.into(),
            task: updated,
        });
    }

    Ok(())
}

#[tauri::command]
pub fn delete_task(app: AppHandle, id: String) -> Result<(), String> {
    let conn = open_db(&app)?;
    let before = get_task_by_id(&conn, &id).unwrap_or(None);
    delete_task_from_db(&conn, &id).map_err(|error| error.to_string())?;
    if let Some(task) = before {
        try_send_sync(SyncEvent::TaskChanged {
            action: "deleted".into(),
            task,
        });
    }
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentHookConfig {
    pub config_json: String,
    pub target_path: String,
    pub agent: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateHookConfigInput {
    pub folder: String,
    pub agent: String,
}

#[tauri::command]
pub fn generate_agent_hook_config(input: GenerateHookConfigInput) -> Result<AgentHookConfig, String> {
    let (config_json, file_name) = match input.agent.as_str() {
        "claude" => (generate_claude_hook_config(), ".claude/settings.json"),
        "codex" => (generate_codex_hook_config(), ".codex/hooks.json"),
        "codex-notify" => (generate_codex_notify_config(), "~/.codex/config.toml"),
        other => return Err(format!("unsupported agent: {other}")),
    };

    let target_path = std::path::Path::new(&input.folder)
        .join(file_name)
        .to_string_lossy()
        .into();

    Ok(AgentHookConfig {
        config_json,
        target_path,
        agent: input.agent,
    })
}

#[tauri::command]
pub fn watch_agent_status(app: tauri::AppHandle, folder: String) -> Result<(), String> {
    start_agent_status_watcher(app, std::path::Path::new(&folder))
}

#[tauri::command]
pub fn start_sync_server(app: tauri::AppHandle, port: u16) -> Result<(), String> {
    sync::init_sync_channel();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = sync::run_sync_server(app, port).await {
            eprintln!("start_sync_server: {}", e);
        }
    });
    Ok(())
}

#[tauri::command]
pub fn connect_sync_client(app: tauri::AppHandle, host: String, port: u16) -> Result<(), String> {
    sync::init_sync_channel();
    tauri::async_runtime::spawn(async move {
        sync::run_sync_client(app, host, port).await;
    });
    Ok(())
}
