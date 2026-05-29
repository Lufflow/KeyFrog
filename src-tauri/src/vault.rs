use std::{fs, path::PathBuf, sync::Mutex};

use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use tauri::{AppHandle, State};
use uuid::Uuid;
use zeroize::Zeroize;

use crate::{
    crypto::{
        decrypt, derive_key, encrypt, random_array, zeroize_key, EncryptedBlob, KEY_LEN, SALT_LEN,
    },
    db,
    error::{to_command_error, AppError, AppResult},
    models::{EntryInput, EntrySecret, VaultEntry},
};

const META_SCHEMA_VERSION: &str = "schema_version";
const META_KDF_SALT: &str = "kdf_salt";
const META_ENCRYPTED_DEK_NONCE: &str = "encrypted_dek_nonce";
const META_ENCRYPTED_DEK: &str = "encrypted_dek";
const SCHEMA_VERSION: &[u8] = b"1";

#[derive(Default)]
pub struct VaultState {
    inner: Mutex<Option<UnlockedVault>>,
}

struct UnlockedVault {
    db_path: PathBuf,
    data_key: [u8; KEY_LEN],
}

impl Drop for UnlockedVault {
    fn drop(&mut self) {
        self.data_key.zeroize();
    }
}

#[tauri::command]
pub fn vault_exists(app: AppHandle) -> Result<bool, String> {
    db::vault_path(&app)
        .map(|path| path.exists())
        .map_err(to_command_error)
}

#[tauri::command]
pub fn initialize_vault(
    app: AppHandle,
    state: State<'_, VaultState>,
    master_password: String,
) -> Result<(), String> {
    initialize(app, &state, master_password).map_err(to_command_error)
}

#[tauri::command]
pub fn unlock_vault(
    app: AppHandle,
    state: State<'_, VaultState>,
    master_password: String,
) -> Result<(), String> {
    unlock(app, &state, master_password).map_err(to_command_error)
}

#[tauri::command]
pub fn lock_vault(state: State<'_, VaultState>) -> Result<(), String> {
    let mut guard = state
        .inner
        .lock()
        .map_err(|_| "failed to lock vault state".to_string())?;
    *guard = None;
    Ok(())
}

#[tauri::command]
pub fn reset_vault(app: AppHandle, state: State<'_, VaultState>) -> Result<(), String> {
    reset(app, &state).map_err(to_command_error)
}

#[tauri::command]
pub fn list_entries(state: State<'_, VaultState>) -> Result<Vec<VaultEntry>, String> {
    list(&state).map_err(to_command_error)
}

#[tauri::command]
pub fn create_entry(state: State<'_, VaultState>, input: EntryInput) -> Result<VaultEntry, String> {
    create(&state, input).map_err(to_command_error)
}

#[tauri::command]
pub fn update_entry(
    state: State<'_, VaultState>,
    id: String,
    input: EntryInput,
) -> Result<VaultEntry, String> {
    update(&state, id, input).map_err(to_command_error)
}

#[tauri::command]
pub fn delete_entry(state: State<'_, VaultState>, id: String) -> Result<(), String> {
    delete(&state, id).map_err(to_command_error)
}

fn initialize(
    app: AppHandle,
    state: &State<'_, VaultState>,
    master_password: String,
) -> AppResult<()> {
    validate_master_password(&master_password)?;

    let db_path = db::vault_path(&app)?;
    if db_path.exists() {
        return Err(AppError::VaultAlreadyExists);
    }

    let connection = db::open_connection(&db_path)?;
    db::initialize_schema(&connection)?;

    let salt = random_array::<SALT_LEN>();
    let mut key_encryption_key = derive_key(&master_password, &salt)?;
    let data_key = random_array::<KEY_LEN>();
    let encrypted_data_key = encrypt(&key_encryption_key, &data_key)?;
    zeroize_key(&mut key_encryption_key);

    db::set_meta(&connection, META_SCHEMA_VERSION, SCHEMA_VERSION)?;
    db::set_meta(&connection, META_KDF_SALT, &salt)?;
    db::set_meta(
        &connection,
        META_ENCRYPTED_DEK_NONCE,
        &encrypted_data_key.nonce,
    )?;
    db::set_meta(
        &connection,
        META_ENCRYPTED_DEK,
        &encrypted_data_key.ciphertext,
    )?;

    set_unlocked(state, db_path, data_key)
}

