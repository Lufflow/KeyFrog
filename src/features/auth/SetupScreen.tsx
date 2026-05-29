import { FormEvent, useState } from "react";
import { ShieldCheck } from "lucide-react";

import keyfrogLogo from "../../assets/keyfrog-logo.png";
import { Button } from "../../components/ui/Button";
import { Field, TextInput } from "../../components/ui/Field";
import { useI18n } from "../../lib/i18n";
import { api } from "../../lib/tauri";

interface SetupScreenProps {
  onCreated: () => void;
}

export function SetupScreen({ onCreated }: SetupScreenProps) {
  const { t, translateError } = useI18n();
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordsMatch = masterPassword === confirmPassword;
  const isLongEnough = masterPassword.length >= 12;
  const canSubmit = passwordsMatch && isLongEnough && !isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await api.initializeVault(masterPassword);
      onCreated();
    } catch (caught) {
      setError(translateError(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-app-bg p-6 text-app-ink">
      <form
        onSubmit={handleSubmit}
        className="grid w-full max-w-md gap-5 rounded-md border border-app-border bg-app-panel p-6 shadow-surface"
      >
        <div className="flex items-center gap-3">
          <img src={keyfrogLogo} alt="" className="h-12 w-12 rounded-md object-contain" />
          <div>
            <h1 className="text-xl font-semibold">{t("createVault")}</h1>
            <p className="text-sm text-app-muted">{t("masterPasswordOnce")}</p>
          </div>
        </div>

        <div className="rounded-md border border-app-warning/30 bg-app-warningBg px-4 py-3 text-sm text-app-warning">
          {t("forgottenResetWarning")}
        </div>

        <Field label={t("masterPassword")}>
          <TextInput
            type="password"
            autoFocus
            value={masterPassword}
            onChange={(event) => setMasterPassword(event.target.value)}
          />
        </Field>

        <Field
          label={t("repeatMasterPassword")}
          error={!passwordsMatch && confirmPassword ? t("passwordsDoNotMatch") : undefined}
        >
          <TextInput
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </Field>

        {!isLongEnough && masterPassword ? (
          <p className="text-sm font-medium text-app-danger">{t("minMasterPassword")}</p>
        ) : null}

        {error ? <p className="text-sm font-medium text-app-danger">{error}</p> : null}

        <Button
          type="submit"
          variant="primary"
          disabled={!canSubmit}
          icon={<ShieldCheck size={18} />}
        >
          {t("createEncryptedVault")}
        </Button>
      </form>
    </main>
  );
}
