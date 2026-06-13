use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BindingManifest {
    pub protocol_version: i64,
    pub task_id: String,
    pub title: String,
    pub bound_at: String,
    pub app: String,
}

pub fn bind_folder_files(folder: &Path, manifest: &BindingManifest) -> Result<(), String> {
    let progress_dir = folder.join(".agent-progress");
    fs::create_dir_all(&progress_dir).map_err(|error| error.to_string())?;

    let manifest_json =
        serde_json::to_string_pretty(manifest).map_err(|error| error.to_string())?;
    fs::write(progress_dir.join("task.json"), manifest_json).map_err(|error| error.to_string())?;

    let mut events = OpenOptions::new()
        .create(true)
        .append(true)
        .open(progress_dir.join("progress.jsonl"))
        .map_err(|error| error.to_string())?;
    events.flush().map_err(|error| error.to_string())?;

    Ok(())
}
