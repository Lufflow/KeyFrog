import { useEffect, useMemo, useState } from "react";
import { Copy, RefreshCw, Save, Trash2 } from "lucide-react";

import type { PasswordOptions, PasswordPattern } from "../../app/types";
import { Button } from "../../components/ui/Button";
import { Field, TextInput } from "../../components/ui/Field";
import { copySecret } from "../../lib/clipboard";
import { useI18n } from "../../lib/i18n";
import { api } from "../../lib/tauri";

const PATTERNS_KEY = "pm.passwordPatterns";

const defaultOptions: PasswordOptions = {
  length: 24,
  includeLowercase: true,
  includeUppercase: true,
  includeDigits: true,
  includeSymbols: true,
  excludeAmbiguous: true,
  lowercaseWeight: 5,
  uppercaseWeight: 4,
  digitsWeight: 2,
  symbolsWeight: 1,
};

export function PasswordGenerator() {
  const { t, translateError } = useI18n();
  const [options, setOptions] = useState<PasswordOptions>(defaultOptions);
  const [patterns, setPatterns] = useState<PasswordPattern[]>([]);
  const [patternName, setPatternName] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPatterns(readPatterns());
  }, []);

  const enabledGroups = useMemo(
    () =>
      [
        options.includeLowercase,
        options.includeUppercase,
        options.includeDigits,
        options.includeSymbols,
      ].filter(Boolean).length,
    [options],
  );

  async function handleGenerate(customOptions = options) {
    setError("");
    setCopied(false);

    try {
      setGeneratedPassword(await api.generatePassword(customOptions));
    } catch (caught) {
      setError(translateError(caught));
    }
  }

  async function handleCopy() {
    if (!generatedPassword) {
      return;
    }

    await copySecret(generatedPassword);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function updateOption<K extends keyof PasswordOptions>(key: K, value: PasswordOptions[K]) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  function savePattern() {
    const name = patternName.trim();
    if (!name) {
      return;
    }

    const nextPattern: PasswordPattern = {
      id: createId(),
      name,
      options,
    };
    const nextPatterns = [nextPattern, ...patterns];
    setPatterns(nextPatterns);
    persistPatterns(nextPatterns);
    setPatternName("");
  }

  function deletePattern(id: string) {
    const nextPatterns = patterns.filter((pattern) => pattern.id !== id);
    setPatterns(nextPatterns);
    persistPatterns(nextPatterns);
  }

  function applyPattern(pattern: PasswordPattern) {
    const normalizedOptions = { ...defaultOptions, ...pattern.options };
    setOptions(normalizedOptions);
    void handleGenerate(normalizedOptions);
  }

  return (
    <section className="w-full">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">{t("generatorTitle")}</h1>
        <p className="text-sm text-app-muted">{t("generatorSubtitle")}</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,760px)_minmax(340px,1fr)]">
        <div className="grid gap-5 rounded-md border border-app-border bg-app-panel p-5 shadow-surface">
          <Field label={t("length")}>
            <div className="grid grid-cols-[1fr_88px] gap-3">
              <input
                type="range"
                min={Math.max(4, enabledGroups)}
                max={128}
                value={options.length}
                onChange={(event) => updateOption("length", Number(event.target.value))}
              />
              <TextInput
                type="number"
                min={Math.max(4, enabledGroups)}
                max={128}
                value={options.length}
                onChange={(event) => updateOption("length", Number(event.target.value))}
              />
            </div>
          </Field>

          <div className="grid gap-3">
            <h2 className="text-base font-semibold">{t("characterGroups")}</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              <CharacterOption
                label={t("lowercase")}
                checked={options.includeLowercase}
                weight={options.lowercaseWeight}
                onCheckedChange={(checked) => updateOption("includeLowercase", checked)}
                onWeightChange={(weight) => updateOption("lowercaseWeight", weight)}
              />
              <CharacterOption
                label={t("uppercase")}
                checked={options.includeUppercase}
                weight={options.uppercaseWeight}
                onCheckedChange={(checked) => updateOption("includeUppercase", checked)}
                onWeightChange={(weight) => updateOption("uppercaseWeight", weight)}
              />
              <CharacterOption
                label={t("digits")}
                checked={options.includeDigits}
                weight={options.digitsWeight}
                onCheckedChange={(checked) => updateOption("includeDigits", checked)}
                onWeightChange={(weight) => updateOption("digitsWeight", weight)}
              />
              <CharacterOption
                label={t("symbols")}
                checked={options.includeSymbols}
                weight={options.symbolsWeight}
                onCheckedChange={(checked) => updateOption("includeSymbols", checked)}
                onWeightChange={(weight) => updateOption("symbolsWeight", weight)}
              />
            </div>
          </div>

          <Toggle
            label={t("excludeAmbiguous")}
            checked={options.excludeAmbiguous}
            onChange={(checked) => updateOption("excludeAmbiguous", checked)}
          />

          {error ? <p className="text-sm font-medium text-app-danger">{error}</p> : null}

          <div>
            <Button variant="primary" icon={<RefreshCw size={17} />} onClick={() => handleGenerate()}>
              {t("generate")}
            </Button>
          </div>
        </div>

        <aside className="grid content-start gap-5">
          <div className="grid gap-3 rounded-md border border-app-border bg-app-panel p-5 shadow-surface">
            <h2 className="text-lg font-semibold">{t("result")}</h2>
            {generatedPassword ? (
              <div className="grid gap-2">
                <div className="overflow-hidden rounded-md border border-app-border bg-app-subtle px-3 py-2 font-mono text-sm">
                  <span className="block truncate">{generatedPassword}</span>
                </div>
                <Button variant="secondary" icon={<Copy size={17} />} onClick={handleCopy}>
                  {copied ? t("copied") : t("copyPassword")}
                </Button>
              </div>
            ) : (
              <div className="rounded-md border border-app-border bg-app-subtle px-3 py-6 text-center text-sm text-app-muted">
                {t("generate")}
              </div>
            )}
          </div>

          <div className="grid gap-4 rounded-md border border-app-border bg-app-panel p-5 shadow-surface">
            <h2 className="text-lg font-semibold">{t("patterns")}</h2>
            <div className="grid gap-2">
              <Field label={t("patternName")}>
                <TextInput
                  value={patternName}
                  onChange={(event) => setPatternName(event.target.value)}
                />
              </Field>
              <Button
                variant="primary"
                icon={<Save size={17} />}
                disabled={!patternName.trim()}
                onClick={savePattern}
              >
                {t("savePattern")}
              </Button>
            </div>

            <div className="grid gap-2">
              <h3 className="text-sm font-semibold text-app-muted">{t("savedPatterns")}</h3>
              {patterns.length === 0 ? (
                <p className="rounded-md border border-app-border bg-app-subtle px-3 py-4 text-center text-sm text-app-muted">
                  {t("noPatterns")}
                </p>
              ) : null}
              {patterns.map((pattern) => (
                <div
                  key={pattern.id}
                  className="grid gap-2 rounded-md border border-app-border bg-app-subtle px-3 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                >
                  <span className="truncate text-sm font-medium">{pattern.name}</span>
                  <Button
                    variant="primary"
                    className="h-8 px-3 text-xs"
                    aria-label={t("applyPattern")}
                    title={t("applyPattern")}
                    icon={<RefreshCw size={14} />}
                    onClick={() => applyPattern(pattern)}
                  >
                    {t("applyPattern")}
                  </Button>
                  <Button
                    variant="danger"
                    className="h-8 px-3 text-xs"
                    aria-label={t("deletePattern")}
                    title={t("deletePattern")}
                    icon={<Trash2 size={14} />}
                    onClick={() => deletePattern(pattern.id)}
                  >
                    {t("deleteShort")}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

interface CharacterOptionProps {
  label: string;
  checked: boolean;
  weight: number;
  onCheckedChange: (checked: boolean) => void;
  onWeightChange: (weight: number) => void;
}

function CharacterOption({
  label,
  checked,
  weight,
  onCheckedChange,
  onWeightChange,
}: CharacterOptionProps) {
  const { t } = useI18n();

  return (
    <div className="grid gap-3 rounded-md border border-app-border bg-app-subtle p-3">
      <label className="flex h-7 items-center gap-3 text-sm font-medium text-app-ink">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
        />
        <span>{label}</span>
      </label>
      <div className="grid grid-cols-[1fr_92px] items-center gap-3">
        <input
          type="range"
          min={1}
          max={5}
          value={weight}
          disabled={!checked}
          onChange={(event) => onWeightChange(Number(event.target.value))}
        />
        <span className="text-right text-xs font-semibold text-app-muted">
          {t("frequency")} {weight}/5
        </span>
      </div>
    </div>
  );
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className="flex h-11 items-center gap-3 rounded-md border border-app-border bg-app-subtle px-3 text-sm font-medium text-app-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function readPatterns() {
  try {
    const raw = window.localStorage.getItem(PATTERNS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as PasswordPattern[];
    return parsed.map((pattern) => ({
      ...pattern,
      options: { ...defaultOptions, ...pattern.options },
    }));
  } catch {
    return [];
  }
}

function persistPatterns(patterns: PasswordPattern[]) {
  window.localStorage.setItem(PATTERNS_KEY, JSON.stringify(patterns));
}

function createId() {
  return window.crypto?.randomUUID?.() ?? String(Date.now());
}
