#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    local_password_manager_lib::run();
}
