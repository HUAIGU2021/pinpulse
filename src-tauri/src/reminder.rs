use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeadlineState {
    None,
    Normal,
    Approaching,
    DueSoon,
    Overdue,
}

pub fn deadline_state(deadline: Option<&str>, now: &str) -> DeadlineState {
    let Some(deadline) = deadline else {
        return DeadlineState::None;
    };

    let Ok(deadline_time) =
        DateTime::parse_from_rfc3339(deadline).map(|value| value.with_timezone(&Utc))
    else {
        return DeadlineState::None;
    };

    let Ok(now_time) = DateTime::parse_from_rfc3339(now).map(|value| value.with_timezone(&Utc))
    else {
        return DeadlineState::None;
    };

    if deadline_time < now_time {
        DeadlineState::Overdue
    } else if deadline_time - now_time <= Duration::hours(24) {
        DeadlineState::DueSoon
    } else if deadline_time - now_time <= Duration::hours(48) {
        DeadlineState::Approaching
    } else {
        DeadlineState::Normal
    }
}
