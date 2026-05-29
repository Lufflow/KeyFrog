mod crypto;
mod db;
mod error;
mod generator;
mod models;
mod vault;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .manage(vault::VaultState::default())
        .invoke_handler(tauri::generate_handler![
            vault::vault_exists,
            vault::initialize_vault,
            vault::unlock_vault,
            vault::lock_vault,
            vault::reset_vault,
            vault::list_entries,
            vault::create_entry,
            vault::update_entry,
            vault::delete_entry,
            generator::generate_password
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
