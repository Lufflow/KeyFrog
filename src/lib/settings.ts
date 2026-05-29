import type { AppLanguage, AppTheme } from "../app/types";

export const AUTO_LOCK_KEY = "pm.autoLockMinutes";
export const CLEAR_CLIPBOARD_KEY = "pm.clearClipboardSeconds";
export const LANGUAGE_KEY = "pm.language";
export const THEME_KEY = "pm.theme";
export const SETTINGS_CHANGED_EVENT = "pm-settings-changed";

export function readNumberSetting(key: string, fallback: number) {
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getAutoLockMinutes() {
  return readNumberSetting(AUTO_LOCK_KEY, 10);
}

export function getClearClipboardSeconds() {
  return readNumberSetting(CLEAR_CLIPBOARD_KEY, 30);
}

export function getLanguage(): AppLanguage {
  const language = window.localStorage.getItem(LANGUAGE_KEY);
  return language === "en" || language === "ru" ? language : "ru";
}

export function getTheme(): AppTheme {
  const theme = window.localStorage.getItem(THEME_KEY);
  return theme === "dark" || theme === "light" ? theme : "light";
}

export function notifySettingsChanged() {
  window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
}
