import { useCallback, useEffect, useMemo, useState } from "react";
import { ListChecks, Lock, Settings, WandSparkles } from "lucide-react";

import type { AppTab } from "./types";
import keyfrogLogo from "../assets/keyfrog-logo.png";
import { Tabs } from "../components/ui/Tabs";
import { Button } from "../components/ui/Button";
import { SetupScreen } from "../features/auth/SetupScreen";
import { UnlockScreen } from "../features/auth/UnlockScreen";
import { PasswordGenerator } from "../features/generator/PasswordGenerator";
import { SettingsPanel } from "../features/settings/SettingsPanel";
import { VaultView } from "../features/vault/VaultView";
import { I18nProvider, useI18n } from "../lib/i18n";
import { api } from "../lib/tauri";
import {
  getAutoLockMinutes,
  getLanguage,
  getTheme,
  SETTINGS_CHANGED_EVENT,
} from "../lib/settings";

export function App() {
  const [language, setLanguage] = useState(getLanguage);
  const [theme, setTheme] = useState(getTheme);

  useEffect(() => {
    const reloadSettings = () => {
      setLanguage(getLanguage());
      setTheme(getTheme());
    };

    window.addEventListener(SETTINGS_CHANGED_EVENT, reloadSettings);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, reloadSettings);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = language;
  }, [language, theme]);

  return (
    <I18nProvider language={language}>
      <AppContent />
    </I18nProvider>
  );
}

function AppContent() {
  const { t, translateError } = useI18n();
  const [isBooting, setIsBooting] = useState(true);
  const [hasVault, setHasVault] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>("vault");
  const [bootError, setBootError] = useState("");

  useEffect(() => {
    api
      .vaultExists()
      .then(setHasVault)
      .catch((error) => setBootError(translateError(error)))
      .finally(() => setIsBooting(false));
  }, [translateError]);

  const tabs = useMemo(
    () => [
      { id: "vault" as const, label: t("navVault"), icon: <ListChecks size={18} /> },
      {
        id: "generator" as const,
        label: t("navGenerator"),
        icon: <WandSparkles size={18} />,
      },
      { id: "settings" as const, label: t("navSettings"), icon: <Settings size={18} /> },
    ],
    [t],
  );

  const handleCreated = () => {
    setHasVault(true);
    setIsUnlocked(true);
    setActiveTab("vault");
  };

  const handleReset = () => {
    setHasVault(false);
    setIsUnlocked(false);
    setActiveTab("vault");
  };

  const handleLock = useCallback(async () => {
    await api.lockVault();
    setIsUnlocked(false);
    setActiveTab("vault");
  }, []);

  useEffect(() => {
    if (!isUnlocked) {
      return;
    }

    let timeoutId = 0;

    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        void handleLock();
      }, getAutoLockMinutes() * 60 * 1000);
    };

    const events = ["keydown", "mousedown", "mousemove", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, resetTimer));
    window.addEventListener(SETTINGS_CHANGED_EVENT, resetTimer);
    resetTimer();

    return () => {
      window.clearTimeout(timeoutId);
      events.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
      window.removeEventListener(SETTINGS_CHANGED_EVENT, resetTimer);
    };
  }, [handleLock, isUnlocked]);

  if (isBooting) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-app-bg text-app-ink">
        <div className="rounded-md border border-app-border bg-app-panel px-5 py-4 shadow-surface">
          {t("loadingVault")}
        </div>
      </main>
    );
  }

  if (bootError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-app-bg p-6 text-app-ink">
        <div className="w-full max-w-lg rounded-md border border-app-danger/30 bg-app-dangerBg p-5 text-app-danger">
          {bootError}
        </div>
      </main>
    );
  }

  if (!hasVault) {
    return <SetupScreen onCreated={handleCreated} />;
  }

  if (!isUnlocked) {
    return (
      <UnlockScreen
        onUnlocked={() => setIsUnlocked(true)}
        onResetComplete={handleReset}
      />
    );
  }

  return (
    <main className="min-h-screen bg-app-bg text-app-ink lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      <aside className="border-b border-app-border bg-app-panel px-4 py-4 lg:sticky lg:top-0 lg:h-screen lg:self-start lg:border-b-0 lg:border-r lg:py-5">
        <div className="grid gap-4 lg:gap-7">
          <div className="flex items-center gap-3">
            <img
              src={keyfrogLogo}
              alt=""
              className="h-11 w-11 rounded-md object-contain"
            />
            <div>
              <h1 className="text-base font-semibold">{t("appName")}</h1>
              <p className="text-xs text-app-muted">{t("localVault")}</p>
            </div>
          </div>
          <Tabs items={tabs} active={activeTab} onChange={setActiveTab} />
          <div className="border-t border-app-border pt-4">
            <Button
              variant="ghost"
              className="w-full justify-start"
              icon={<Lock size={17} />}
              onClick={handleLock}
            >
              {t("lock")}
            </Button>
          </div>
        </div>
      </aside>

      <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-7 lg:py-6">
        {activeTab === "vault" ? <VaultView /> : null}
        {activeTab === "generator" ? <PasswordGenerator /> : null}
        {activeTab === "settings" ? (
          <SettingsPanel onLock={handleLock} onReset={handleReset} />
        ) : null}
      </section>
    </main>
  );
}
