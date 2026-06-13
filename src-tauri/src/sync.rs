use crate::db;
use crate::models::Task;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncRead, AsyncWrite};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SyncMessage {
    Hello {
        client_name: String,
        tasks_hash: String,
    },
    Welcome {
        server_name: String,
    },
    SyncFull {
        tasks: Vec<Task>,
    },
    TaskChanged {
        action: String,
        task: Task,
    },
    AgentStatus {
        task_id: String,
        status: AgentStatusPayload,
    },
    Ping,
    Pong,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatusPayload {
    pub state: String,
    pub agent: String,
    pub session_id: Option<String>,
    pub last_event: Option<String>,
    pub last_seen_at: String,
}

#[derive(Debug, Clone)]
pub enum SyncEvent {
    TaskChanged { action: String, task: Task },
    AgentStatus { task_id: String, status: AgentStatusPayload },
}

// ---------------------------------------------------------------------------
// Global outgoing channel
// ---------------------------------------------------------------------------

type OutgoingTx = mpsc::UnboundedSender<SyncMessage>;

static OUTGOING: OnceLock<Mutex<Option<OutgoingTx>>> = OnceLock::new();

fn set_outgoing(tx: OutgoingTx) {
    if let Some(mutex) = OUTGOING.get() {
        if let Ok(mut guard) = mutex.lock() {
            *guard = Some(tx);
        }
    }
}

fn clear_outgoing() {
    if let Some(mutex) = OUTGOING.get() {
        if let Ok(mut guard) = mutex.lock() {
            *guard = None;
        }
    }
}

fn send_outgoing(msg: SyncMessage) {
    if let Some(mutex) = OUTGOING.get() {
        if let Ok(guard) = mutex.lock() {
            if let Some(tx) = &*guard {
                let _ = tx.send(msg);
            } else {
                eprintln!("[sync] send_outgoing: channel is None, dropping message");
            }
        }
    } else {
        eprintln!("[sync] send_outgoing: OUTGOING OnceLock not initialized");
    }
}

pub fn init_sync_channel() {
    OUTGOING.set(Mutex::new(None)).ok();
}

pub fn try_send_sync(event: SyncEvent) {
    let msg = match event {
        SyncEvent::TaskChanged { action, task } => SyncMessage::TaskChanged { action, task },
        SyncEvent::AgentStatus { task_id, status } => SyncMessage::AgentStatus { task_id, status },
    };
    send_outgoing(msg);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn open_sync_db(app: &AppHandle) -> Result<rusqlite::Connection, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    rusqlite::Connection::open(dir.join("pinpulse.sqlite3")).map_err(|e| e.to_string())
}

fn compute_hash(app: &AppHandle) -> String {
    let conn = match open_sync_db(app) {
        Ok(c) => c,
        Err(_) => return String::new(),
    };
    let tasks = db::list_tasks(&conn).unwrap_or_default();
    let mut count = 0usize;
    let mut last = String::new();
    for t in &tasks {
        count += 1;
        last = format!("{}@{}", t.id, t.updated_at);
    }
    format!("{}-{}", count, last)
}

fn hostname() -> &'static str {
    std::env::consts::OS
}

// ---------------------------------------------------------------------------
// Incoming message handler
// ---------------------------------------------------------------------------

fn handle_incoming(app: &AppHandle, msg: SyncMessage) {
    match msg {
        SyncMessage::Hello {
            client_name: _,
            tasks_hash,
        } => {
            let local_hash = compute_hash(app);
            if tasks_hash != local_hash {
                let conn = match open_sync_db(app) {
                    Ok(c) => c,
                    Err(_) => return,
                };
                let tasks = db::list_tasks(&conn).unwrap_or_default();
                send_outgoing(SyncMessage::SyncFull { tasks });
            } else {
                send_outgoing(SyncMessage::Welcome {
                    server_name: hostname().into(),
                });
            }
        }

        SyncMessage::Welcome { .. } => {}

        SyncMessage::SyncFull { tasks } => {
            let conn = match open_sync_db(app) {
                Ok(c) => c,
                Err(_) => return,
            };
            for remote in &tasks {
                upsert_task(&conn, remote);
            }
            let _ = app.emit("sync-tasks-updated", ());
        }

        SyncMessage::TaskChanged { action, task } => {
            let conn = match open_sync_db(app) {
                Ok(c) => c,
                Err(_) => return,
            };
            match action.as_str() {
                "deleted" => {
                    let _ = db::delete_task(&conn, &task.id);
                }
                _ => {
                    upsert_task(&conn, &task);
                }
            }
            let _ = app.emit("sync-tasks-updated", ());
        }

        SyncMessage::AgentStatus { task_id, status } => {
            eprintln!("[sync] received AgentStatus via WS: task_id={} state={} agent={}", task_id, status.state, status.agent);
            let _ = app.emit(
                "sync-agent-status",
                serde_json::json!({ "taskId": task_id, "status": status }),
            );
            eprintln!("[sync] emitted sync-agent-status event for task_id={}", task_id);
        }

        SyncMessage::Ping => {
            send_outgoing(SyncMessage::Pong);
        }

        SyncMessage::Pong => {}
    }
}

