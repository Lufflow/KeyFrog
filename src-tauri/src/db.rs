use std::{fs, path::PathBuf};

use rusqlite::{params, Connection, OptionalExtension};
use tauri::{AppHandle, Manager};

use crate::error::AppResult;

pub const VAULT_FILE_NAME: &str = "vault.sqlite3";

pub fn vault_path(app: &AppHandle) -> AppResult<PathBuf> {
    let app_data_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&app_data_dir)?;
    Ok(app_data_dir.join(VAULT_FILE_NAME))
}

pub fn open_connection(path: &PathBuf) -> AppResult<Connection> {
    let connection = Connection::open(path)?;
    connection.pragma_update(None, "foreign_keys", "ON")?;
    Ok(connection)
}

pub fn initialize_schema(connection: &Connection) -> AppResult<()> {
    connection.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS vault_meta (
            key TEXT PRIMARY KEY,
            value BLOB NOT NULL
        );

        CREATE TABLE IF NOT EXISTS entries (
            id TEXT PRIMARY KEY,
            nonce BLOB NOT NULL,
            ciphertext BLOB NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        "#,
    )?;

    Ok(())
}

pub fn get_meta(connection: &Connection, key: &str) -> AppResult<Option<Vec<u8>>> {
    let value = connection
        .query_row(
            "SELECT value FROM vault_meta WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()?;

    Ok(value)
}

pub fn set_meta(connection: &Connection, key: &str, value: &[u8]) -> AppResult<()> {
    connection.execute(
        r#"
        INSERT INTO vault_meta (key, value)
        VALUES (?1, ?2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        "#,
        params![key, value],
    )?;

    Ok(())
}
