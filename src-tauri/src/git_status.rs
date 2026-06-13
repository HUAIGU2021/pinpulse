use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusSummary {
    pub dirty_count: i64,
    pub staged_count: i64,
    pub branch: Option<String>,
}

pub fn parse_porcelain_status(output: &str) -> GitStatusSummary {
    let mut dirty_count = 0;
    let mut staged_count = 0;

    for line in output.lines() {
        if line.trim().is_empty() {
            continue;
        }
        dirty_count += 1;
        let staged = line.chars().next().unwrap_or(' ');
        if staged != ' ' && staged != '?' {
            staged_count += 1;
        }
    }

    GitStatusSummary {
        dirty_count,
        staged_count,
        branch: None,
    }
}

pub fn sample_git_status(folder: &Path) -> GitStatusSummary {
    let output = Command::new("git")
        .arg("-C")
        .arg(folder)
        .arg("status")
        .arg("--porcelain")
        .output();

    let Ok(output) = output else {
        return GitStatusSummary {
            dirty_count: 0,
            staged_count: 0,
            branch: None,
        };
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_porcelain_status(&stdout)
}
