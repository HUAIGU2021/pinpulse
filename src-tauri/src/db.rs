use crate::models::{ConnectionState, NewTask, ProgressStep, Task};
use rusqlite::{params, Connection, Result};

pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        create table if not exists tasks (
            id text primary key,
            title text not null,
            flags integer not null,
            progress integer not null,
            automatic_progress integer not null,
            manual_override integer not null,
            deadline text,
            bound_folder text,
            connection text not null,
            created_at text not null,
            updated_at text not null,
            archived integer not null default 0,
            notes text,
            steps text not null default '[]'
        );
        ",
    )?;
    conn.execute_batch("alter table tasks add column steps text not null default '[]'")
        .ok();
    conn.execute_batch("alter table tasks add column notes text")
        .ok();
    Ok(())
}

pub fn insert_task(conn: &Connection, task: NewTask) -> Result<()> {
    let steps_json = serde_json::to_string(&task.steps).unwrap_or_else(|_| "[]".into());
    conn.execute(
        "
        insert into tasks (
            id, title, flags, progress, automatic_progress, manual_override,
            deadline, bound_folder, connection, created_at, updated_at, archived, notes, steps
        ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0, ?12, ?13)
        ",
        params![
            task.id,
            task.title,
            task.flags,
            task.progress,
            task.automatic_progress,
            task.manual_override as i64,
            task.deadline,
            task.bound_folder,
            task.connection.as_str(),
            task.created_at,
            task.updated_at,
            task.notes,
            steps_json,
        ],
    )?;
    Ok(())
}

fn parse_steps(raw: &str) -> Vec<ProgressStep> {
    serde_json::from_str(raw).unwrap_or_default()
}

pub fn list_tasks(conn: &Connection) -> Result<Vec<Task>> {
    let mut stmt = conn.prepare(
        "
        select id, title, flags, progress, automatic_progress, manual_override,
               deadline, bound_folder, connection, created_at, updated_at, archived, notes, steps
        from tasks
        where archived = 0
        order by flags desc, datetime(created_at) asc
        ",
    )?;

    let rows = stmt.query_map([], |row| {
        let connection: String = row.get(8)?;
        let steps_raw: String = row.get::<_, String>(13).unwrap_or_else(|_| "[]".into());
        Ok(Task {
            id: row.get(0)?,
            title: row.get(1)?,
            flags: row.get(2)?,
            progress: row.get(3)?,
            automatic_progress: row.get(4)?,
            manual_override: row.get::<_, i64>(5)? == 1,
            deadline: row.get(6)?,
            deadline_state: crate::reminder::DeadlineState::None,
            bound_folder: row.get(7)?,
            connection: ConnectionState::from_str(&connection),
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
            notes: row.get(12)?,
            archived: row.get::<_, i64>(11)? == 1,
            steps: parse_steps(&steps_raw),
        })
    })?;

    rows.collect()
}

pub fn update_task(conn: &Connection, id: &str, patch: &serde_json::Value) -> Result<()> {
    if let Some(title) = patch.get("title").and_then(|v| v.as_str()) {
        conn.execute(
            "update tasks set title = ?1 where id = ?2",
            params![title, id],
        )?;
    }
    if let Some(flags) = patch.get("flags").and_then(|v| v.as_i64()) {
        conn.execute(
            "update tasks set flags = ?1 where id = ?2",
            params![flags, id],
        )?;
    }
    if let Some(progress) = patch.get("progress").and_then(|v| v.as_i64()) {
        conn.execute(
            "update tasks set progress = ?1 where id = ?2",
            params![progress, id],
        )?;
    }
    if let Some(automatic_progress) = patch.get("automaticProgress").and_then(|v| v.as_i64()) {
        conn.execute(
            "update tasks set automatic_progress = ?1 where id = ?2",
            params![automatic_progress, id],
        )?;
    }
    if let Some(manual_override) = patch.get("manualOverride").and_then(|v| v.as_bool()) {
        conn.execute(
            "update tasks set manual_override = ?1 where id = ?2",
            params![manual_override as i64, id],
        )?;
    }
    if let Some(deadline) = patch.get("deadline").and_then(|v| v.as_str()) {
        conn.execute(
            "update tasks set deadline = ?1 where id = ?2",
            params![deadline, id],
        )?;
    }
    if let Some(bound_folder) = patch.get("boundFolder").and_then(|v| v.as_str()) {
        conn.execute(
            "update tasks set bound_folder = ?1 where id = ?2",
            params![bound_folder, id],
        )?;
    }
    if let Some(connection) = patch.get("connection").and_then(|v| v.as_str()) {
        conn.execute(
            "update tasks set connection = ?1 where id = ?2",
            params![connection, id],
        )?;
    }
    if let Some(notes) = patch.get("notes").and_then(|v| v.as_str()) {
        conn.execute(
            "update tasks set notes = ?1 where id = ?2",
            params![notes, id],
        )?;
    }
    if let Some(steps) = patch.get("steps") {
        let steps_json = serde_json::to_string(steps).unwrap_or_else(|_| "[]".into());
        conn.execute(
            "update tasks set steps = ?1 where id = ?2",
            params![steps_json, id],
        )?;
    }
    if let Some(archived) = patch.get("archived").and_then(|v| v.as_bool()) {
        conn.execute(
            "update tasks set archived = ?1 where id = ?2",
            params![archived as i64, id],
        )?;
    }
    let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    conn.execute(
        "update tasks set updated_at = ?1 where id = ?2",
        params![now, id],
    )?;
    Ok(())
}

pub fn delete_task(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("delete from tasks where id = ?1", params![id])?;
    Ok(())
}

pub fn get_task_by_id(conn: &Connection, id: &str) -> Result<Option<Task>> {
    let mut stmt = conn.prepare(
        "
        select id, title, flags, progress, automatic_progress, manual_override,
               deadline, bound_folder, connection, created_at, updated_at, archived, notes, steps
        from tasks where id = ?1
        ",
    )?;

    let mut rows = stmt.query_map(params![id], |row| {
        let connection: String = row.get(8)?;
        let steps_raw: String = row.get::<_, String>(13).unwrap_or_else(|_| "[]".into());
        Ok(Task {
            id: row.get(0)?,
            title: row.get(1)?,
            flags: row.get(2)?,
            progress: row.get(3)?,
            automatic_progress: row.get(4)?,
            manual_override: row.get::<_, i64>(5)? == 1,
            deadline: row.get(6)?,
            deadline_state: crate::reminder::DeadlineState::None,
            bound_folder: row.get(7)?,
            connection: ConnectionState::from_str(&connection),
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
            notes: row.get(12)?,
            archived: row.get::<_, i64>(11)? == 1,
            steps: parse_steps(&steps_raw),
        })
    })?;

    match rows.next() {
        Some(Ok(task)) => Ok(Some(task)),
        Some(Err(e)) => Err(e),
        None => Ok(None),
    }
}