fn upsert_task(conn: &rusqlite::Connection, remote: &Task) {
    let patch = serde_json::json!({
        "title": remote.title,
        "flags": remote.flags,
        "progress": remote.progress,
        "automaticProgress": remote.automatic_progress,
        "manualOverride": remote.manual_override,
        "deadline": remote.deadline,
        "boundFolder": remote.bound_folder,
        "connection": remote.connection.as_str(),
        "notes": remote.notes,
        "steps": remote.steps,
        "archived": remote.archived,
    });

    match db::get_task_by_id(conn, &remote.id) {
        Ok(Some(local)) if remote.updated_at <= local.updated_at => {} // skip, local is newer
        Ok(Some(_)) => {
            let _ = db::update_task(conn, &remote.id, &patch);
        }
        _ => {
            let new_task = crate::models::NewTask {
                id: remote.id.clone(),
                title: remote.title.clone(),
                flags: remote.flags,
                progress: remote.progress,
                automatic_progress: remote.automatic_progress,
                manual_override: remote.manual_override,
                deadline: remote.deadline.clone(),
                notes: remote.notes.clone(),
                bound_folder: remote.bound_folder.clone(),
                connection: remote.connection.clone(),
                created_at: remote.created_at.clone(),
                updated_at: remote.updated_at.clone(),
                steps: remote.steps.clone(),
            };
            let _ = db::insert_task(conn, new_task);
        }
    }
}

// ---------------------------------------------------------------------------
// Connection handler
// ---------------------------------------------------------------------------

async fn handle_connection<S>(
    app: AppHandle,
    ws_stream: tokio_tungstenite::WebSocketStream<S>,
)
where
    S: AsyncRead + AsyncWrite + Unpin + Send + 'static,
{
    let (mut ws_write, mut ws_read) = ws_stream.split();

    // Set up outgoing channel
    let (tx, mut rx) = mpsc::unbounded_channel::<SyncMessage>();
    set_outgoing(tx);

    // Send hello
    let hash = compute_hash(&app);
    let hello = SyncMessage::Hello {
        client_name: hostname().into(),
        tasks_hash: hash,
    };
    if let Ok(json) = serde_json::to_string(&hello) {
        let _ = ws_write.send(Message::Text(json.into())).await;
    }

    let mut ping_timer = tokio::time::interval(std::time::Duration::from_secs(10));

    loop {
        tokio::select! {
            // Read from WebSocket
            msg = ws_read.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(sync_msg) = serde_json::from_str::<SyncMessage>(&text) {
                            handle_incoming(&app, sync_msg);
                        }
                    }
                    Some(Ok(Message::Ping(data))) => {
                        let _ = ws_write.send(Message::Pong(data)).await;
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Err(e)) => {
                        eprintln!("Sync WS read error: {}", e);
                        break;
                    }
                    _ => {}
                }
            }

            // Write outgoing messages from local events
            outgoing = rx.recv() => {
                match outgoing {
                    Some(msg) => {
                        if let Ok(json) = serde_json::to_string(&msg) {
                            if ws_write.send(Message::Text(json.into())).await.is_err() {
                                break;
                            }
                        }
                    }
                    None => break,
                }
            }

            // Periodic ping
            _ = ping_timer.tick() => {
                if let Ok(json) = serde_json::to_string(&SyncMessage::Ping) {
                    if ws_write.send(Message::Text(json.into())).await.is_err() {
                        break;
                    }
                }
            }
        }
    }

    clear_outgoing();
    let _ = app.emit("sync-connection-status", "disconnected");
}

// ---------------------------------------------------------------------------
// Server mode
// ---------------------------------------------------------------------------

pub async fn run_sync_server(app: AppHandle, port: u16) -> Result<(), String> {
    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| format!("bind {}: {}", addr, e))?;

    eprintln!("Sync server listening on {}", addr);

    tokio::spawn(async move {
        loop {
            match listener.accept().await {
                Ok((stream, _peer)) => {
                    match tokio_tungstenite::accept_async(stream).await {
                        Ok(ws) => {
                            let app = app.clone();
                            tokio::spawn(async move {
                                handle_connection(app, ws).await;
                            });
                        }
                        Err(e) => {
                            eprintln!("Sync server WS accept: {}", e);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Sync server accept: {}", e);
                }
            }
        }
    });

    Ok(())
}

// ---------------------------------------------------------------------------
// Client mode (with auto-reconnect)
// ---------------------------------------------------------------------------

pub async fn run_sync_client(app: AppHandle, host: String, port: u16) {
    let url = format!("ws://{}:{}", host, port);

    loop {
        match tokio_tungstenite::connect_async(&url).await {
            Ok((ws, _)) => {
                let _ = app.emit("sync-connection-status", "connected");
                handle_connection(app.clone(), ws).await;
            }
            Err(e) => {
                eprintln!("Sync client connect error: {} (retrying in 3s)", e);
                let _ = app.emit("sync-connection-status", "disconnected");
            }
        }

        tokio::time::sleep(std::time::Duration::from_secs(3)).await;
    }
}