fn unlock(app: AppHandle, state: &State<'_, VaultState>, master_password: String) -> AppResult<()> {
    let db_path = db::vault_path(&app)?;
    if !db_path.exists() {
        return Err(AppError::VaultNotFound);
    }

    let connection = db::open_connection(&db_path)?;
    db::initialize_schema(&connection)?;

    let salt = require_meta(&connection, META_KDF_SALT)?;
    let encrypted_data_key = EncryptedBlob {
        nonce: require_meta(&connection, META_ENCRYPTED_DEK_NONCE)?,
        ciphertext: require_meta(&connection, META_ENCRYPTED_DEK)?,
    };

    let mut key_encryption_key = derive_key(&master_password, &salt)?;
    let data_key_bytes = decrypt(&key_encryption_key, &encrypted_data_key)?;
    zeroize_key(&mut key_encryption_key);

    let data_key: [u8; KEY_LEN] = data_key_bytes
        .as_slice()
        .try_into()
        .map_err(|_| AppError::Crypto("invalid stored data key".to_string()))?;

    set_unlocked(state, db_path, data_key)
}

fn reset(app: AppHandle, state: &State<'_, VaultState>) -> AppResult<()> {
    {
        let mut guard = state
            .inner
            .lock()
            .map_err(|_| AppError::Validation("failed to lock vault state".to_string()))?;
        *guard = None;
    }

    let db_path = db::vault_path(&app)?;
    if db_path.exists() {
        fs::remove_file(db_path)?;
    }

    Ok(())
}

fn list(state: &State<'_, VaultState>) -> AppResult<Vec<VaultEntry>> {
    let (db_path, data_key) = unlocked_snapshot(state)?;
    let connection = db::open_connection(&db_path)?;

    let mut statement = connection.prepare(
        r#"
        SELECT id, nonce, ciphertext, created_at, updated_at
        FROM entries
        ORDER BY updated_at DESC
        "#,
    )?;

    let rows = statement.query_map([], |row| {
        Ok(EncryptedEntryRow {
            id: row.get(0)?,
            nonce: row.get(1)?,
            ciphertext: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
        })
    })?;

    let mut entries = Vec::new();
    for row in rows {
        entries.push(decrypt_entry(row?, &data_key)?);
    }

    Ok(entries)
}

