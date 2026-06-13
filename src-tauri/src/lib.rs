pub mod agent_status;
pub mod commands;
pub mod db;
pub mod folder_binding;
pub mod git_status;
pub mod markdown;
pub mod models;
pub mod progress_ingest;
pub mod reminder;
pub mod sync;

#[cfg(test)]
mod tests;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::list_tasks,
            commands::create_task,
            commands::bind_folder,
            commands::refresh_bound_folder,
            commands::git_status,
            commands::update_task,
            commands::delete_task,
            commands::generate_agent_hook_config,
            commands::watch_agent_status,
            commands::start_sync_server,
            commands::connect_sync_client
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
