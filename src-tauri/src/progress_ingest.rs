use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub text: Option<String>,
    pub progress: Option<i64>,
    pub state: Option<String>,
    pub message: Option<String>,
    pub source: Option<String>,
    pub ts: Option<String>,
}

fn is_valid_event(event: &ProgressEvent) -> bool {
    let known = matches!(
        event.event_type.as_str(),
        "step_added"
            | "step_updated"
            | "step_completed"
            | "step_uncompleted"
            | "progress_updated"
            | "state_changed"
            | "deadline_updated"
            | "note_added"
    );
    if !known {
        return false;
    }
    if event.event_type == "progress_updated" {
        return event
            .progress
            .is_some_and(|value| (0..=100).contains(&value));
    }
    true
}

pub fn read_progress_jsonl(path: &Path) -> Result<Vec<ProgressEvent>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let events = content
        .lines()
        .filter_map(|line| serde_json::from_str::<ProgressEvent>(line).ok())
        .filter(is_valid_event)
        .collect();
    Ok(events)
}
