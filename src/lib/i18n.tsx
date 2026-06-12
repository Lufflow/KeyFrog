import { createContext, useContext, type ReactNode } from "react";

import type { AppLanguage } from "../app/types";

const translations = {
  ru: {
    appName: "KeyFrog",
    localVault: "Локальное хранилище",
    loadingVault: "Загрузка хранилища",
    navVault: "Хранилище",
    navGenerator: "Генератор",
    navSettings: "Настройки",
    lock: "Заблокировать",
    lockNow: "Заблокировать сейчас",
    createVault: "Создать хранилище",
    masterPasswordOnce: "Мастер-пароль задаётся один раз.",
    forgottenResetWarning:
      "Если он будет забыт, единственный вариант - удалить хранилище и создать новое.",
    masterPassword: "Мастер-пароль",
    repeatMasterPassword: "Повторите мастер-пароль",
    passwordsDoNotMatch: "Пароли не совпадают",
    minMasterPassword: "Используйте минимум 12 символов.",
    createEncryptedVault: "Создать зашифрованное хранилище",
    unlockVault: "Добро пожаловать в KeyFrog",
    enterMasterPassword: "Для того, чтобы открыть хранилище, введите мастер-пароль.",
    unlock: "Открыть",
    forgotMasterPassword: "Забыл мастер-пароль",
    exitApp: "Выйти из приложения",
    resetDeletesVault: "Локальное хранилище будет удалено без восстановления.",
    typeReset: "Введите RESET для подтверждения",
    deleteVault: "Удалить хранилище",
    cancel: "Отмена",
    vaultTitle: "Хранилище",
    entriesCount: "{count} записей",
    refresh: "Обновить",
    add: "Добавить",
    searchPlaceholder: "Поиск сервиса или логина",
    service: "Сервис",
    login: "Логин",
    password: "Пароль",
    actions: "Действия",
    loadingEntries: "Загрузка записей",
    noEntries: "Записей нет",
    copyLogin: "Копировать логин",
    copyPassword: "Копировать пароль",
    showPassword: "Показать пароль",
    hidePassword: "Скрыть пароль",
    editEntry: "Редактировать запись",
    deleteEntry: "Удалить запись",
    editShort: "Редактировать",
    deleteShort: "Удалить",
    copied: "Скопировано",
    deleteEntryConfirm: "Удалить {service}?",
    selectOrAddEntry: "Выберите запись или добавьте новую.",
    newEntry: "Новая запись",
    save: "Сохранить",
    generatorTitle: "Генератор паролей",
    generatorSubtitle: "Локальная генерация через системный RNG.",
    length: "Длина",
    characterGroups: "Символы",
    frequency: "Частота",
    lowercase: "Строчные",
    uppercase: "Заглавные",
    digits: "Цифры",
    symbols: "Спецсимволы",
    excludeAmbiguous: "Исключить похожие",
    result: "Результат",
    generate: "Сгенерировать",
    patterns: "Паттерны",
    patternName: "Название паттерна",
    savePattern: "Сохранить паттерн",
    savedPatterns: "Сохранённые паттерны",
    noPatterns: "Паттернов пока нет",
    applyPattern: "Применить паттерн",
    deletePattern: "Удалить паттерн",
    settingsTitle: "Настройки",
    settingsSubtitle: "Параметры локального приложения.",
    session: "Сессия",
    autoLockMinutes: "Авто-блокировка, минут",
    clearClipboardSeconds: "Очистка буфера, секунд",
    interface: "Интерфейс",
    language: "Язык",
    russian: "Русский",
    english: "English",
    theme: "Тема",
    lightTheme: "Светлая",
    darkTheme: "Тёмная",
    saved: "Сохранено",
    resetVault: "Сброс хранилища",
    resetVaultText: "Все сохранённые данные будут удалены, приложение вернётся к первичной настройке.",
    errorVaultLocked: "Хранилище заблокировано.",
    errorVaultExists: "Хранилище уже существует.",
    errorVaultNotFound: "Хранилище не найдено.",
    errorInvalidMasterPassword: "Неверный мастер-пароль.",
    errorMasterPasswordLength: "Мастер-пароль должен содержать минимум 12 символов.",
    errorLength: "Длина пароля должна быть от 4 до 128 символов.",
    errorGroup: "Выберите минимум одну группу символов.",
    errorShortForGroups: "Длина слишком мала для выбранных групп.",
    errorServiceEmpty: "Название сервиса не может быть пустым.",
    errorLoginEmpty: "Логин не может быть пустым.",
    errorPasswordEmpty: "Пароль не может быть пустым.",
    errorWeight: "Частота группы должна быть от 0 до 5.",
  },
  en: {
    appName: "KeyFrog",
    localVault: "Local vault",
    loadingVault: "Loading vault",
    navVault: "Vault",
    navGenerator: "Generator",
    navSettings: "Settings",
    lock: "Lock",
    lockNow: "Lock now",
    createVault: "Create vault",
    masterPasswordOnce: "Master password is set once.",
    forgottenResetWarning:
      "If it is forgotten, the only option is deleting the vault and creating a new one.",
    masterPassword: "Master password",
    repeatMasterPassword: "Repeat master password",
    passwordsDoNotMatch: "Passwords do not match",
    minMasterPassword: "Use at least 12 characters.",
    createEncryptedVault: "Create encrypted vault",
    unlockVault: "Welcome to KeyFrog",
    enterMasterPassword: "To unlock the vault, enter your master password.",
    unlock: "Unlock",
    forgotMasterPassword: "Forgot master password",
    exitApp: "Exit application",
    resetDeletesVault: "This deletes the local vault permanently.",
    typeReset: "Type RESET to continue",
    deleteVault: "Delete vault",
    cancel: "Cancel",
    vaultTitle: "Vault",
    entriesCount: "{count} saved entries",
    refresh: "Refresh",
    add: "Add",
    searchPlaceholder: "Search service or login",
    service: "Service",
    login: "Login",
    password: "Password",
    actions: "Actions",
    loadingEntries: "Loading entries",
    noEntries: "No entries",
    copyLogin: "Copy login",
    copyPassword: "Copy password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    editEntry: "Edit entry",
    deleteEntry: "Delete entry",
    editShort: "Edit",
    deleteShort: "Delete",
    copied: "Copied",
    deleteEntryConfirm: "Delete {service}?",
    selectOrAddEntry: "Select an entry or add a new one.",
    newEntry: "New entry",
    save: "Save",
    generatorTitle: "Password generator",
    generatorSubtitle: "Generate with local OS randomness.",
    length: "Length",
    characterGroups: "Characters",
    frequency: "Frequency",
    lowercase: "Lowercase",
    uppercase: "Uppercase",
    digits: "Digits",
    symbols: "Symbols",
    excludeAmbiguous: "Exclude ambiguous",
    result: "Result",
    generate: "Generate",
    patterns: "Patterns",
    patternName: "Pattern name",
    savePattern: "Save pattern",
    savedPatterns: "Saved patterns",
    noPatterns: "No patterns yet",
    applyPattern: "Apply pattern",
    deletePattern: "Delete pattern",
    settingsTitle: "Settings",
    settingsSubtitle: "Local application preferences.",
    session: "Session",
    autoLockMinutes: "Auto lock, minutes",
    clearClipboardSeconds: "Clear clipboard, seconds",
    interface: "Interface",
    language: "Language",
    russian: "Русский",
    english: "English",
    theme: "Theme",
    lightTheme: "Light",
    darkTheme: "Dark",
    saved: "Saved",
    resetVault: "Reset vault",
    resetVaultText: "This removes every saved credential and returns the app to first setup.",
    errorVaultLocked: "Vault is locked.",
    errorVaultExists: "Vault already exists.",
    errorVaultNotFound: "Vault not found.",
    errorInvalidMasterPassword: "Invalid master password.",
    errorMasterPasswordLength: "Master password must contain at least 12 characters.",
    errorLength: "Password length must be between 4 and 128.",
    errorGroup: "Select at least one character group.",
    errorShortForGroups: "Password length is too short for the selected groups.",
    errorServiceEmpty: "Service name cannot be empty.",
    errorLoginEmpty: "Login cannot be empty.",
    errorPasswordEmpty: "Password cannot be empty.",
    errorWeight: "Character group frequency must be between 0 and 5.",
  },
} as const;