fn create(state: &State<'_, VaultState>, input: EntryInput) -> AppResult<VaultEntry> {
    validate_entry_input(&input)?;

    let (db_path, data_key) = unlocked_snapshot(state)?;
    let connection = db::open_connection(&db_path)?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let payload = EntrySecret {
        service_name: input.service_name.trim().to_string(),
        login: input.login.trim().to_string(),
        password: input.password,
    };
    let encrypted = encrypt_entry_payload(&data_key, &payload)?;

    connection.execute(
        r#"
        INSERT INTO entries (id, nonce, ciphertext, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
        "#,
        params![id, encrypted.nonce, encrypted.ciphertext, now, now],
    )?;

    Ok(VaultEntry {
        id,
        service_name: payload.service_name,
        login: payload.login,
        password: payload.password,
        created_at: now.clone(),
        updated_at: now,
    })
}

fn update(state: &State<'_, VaultState>, id: String, input: EntryInput) -> AppResult<VaultEntry> {
    validate_entry_input(&input)?;

    let (db_path, data_key) = unlocked_snapshot(state)?;
    let connection = db::open_connection(&db_path)?;
    let created_at = connection
        .query_row(
            "SELECT created_at FROM entries WHERE id = ?1",
            params![id],
            |row| row.get::<_, String>(0),
        )
        .optional()?
        .ok_or(AppError::VaultNotFound)?;

    let updated_at = Utc::now().to_rfc3339();
    let payload = EntrySecret {
        service_name: input.service_name.trim().to_string(),
        login: input.login.trim().to_string(),
        password: input.password,
    };
    let encrypted = encrypt_entry_payload(&data_key, &payload)?;

    connection.execute(
        r#"
        UPDATE entries
        SET nonce = ?1, ciphertext = ?2, updated_at = ?3
        WHERE id = ?4
        "#,
        params![encrypted.nonce, encrypted.ciphertext, updated_at, id],
    )?;

    Ok(VaultEntry {
        id,
        service_name: payload.service_name,
        login: payload.login,
        password: payload.password,
        created_at,
        updated_at,
    })
}

fn delete(state: &State<'_, VaultState>, id: String) -> AppResult<()> {
    let (db_path, _) = unlocked_snapshot(state)?;
    let connection = db::open_connection(&db_path)?;
    let changed = connection.execute("DELETE FROM entries WHERE id = ?1", params![id])?;

    if changed == 0 {
        return Err(AppError::VaultNotFound);
    }

    Ok(())
}

fn encrypt_entry_payload(
    data_key: &[u8; KEY_LEN],
    payload: &EntrySecret,
) -> AppResult<EncryptedBlob> {
    let plaintext = serde_json::to_vec(payload)?;
    encrypt(data_key, &plaintext)
}

fn decrypt_entry(row: EncryptedEntryRow, data_key: &[u8; KEY_LEN]) -> AppResult<VaultEntry> {
    let plaintext = decrypt(
        data_key,
        &EncryptedBlob {
            nonce: row.nonce,
            ciphertext: row.ciphertext,
        },
    )?;
    let secret: EntrySecret = serde_json::from_slice(&plaintext)?;

    Ok(VaultEntry {
        id: row.id,
        service_name: secret.service_name,
        login: secret.login,
        password: secret.password,
        created_at: row.created_at,
        updated_at: row.updated_at,
    })
}

fn require_meta(connection: &rusqlite::Connection, key: &str) -> AppResult<Vec<u8>> {
    db::get_meta(connection, key)?.ok_or(AppError::VaultNotFound)
}

fn set_unlocked(
    state: &State<'_, VaultState>,
    db_path: PathBuf,
    data_key: [u8; KEY_LEN],
) -> AppResult<()> {
    let mut guard = state
        .inner
        .lock()
        .map_err(|_| AppError::Validation("failed to lock vault state".to_string()))?;
    *guard = Some(UnlockedVault { db_path, data_key });
    Ok(())
}

fn unlocked_snapshot(state: &State<'_, VaultState>) -> AppResult<(PathBuf, [u8; KEY_LEN])> {
    let guard = state
        .inner
        .lock()
        .map_err(|_| AppError::Validation("failed to lock vault state".to_string()))?;
    let vault = guard.as_ref().ok_or(AppError::VaultLocked)?;
    Ok((vault.db_path.clone(), vault.data_key))
}

fn validate_master_password(master_password: &str) -> AppResult<()> {
    if master_password.len() < 12 {
        return Err(AppError::Validation(
            "master password must contain at least 12 characters".to_string(),
        ));
    }

    Ok(())
}

fn validate_entry_input(input: &EntryInput) -> AppResult<()> {
    if input.service_name.trim().is_empty() {
        return Err(AppError::Validation(
            "service name cannot be empty".to_string(),
        ));
    }
    if input.login.trim().is_empty() {
        return Err(AppError::Validation("login cannot be empty".to_string()));
    }
    if input.password.is_empty() {
        return Err(AppError::Validation("password cannot be empty".to_string()));
    }

    Ok(())
}

struct EncryptedEntryRow {
    id: String,
    nonce: Vec<u8>,
    ciphertext: Vec<u8>,
    created_at: String,
    updated_at: String,
}
