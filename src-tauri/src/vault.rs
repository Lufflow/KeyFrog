use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

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
        .map(|path| vault_exists_at_path(&path))
        .map_err(to_command_error)
}

#[tauri::command]
pub fn initialize_vault(
    app: AppHandle,
    state: State<'_, VaultState>,
    master_password: String,
) -> Result<(), String> {
    db::vault_path(&app)
        .and_then(|db_path| initialize_at_path(&state, db_path, master_password))
        .map_err(to_command_error)
}

#[tauri::command]
pub fn unlock_vault(
    app: AppHandle,
    state: State<'_, VaultState>,
    master_password: String,
) -> Result<(), String> {
    db::vault_path(&app)
        .and_then(|db_path| unlock_at_path(&state, db_path, master_password))
        .map_err(to_command_error)
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
    db::vault_path(&app)
        .and_then(|db_path| reset_at_path(&state, &db_path))
        .map_err(to_command_error)
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

fn vault_exists_at_path(path: &Path) -> bool {
    path.exists()
}

fn initialize_at_path(
    state: &VaultState,
    db_path: PathBuf,
    master_password: String,
) -> AppResult<()> {
    validate_master_password(&master_password)?;

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

fn unlock_at_path(state: &VaultState, db_path: PathBuf, master_password: String) -> AppResult<()> {
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

fn reset_at_path(state: &VaultState, db_path: &Path) -> AppResult<()> {
    {
        let mut guard = state
            .inner
            .lock()
            .map_err(|_| AppError::Validation("failed to lock vault state".to_string()))?;
        *guard = None;
    }

    if db_path.exists() {
        fs::remove_file(db_path)?;
    }

    Ok(())
}

fn list(state: &VaultState) -> AppResult<Vec<VaultEntry>> {
    let (db_path, mut data_key) = unlocked_snapshot(state)?;
    let connection = db::open_connection(&db_path)?;

    let result = (|| {
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
    })();

    zeroize_key(&mut data_key);
    result
}

fn create(state: &VaultState, input: EntryInput) -> AppResult<VaultEntry> {
    validate_entry_input(&input)?;

    let (db_path, mut data_key) = unlocked_snapshot(state)?;
    let connection = db::open_connection(&db_path)?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let payload = EntrySecret {
        service_name: input.service_name.trim().to_string(),
        login: input.login.trim().to_string(),
        password: input.password,
    };
    let result = (|| {
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
    })();

    zeroize_key(&mut data_key);
    result
}

fn update(state: &VaultState, id: String, input: EntryInput) -> AppResult<VaultEntry> {
    validate_entry_input(&input)?;

    let (db_path, mut data_key) = unlocked_snapshot(state)?;
    let connection = db::open_connection(&db_path)?;
    let result = (|| {
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
    })();

    zeroize_key(&mut data_key);
    result
}

fn delete(state: &VaultState, id: String) -> AppResult<()> {
    let db_path = unlocked_db_path(state)?;
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

fn set_unlocked(state: &VaultState, db_path: PathBuf, data_key: [u8; KEY_LEN]) -> AppResult<()> {
    let mut guard = state
        .inner
        .lock()
        .map_err(|_| AppError::Validation("failed to lock vault state".to_string()))?;
    *guard = Some(UnlockedVault { db_path, data_key });
    Ok(())
}

fn unlocked_db_path(state: &VaultState) -> AppResult<PathBuf> {
    let guard = state
        .inner
        .lock()
        .map_err(|_| AppError::Validation("failed to lock vault state".to_string()))?;
    let vault = guard.as_ref().ok_or(AppError::VaultLocked)?;
    Ok(vault.db_path.clone())
}

fn unlocked_snapshot(state: &VaultState) -> AppResult<(PathBuf, [u8; KEY_LEN])> {
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

#[cfg(test)]
mod tests {
    use std::{env, fs, path::PathBuf};

    use super::*;

    struct TestVaultPath {
        path: PathBuf,
    }

    impl TestVaultPath {
        fn new() -> Self {
            let path = env::temp_dir().join(format!("keyfrog-test-{}.sqlite3", Uuid::new_v4()));
            if path.exists() {
                let _ = fs::remove_file(&path);
            }
            Self { path }
        }
    }

    impl Drop for TestVaultPath {
        fn drop(&mut self) {
            let _ = fs::remove_file(&self.path);
        }
    }

    fn sample_entry() -> EntryInput {
        EntryInput {
            service_name: "  Something  ".to_string(),
            login: "  login  ".to_string(),
            password: "super-secret".to_string(),
        }
    }

    fn lock_for_test(state: &VaultState) {
        let mut guard = state.inner.lock().expect("state mutex must lock");
        *guard = None;
    }

    fn file_contains_bytes(path: &Path, needle: &[u8]) -> bool {
        fs::read(path)
            .expect("database file must be readable")
            .windows(needle.len())
            .any(|window| window == needle)
    }

    #[test]
    fn initialize_rejects_short_master_password() {
        let state = VaultState::default();
        let vault_path = TestVaultPath::new();

        let error = initialize_at_path(&state, vault_path.path.clone(), "short".to_string())
            .expect_err("short password must be rejected");

        assert!(matches!(error, AppError::Validation(_)));
        assert!(!vault_exists_at_path(&vault_path.path));
    }

    #[test]
    fn vault_lifecycle_round_trip_works() {
        let state = VaultState::default();
        let vault_path = TestVaultPath::new();
        let master_password = "correct horse battery".to_string();

        initialize_at_path(&state, vault_path.path.clone(), master_password.clone())
            .expect("vault must initialize");
        assert!(vault_exists_at_path(&vault_path.path));

        let created = create(&state, sample_entry()).expect("entry must be created");
        assert_eq!(created.service_name, "Something");
        assert_eq!(created.login, "login");
        assert_eq!(created.password, "super-secret");

        let listed = list(&state).expect("entries must list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].id, created.id);

        let updated = update(
            &state,
            created.id.clone(),
            EntryInput {
                service_name: "Example".to_string(),
                login: "new-login".to_string(),
                password: "changed-secret".to_string(),
            },
        )
        .expect("entry must update");
        assert_eq!(updated.service_name, "Example");
        assert_eq!(updated.login, "new-login");
        assert_eq!(updated.password, "changed-secret");

        let listed_after_update = list(&state).expect("updated entry must list");
        assert_eq!(listed_after_update.len(), 1);
        assert_eq!(listed_after_update[0].service_name, "Example");
        assert_eq!(listed_after_update[0].password, "changed-secret");

        delete(&state, created.id.clone()).expect("entry must delete");
        assert!(list(&state)
            .expect("list after delete must succeed")
            .is_empty());

        reset_at_path(&state, &vault_path.path).expect("vault reset must succeed");
        assert!(!vault_exists_at_path(&vault_path.path));
        assert!(matches!(list(&state), Err(AppError::VaultLocked)));

        initialize_at_path(&state, vault_path.path.clone(), master_password.clone())
            .expect("vault must reinitialize after reset");
        lock_for_test(&state);
        unlock_at_path(&state, vault_path.path.clone(), master_password)
            .expect("vault must unlock after reset");
        assert!(list(&state)
            .expect("list after unlock must succeed")
            .is_empty());
    }

    #[test]
    fn unlock_with_wrong_password_fails() {
        let state = VaultState::default();
        let vault_path = TestVaultPath::new();

        initialize_at_path(
            &state,
            vault_path.path.clone(),
            "correct horse battery".to_string(),
        )
        .expect("vault must initialize");
        lock_for_test(&state);

        let error = unlock_at_path(
            &state,
            vault_path.path.clone(),
            "wrong password".to_string(),
        )
        .expect_err("wrong password must fail");

        assert!(matches!(error, AppError::InvalidMasterPassword));
    }

    #[test]
    fn locked_vault_rejects_entry_operations() {
        let state = VaultState::default();
        let input = sample_entry();

        assert!(matches!(list(&state), Err(AppError::VaultLocked)));
        assert!(matches!(
            create(&state, input.clone()),
            Err(AppError::VaultLocked)
        ));
        assert!(matches!(
            update(&state, "missing".to_string(), input),
            Err(AppError::VaultLocked)
        ));
        assert!(matches!(
            delete(&state, "missing".to_string()),
            Err(AppError::VaultLocked)
        ));
    }

    #[test]
    fn entries_are_encrypted_at_rest() {
        let state = VaultState::default();
        let vault_path = TestVaultPath::new();
        let input = sample_entry();

        initialize_at_path(
            &state,
            vault_path.path.clone(),
            "correct horse battery".to_string(),
        )
        .expect("vault must initialize");
        create(&state, input.clone()).expect("entry must be created");

        let connection = db::open_connection(&vault_path.path).expect("database must open");
        let ciphertext: Vec<u8> = connection
            .query_row("SELECT ciphertext FROM entries LIMIT 1", [], |row| {
                row.get(0)
            })
            .expect("ciphertext row must exist");
        assert!(!ciphertext.is_empty());
        assert!(!ciphertext
            .windows(input.password.len())
            .any(|window| window == input.password.as_bytes()));

        assert!(!file_contains_bytes(&vault_path.path, b"Something"));
        assert!(!file_contains_bytes(&vault_path.path, b"login"));
        assert!(!file_contains_bytes(&vault_path.path, b"super-secret"));
    }
}
