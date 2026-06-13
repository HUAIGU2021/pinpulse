use crate::reminder::{deadline_state, DeadlineState};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionState {
    Unbound,
    Healthy,
    Warning,
}

impl ConnectionState {
    pub fn as_str(&self) -> &'static str {
        match self {
            ConnectionState::Unbound => "unbound",
            ConnectionState::Healthy => "healthy",
            ConnectionState::Warning => "warning",
        }
    }

    pub fn from_str(value: &str) -> Self {
        match value {
            "healthy" => ConnectionState::Healthy,
            "warning" => ConnectionState::Warning,
            _ => ConnectionState::Unbound,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressStep {
    pub id: String,
    pub text: String,
    pub completed: bool,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    pub flags: i64,
    pub progress: i64,
    pub automatic_progress: i64,
    pub manual_override: bool,
    pub deadline: Option<String>,
    pub deadline_state: DeadlineState,
    pub bound_folder: Option<String>,
    pub connection: ConnectionState,
    pub created_at: String,
    pub updated_at: String,
    pub notes: Option<String>,
    pub archived: bool,
    pub steps: Vec<ProgressStep>,
}

impl Task {
    pub fn compute_deadline_state(&self, now: &str) -> DeadlineState {
        deadline_state(self.deadline.as_deref(), now)
    }
}

#[derive(Debug, Clone)]
pub struct NewTask {
    pub id: String,
    pub title: String,
    pub flags: i64,
    pub progress: i64,
    pub automatic_progress: i64,
    pub manual_override: bool,
    pub deadline: Option<String>,
    pub bound_folder: Option<String>,
    pub connection: ConnectionState,
    pub created_at: String,
    pub notes: Option<String>,
    pub updated_at: String,
    pub steps: Vec<ProgressStep>,
}