type TranslationKey = keyof typeof translations.ru;

const errorKeyMap: Record<string, TranslationKey> = {
  "vault is locked": "errorVaultLocked",
  "vault already exists": "errorVaultExists",
  "vault not found": "errorVaultNotFound",
  "invalid master password": "errorInvalidMasterPassword",
  "master password must contain at least 12 characters": "errorMasterPasswordLength",
  "password length must be between 4 and 128": "errorLength",
  "password length must be between 4 and 128 characters": "errorLength",
  "select at least one character group": "errorGroup",
  "password length is too short for the selected groups": "errorShortForGroups",
  "service name cannot be empty": "errorServiceEmpty",
  "login cannot be empty": "errorLoginEmpty",
  "password cannot be empty": "errorPasswordEmpty",
  "character group frequency must be between 0 and 5": "errorWeight",
};

interface I18nValue {
  language: AppLanguage;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  translateError: (error: unknown) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  language,
  children,
}: {
  language: AppLanguage;
  children: ReactNode;
}) {
  const dictionary = translations[language];

  function t(key: TranslationKey, vars?: Record<string, string | number>) {
    let value: string = dictionary[key];
    if (!vars) {
      return value;
    }

    for (const [name, replacement] of Object.entries(vars)) {
      value = value.replace(`{${name}}`, String(replacement));
    }
    return value;
  }

  function translateError(error: unknown) {
    const message = String(error);
    const normalized = message.toLowerCase();
    const mappedKey = errorKeyMap[normalized];
    return mappedKey ? t(mappedKey) : message;
  }

  return (
    <I18nContext.Provider value={{ language, t, translateError }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("I18nProvider is missing");
  }
  return context;
}
