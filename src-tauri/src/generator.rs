use rand_core::{OsRng, RngCore};

use crate::{
    error::{to_command_error, AppError, AppResult},
    models::PasswordOptions,
};

const LOWERCASE: &[u8] = b"abcdefghijklmnopqrstuvwxyz";
const UPPERCASE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS: &[u8] = b"0123456789";
const SYMBOLS: &[u8] = b"!@#$%^&*()-_=+[]{};:,.?/|~";
const AMBIGUOUS: &[u8] = b"0Ool1I";

#[tauri::command]
pub fn generate_password(options: PasswordOptions) -> Result<String, String> {
    generate(options).map_err(to_command_error)
}

fn generate(options: PasswordOptions) -> AppResult<String> {
    if !(4..=128).contains(&options.length) {
        return Err(AppError::Validation(
            "password length must be between 4 and 128".to_string(),
        ));
    }

    let mut groups = Vec::new();

    if options.include_lowercase {
        groups.push(PasswordGroup {
            chars: filter_chars(LOWERCASE, options.exclude_ambiguous),
            weight: validate_weight(options.lowercase_weight)?,
        });
    }
    if options.include_uppercase {
        groups.push(PasswordGroup {
            chars: filter_chars(UPPERCASE, options.exclude_ambiguous),
            weight: validate_weight(options.uppercase_weight)?,
        });
    }
    if options.include_digits {
        groups.push(PasswordGroup {
            chars: filter_chars(DIGITS, options.exclude_ambiguous),
            weight: validate_weight(options.digits_weight)?,
        });
    }
    if options.include_symbols {
        groups.push(PasswordGroup {
            chars: filter_chars(SYMBOLS, options.exclude_ambiguous),
            weight: validate_weight(options.symbols_weight)?,
        });
    }

    groups.retain(|group| !group.chars.is_empty() && group.weight > 0);

    if groups.is_empty() {
        return Err(AppError::Validation(
            "select at least one character group".to_string(),
        ));
    }

    if groups.len() > options.length {
        return Err(AppError::Validation(
            "password length is too short for the selected groups".to_string(),
        ));
    }

    let mut bytes = Vec::with_capacity(options.length);
    for group in &groups {
        bytes.push(group.chars[random_index(group.chars.len())]);
    }

    let total_weight = groups.iter().map(|group| group.weight).sum();
    while bytes.len() < options.length {
        let group = choose_group(&groups, total_weight);
        bytes.push(group.chars[random_index(group.chars.len())]);
    }

    shuffle(&mut bytes);

    String::from_utf8(bytes)
        .map_err(|_| AppError::Validation("generated invalid password bytes".to_string()))
}

struct PasswordGroup {
    chars: Vec<u8>,
    weight: usize,
}

fn validate_weight(weight: usize) -> AppResult<usize> {
    if weight > 5 {
        return Err(AppError::Validation(
            "character group frequency must be between 0 and 5".to_string(),
        ));
    }

    Ok(weight)
}

fn choose_group(groups: &[PasswordGroup], total_weight: usize) -> &PasswordGroup {
    let mut cursor = random_index(total_weight);

    for group in groups {
        if cursor < group.weight {
            return group;
        }
        cursor -= group.weight;
    }

    &groups[groups.len() - 1]
}

fn filter_chars(chars: &[u8], exclude_ambiguous: bool) -> Vec<u8> {
    chars
        .iter()
        .copied()
        .filter(|char_byte| !exclude_ambiguous || !AMBIGUOUS.contains(char_byte))
        .collect()
}

fn random_index(len: usize) -> usize {
    let len = len as u32;
    let zone = u32::MAX - (u32::MAX % len);

    loop {
        let value = OsRng.next_u32();
        if value < zone {
            return (value % len) as usize;
        }
    }
}

fn shuffle(bytes: &mut [u8]) {
    for index in (1..bytes.len()).rev() {
        let swap_index = random_index(index + 1);
        bytes.swap(index, swap_index);
    }
}
