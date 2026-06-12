use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    XChaCha20Poly1305, XNonce,
};
use rand_core::{OsRng, RngCore};
use zeroize::Zeroize;

use crate::error::{AppError, AppResult};

pub const KEY_LEN: usize = 32;
pub const NONCE_LEN: usize = 24;
pub const SALT_LEN: usize = 16;

const ARGON2_MEMORY_COST_KIB: u32 = 64 * 1024;
const ARGON2_TIME_COST: u32 = 3;
const ARGON2_PARALLELISM: u32 = 1;

#[derive(Debug, Clone)]
pub struct EncryptedBlob {
    pub nonce: Vec<u8>,
    pub ciphertext: Vec<u8>,
}

pub fn random_array<const N: usize>() -> [u8; N] {
    let mut bytes = [0_u8; N];
    OsRng.fill_bytes(&mut bytes);
    bytes
}

pub fn derive_key(master_password: &str, salt: &[u8]) -> AppResult<[u8; KEY_LEN]> {
    let params = Params::new(
        ARGON2_MEMORY_COST_KIB,
        ARGON2_TIME_COST,
        ARGON2_PARALLELISM,
        Some(KEY_LEN),
    )
    .map_err(|error| AppError::Crypto(error.to_string()))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0_u8; KEY_LEN];

    argon2
        .hash_password_into(master_password.as_bytes(), salt, &mut key)
        .map_err(|_| AppError::Crypto("failed to derive key".to_string()))?;

    Ok(key)
}

pub fn encrypt(key: &[u8; KEY_LEN], plaintext: &[u8]) -> AppResult<EncryptedBlob> {
    let nonce = random_array::<NONCE_LEN>();
    let cipher = XChaCha20Poly1305::new_from_slice(key)
        .map_err(|_| AppError::Crypto("invalid encryption key".to_string()))?;
    let ciphertext = cipher
        .encrypt(XNonce::from_slice(&nonce), plaintext)
        .map_err(|_| AppError::Crypto("encryption failed".to_string()))?;

    Ok(EncryptedBlob {
        nonce: nonce.to_vec(),
        ciphertext,
    })
}

pub fn decrypt(key: &[u8; KEY_LEN], blob: &EncryptedBlob) -> AppResult<Vec<u8>> {
    let nonce: [u8; NONCE_LEN] = blob
        .nonce
        .as_slice()
        .try_into()
        .map_err(|_| AppError::Crypto("invalid nonce length".to_string()))?;
    let cipher = XChaCha20Poly1305::new_from_slice(key)
        .map_err(|_| AppError::Crypto("invalid encryption key".to_string()))?;

    cipher
        .decrypt(XNonce::from_slice(&nonce), blob.ciphertext.as_ref())
        .map_err(|_| AppError::InvalidMasterPassword)
}

pub fn zeroize_key(key: &mut [u8; KEY_LEN]) {
    key.zeroize();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derive_key_is_deterministic_for_same_inputs() {
        let salt = [7_u8; SALT_LEN];

        let first = derive_key("correct horse battery", &salt).expect("first derive must work");
        let second = derive_key("correct horse battery", &salt).expect("second derive must work");

        assert_eq!(first, second);
    }

    #[test]
    fn derive_key_changes_when_salt_changes() {
        let first =
            derive_key("correct horse battery", &[1_u8; SALT_LEN]).expect("first derive must work");
        let second = derive_key("correct horse battery", &[2_u8; SALT_LEN])
            .expect("second derive must work");

        assert_ne!(first, second);
    }

    #[test]
    fn encrypt_and_decrypt_round_trip() {
        let key = [3_u8; KEY_LEN];
        let plaintext = b"very secret payload";

        let encrypted = encrypt(&key, plaintext).expect("encryption must succeed");
        let decrypted = decrypt(&key, &encrypted).expect("decryption must succeed");

        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn decrypt_with_wrong_key_fails() {
        let correct_key = [4_u8; KEY_LEN];
        let wrong_key = [5_u8; KEY_LEN];
        let encrypted =
            encrypt(&correct_key, b"very secret payload").expect("encryption must succeed");

        let error = decrypt(&wrong_key, &encrypted).expect_err("wrong key must fail");

        assert!(matches!(error, AppError::InvalidMasterPassword));
    }

    #[test]
    fn decrypt_rejects_invalid_nonce_length() {
        let key = [6_u8; KEY_LEN];
        let error = decrypt(
            &key,
            &EncryptedBlob {
                nonce: vec![0_u8; NONCE_LEN - 1],
                ciphertext: vec![1, 2, 3],
            },
        )
        .expect_err("invalid nonce length must fail");

        assert!(matches!(error, AppError::Crypto(_)));
    }
}
