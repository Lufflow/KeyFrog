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

#[cfg(test)]
mod tests {
    use super::*;

    fn base_options() -> PasswordOptions {
        PasswordOptions {
            length: 24,
            include_lowercase: true,
            include_uppercase: true,
            include_digits: true,
            include_symbols: true,
            exclude_ambiguous: false,
            lowercase_weight: 5,
            uppercase_weight: 4,
            digits_weight: 2,
            symbols_weight: 1,
        }
    }

    fn password_contains_any(password: &str, charset: &[u8]) -> bool {
        password.bytes().any(|byte| charset.contains(&byte))
    }

    #[test]
    fn generates_password_with_requested_length() {
        let password = generate(base_options()).expect("password generation must succeed");

        assert_eq!(password.len(), 24);
    }

    #[test]
    fn generated_password_contains_each_enabled_group() {
        let options = PasswordOptions {
            length: 16,
            lowercase_weight: 1,
            uppercase_weight: 1,
            digits_weight: 1,
            symbols_weight: 1,
            ..base_options()
        };

        let password = generate(options).expect("password generation must succeed");

        assert!(password_contains_any(&password, LOWERCASE));
        assert!(password_contains_any(&password, UPPERCASE));
        assert!(password_contains_any(&password, DIGITS));
        assert!(password_contains_any(&password, SYMBOLS));
    }

    #[test]
    fn excludes_ambiguous_characters_when_requested() {
        let options = PasswordOptions {
            length: 64,
            exclude_ambiguous: true,
            include_symbols: false,
            symbols_weight: 0,
            ..base_options()
        };

        let password = generate(options).expect("password generation must succeed");

        assert!(!password.bytes().any(|byte| AMBIGUOUS.contains(&byte)));
    }

    #[test]
    fn rejects_invalid_length() {
        let too_short = generate(PasswordOptions {
            length: 3,
            ..base_options()
        })
        .expect_err("length below minimum must fail");
        assert!(matches!(too_short, AppError::Validation(_)));

        let too_long = generate(PasswordOptions {
            length: 129,
            ..base_options()
        })
        .expect_err("length above maximum must fail");
        assert!(matches!(too_long, AppError::Validation(_)));
    }

    #[test]
    fn rejects_missing_character_groups() {
        let error = generate(PasswordOptions {
            include_lowercase: false,
            include_uppercase: false,
            include_digits: false,
            include_symbols: false,
            lowercase_weight: 0,
            uppercase_weight: 0,
            digits_weight: 0,
            symbols_weight: 0,
            ..base_options()
        })
        .expect_err("generation without groups must fail");

        assert!(matches!(error, AppError::Validation(_)));
    }

    #[test]
    fn rejects_lengths_below_minimum() {
        let error = generate(PasswordOptions {
            length: 2,
            ..base_options()
        })
        .expect_err("length below minimum must fail");

        assert!(matches!(error, AppError::Validation(_)));
    }

    #[test]
    fn rejects_weight_above_allowed_range() {
        let error = generate(PasswordOptions {
            lowercase_weight: 6,
            ..base_options()
        })
        .expect_err("invalid weight must fail");

        assert!(matches!(error, AppError::Validation(_)));
    }
}
