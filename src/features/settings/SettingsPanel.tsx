import { useEffect, useState } from "react";
import { Lock, Save, Trash2 } from "lucide-react";

import type { AppLanguage, AppTheme } from "../../app/types";
import { Button } from "../../components/ui/Button";
import { Field, SelectInput, TextInput } from "../../components/ui/Field";
import { useI18n } from "../../lib/i18n";
import {
  AUTO_LOCK_KEY,
  CLEAR_CLIPBOARD_KEY,
  getLanguage,
  getTheme,
  LANGUAGE_KEY,
  notifySettingsChanged,
  readNumberSetting,
  THEME_KEY,
} from "../../lib/settings";
import { api } from "../../lib/tauri";

interface SettingsPanelProps {
  onLock: () => Promise<void>;
  onReset: () => void;
}

export function SettingsPanel({ onLock, onReset }: SettingsPanelProps) {
  const { t, translateError } = useI18n();
  const [autoLockMinutes, setAutoLockMinutes] = useState(10);
  const [clearClipboardSeconds, setClearClipboardSeconds] = useState(30);
  const [language, setLanguage] = useState<AppLanguage>("ru");
  const [theme, setTheme] = useState<AppTheme>("light");
  const [resetText, setResetText] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setAutoLockMinutes(readNumberSetting(AUTO_LOCK_KEY, 10));
    setClearClipboardSeconds(readNumberSetting(CLEAR_CLIPBOARD_KEY, 30));
    setLanguage(getLanguage());
    setTheme(getTheme());
  }, []);

  function saveSettings() {
    window.localStorage.setItem(AUTO_LOCK_KEY, String(autoLockMinutes));
    window.localStorage.setItem(CLEAR_CLIPBOARD_KEY, String(clearClipboardSeconds));
    window.localStorage.setItem(LANGUAGE_KEY, language);
    window.localStorage.setItem(THEME_KEY, theme);
    notifySettingsChanged();
    setStatus(t("saved"));
    window.setTimeout(() => setStatus(""), 1400);
  }

  async function resetVault() {
    setError("");

    try {
      await api.resetVault();
      onReset();
    } catch (caught) {
      setError(translateError(caught));
    }
  }

  return (
    <section className="max-w-5xl">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">{t("settingsTitle")}</h1>
        <p className="text-sm text-app-muted">{t("settingsSubtitle")}</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="grid gap-5">
          <div className="grid gap-4 rounded-md border border-app-border bg-app-panel p-5 shadow-surface">
            <h2 className="text-lg font-semibold">{t("session")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("autoLockMinutes")}>
                <TextInput
                  type="number"
                  min={1}
                  max={240}
                  value={autoLockMinutes}
                  onChange={(event) => setAutoLockMinutes(Number(event.target.value))}
                />
              </Field>
              <Field label={t("clearClipboardSeconds")}>
                <TextInput
                  type="number"
                  min={5}
                  max={300}
                  value={clearClipboardSeconds}
                  onChange={(event) => setClearClipboardSeconds(Number(event.target.value))}
                />
              </Field>
            </div>
          </div>

          <div className="grid gap-4 rounded-md border border-app-border bg-app-panel p-5 shadow-surface">
            <h2 className="text-lg font-semibold">{t("interface")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("language")}>
                <SelectInput
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as AppLanguage)}
                >
                  <option value="ru">{t("russian")}</option>
                  <option value="en">{t("english")}</option>
                </SelectInput>
              </Field>

              <Field label={t("theme")}>
                <div className="grid grid-cols-2 rounded-md border border-app-border bg-app-subtle p-1">
                  <button
                    type="button"
                    className={`h-8 rounded text-sm font-medium transition ${
                      theme === "light"
                        ? "bg-app-panel text-app-ink shadow-sm"
                        : "text-app-muted hover:text-app-ink"
                    }`}
                    onClick={() => setTheme("light")}
                  >
                    {t("lightTheme")}
                  </button>
                  <button
                    type="button"
                    className={`h-8 rounded text-sm font-medium transition ${
                      theme === "dark"
                        ? "bg-app-panel text-app-ink shadow-sm"
                        : "text-app-muted hover:text-app-ink"
                    }`}
                    onClick={() => setTheme("dark")}
                  >
                    {t("darkTheme")}
                  </button>
                </div>
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" icon={<Save size={17} />} onClick={saveSettings}>
              {t("save")}
            </Button>
            <Button variant="secondary" icon={<Lock size={17} />} onClick={onLock}>
              {t("lockNow")}
            </Button>
            {status ? <span className="text-sm font-medium text-app-accent">{status}</span> : null}
          </div>
        </div>

        <div className="grid content-start gap-4 rounded-md border border-app-danger/35 bg-app-panel p-5 shadow-surface">
          <h2 className="text-lg font-semibold text-app-danger">{t("resetVault")}</h2>
          <p className="text-sm text-app-muted">{t("resetVaultText")}</p>
          <Field label={t("typeReset")}>
            <TextInput
              value={resetText}
              onChange={(event) => setResetText(event.target.value)}
            />
          </Field>
          {error ? <p className="text-sm font-medium text-app-danger">{error}</p> : null}
          <div>
            <Button
              variant="danger"
              icon={<Trash2 size={17} />}
              disabled={resetText !== "RESET"}
              onClick={resetVault}
            >
              {t("deleteVault")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
