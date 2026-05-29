import { FormEvent, useEffect, useState } from "react";
import { Save, X } from "lucide-react";

import type { EntryInput, VaultEntry } from "../../app/types";
import { Button } from "../../components/ui/Button";
import { Field, TextInput } from "../../components/ui/Field";
import { useI18n } from "../../lib/i18n";

interface EntryEditorProps {
  entry: VaultEntry | null;
  onCancel: () => void;
  onSave: (input: EntryInput) => Promise<void>;
}

export function EntryEditor({ entry, onCancel, onSave }: EntryEditorProps) {
  const { t, translateError } = useI18n();
  const [serviceName, setServiceName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setServiceName(entry?.serviceName ?? "");
    setLogin(entry?.login ?? "");
    setPassword(entry?.password ?? "");
    setError("");
  }, [entry]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      await onSave({ serviceName, login, password });
    } catch (caught) {
      setError(translateError(caught));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-md border border-app-border bg-app-panel p-5 shadow-surface"
    >
      <div>
        <h2 className="text-lg font-semibold">{entry ? t("editEntry") : t("newEntry")}</h2>
      </div>

      <Field label={t("service")}>
        <TextInput
          value={serviceName}
          onChange={(event) => setServiceName(event.target.value)}
        />
      </Field>

      <Field label={t("login")}>
        <TextInput value={login} onChange={(event) => setLogin(event.target.value)} />
      </Field>

      <Field label={t("password")}>
        <TextInput
          type="text"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>

      {error ? <p className="text-sm font-medium text-app-danger">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button variant="danger" icon={<X size={17} />} onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={isSaving}
          icon={<Save size={17} />}
        >
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
