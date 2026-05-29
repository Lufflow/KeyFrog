use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("file system error: {0}")]
    Io(#[from] std::io::Error),
    #[error("serialization error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("application error: {0}")]
    Tauri(#[from] tauri::Error),
    #[error("crypto error: {0}")]
    Crypto(String),
    #[error("vault is locked")]
    VaultLocked,
    #[error("vault already exists")]
    VaultAlreadyExists,
    #[error("vault not found")]
    VaultNotFound,
    #[error("invalid master password")]
    InvalidMasterPassword,
    #[error("{0}")]
    Validation(String),
}

pub fn to_command_error(error: AppError) -> String {
    error.to_string()
}
