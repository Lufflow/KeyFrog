import { FormEvent, useState } from "react";
import { LogOut, Trash2, Unlock, X } from "lucide-react";
import { exit } from "@tauri-apps/plugin-process";

import keyfrogLogo from "../../assets/keyfrog-logo.png";
import { Button } from "../../components/ui/Button";
import { Field, TextInput } from "../../components/ui/Field";
import { useI18n } from "../../lib/i18n";
import { api } from "../../lib/tauri";

interface UnlockScreenProps {
  onUnlocked: () => void;
  onResetComplete: () => void;
}

export function UnlockScreen({ onUnlocked, onResetComplete }: UnlockScreenProps) {
  const { t, translateError } = useI18n();
  const [masterPassword, setMasterPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetText, setResetText] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await api.unlockVault(masterPassword);
      onUnlocked();
    } catch (caught) {
      setError(translateError(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReset() {
    setError("");
    try {
      await api.resetVault();
      onResetComplete();
    } catch (caught) {
      setError(translateError(caught));
    }
  }

  async function handleExit() {
    await exit(0);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-app-bg p-6 text-app-ink">
      <div className="grid w-full max-w-md gap-4">
        <form
          onSubmit={handleSubmit}
          className="grid gap-5 rounded-md border border-app-border bg-app-panel p-6 shadow-surface"
        >
          <div className="flex items-center gap-3">
            <img src={keyfrogLogo} alt="" className="h-12 w-12 rounded-md object-contain" />
            <div>
              <h1 className="text-xl font-semibold">{t("unlockVault")}</h1>
              <p className="text-sm text-app-muted">{t("enterMasterPassword")}</p>
            </div>
          </div>

          <Field label={t("masterPassword")}>
            <TextInput
              type="password"
              autoFocus
              value={masterPassword}
              onChange={(event) => setMasterPassword(event.target.value)}
            />
          </Field>

          {error ? <p className="text-sm font-medium text-app-danger">{error}</p> : null}

          <Button
            type="submit"
            variant="primary"
            disabled={!masterPassword || isSubmitting}
            icon={<Unlock size={18} />}
          >
            {t("unlock")}
          </Button>
        </form>

        <div className="rounded-md border border-app-border bg-app-panel p-4">
          {!showReset ? (
            <Button
              variant="ghost"
              className="w-full justify-start text-app-danger hover:text-app-danger"
              icon={<Trash2 size={17} />}
              onClick={() => setShowReset(true)}
            >
              {t("forgotMasterPassword")}
            </Button>
          ) : (
            <div className="grid gap-3">
              <p className="text-sm font-medium text-app-danger">
                {t("resetDeletesVault")}
              </p>
              <Field label={t("typeReset")}>
                <TextInput
                  value={resetText}
                  onChange={(event) => setResetText(event.target.value)}
                />
              </Field>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  icon={<Trash2 size={17} />}
                  disabled={resetText !== "RESET"}
                  onClick={handleReset}
                >
                  {t("deleteVault")}
                </Button>
                <Button
                  variant="danger"
                  icon={<X size={17} />}
                  onClick={() => setShowReset(false)}
                >
                  {t("cancel")}
                </Button>
              </div>
            </div>
          )}
        </div>

        <Button
          variant="danger"
          className="w-full"
          icon={<LogOut size={17} />}
          onClick={handleExit}
        >
          {t("exitApp")}
        </Button>
      </div>
    </main>
  );
}
