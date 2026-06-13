use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct CheckboxProgress {
    pub completed: i64,
    pub total: i64,
    pub progress: i64,
}

pub fn checkbox_progress(markdown: &str) -> CheckboxProgress {
    let mut completed = 0;
    let mut total = 0;

    for line in markdown.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("- [ ] ") || trimmed.starts_with("* [ ] ") {
            total += 1;
        } else if trimmed.starts_with("- [x] ")
            || trimmed.starts_with("- [X] ")
            || trimmed.starts_with("* [x] ")
            || trimmed.starts_with("* [X] ")
        {
            total += 1;
            completed += 1;
        }
    }

    CheckboxProgress {
        completed,
        total,
        progress: if total == 0 {
            0
        } else {
            ((completed as f64 / total as f64) * 100.0).round() as i64
        },
    }
}
