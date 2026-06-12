import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Copy, Eye, EyeOff, Plus, RefreshCw, Search } from "lucide-react";

import type { EntryInput, VaultEntry } from "../../app/types";
import { Button } from "../../components/ui/Button";
import { TextInput } from "../../components/ui/Field";
import { copySecret } from "../../lib/clipboard";
import { useI18n } from "../../lib/i18n";
import { api } from "../../lib/tauri";
import { EntryEditor } from "./EntryEditor";

export function VaultView() {
  const { t, translateError } = useI18n();
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<VaultEntry | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState("");

  const loadEntries = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      setEntries(await api.listEntries());
    } catch (caught) {
      setError(translateError(caught));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return entries;
    }

    return entries.filter((entry) =>
      [entry.serviceName, entry.login]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [entries, query]);

  function openNewEntry() {
    setEditingEntry(null);
    setEditorOpen(true);
  }

  function openEditEntry(entry: VaultEntry) {
    setEditingEntry(entry);
    setEditorOpen(true);
  }

  async function handleSave(input: EntryInput) {
    if (editingEntry) {
      const updated = await api.updateEntry(editingEntry.id, input);
      setEntries((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
    } else {
      const created = await api.createEntry(input);
      setEntries((current) => [created, ...current]);
    }

    setEditorOpen(false);
    setEditingEntry(null);
  }

  async function handleDelete(entry: VaultEntry) {
    if (!window.confirm(t("deleteEntryConfirm", { service: entry.serviceName }))) {
      return;
    }

    setError("");
    try {
      await api.deleteEntry(entry.id);
      setEntries((current) => current.filter((item) => item.id !== entry.id));
    } catch (caught) {
      setError(translateError(caught));
    }
  }

  function toggleReveal(id: string) {
    setRevealedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function copyText(text: string, id: string) {
    await copySecret(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(""), 1400);
  }

  return (
    <div className="grid h-full gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{t("vaultTitle")}</h1>
            <p className="text-sm text-app-muted">
              {t("entriesCount", { count: entries.length })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={<RefreshCw size={17} />}
              onClick={loadEntries}
              disabled={isLoading}
            >
              {t("refresh")}
            </Button>
            <Button variant="primary" icon={<Plus size={18} />} onClick={openNewEntry}>
              {t("add")}
            </Button>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-md border border-app-border bg-app-panel px-3 transition focus-within:border-app-accent focus-within:ring-2 focus-within:ring-app-accent/20">
          <Search size={18} className="text-app-muted" />
          <TextInput
            className="min-w-0 flex-1 !border-0 !bg-transparent px-0 focus:!border-transparent focus:!ring-0"
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {error ? (
          <div className="mb-4 rounded-md border border-app-danger/30 bg-app-dangerBg px-4 py-3 text-sm font-medium text-app-danger">
            {error}
          </div>
        ) : null}

        <div className="grid gap-2">
          {isLoading ? (
            <div className="rounded-md border border-app-border bg-app-panel px-4 py-8 text-center text-sm text-app-muted">
              {t("loadingEntries")}
            </div>
          ) : null}

          {!isLoading && filteredEntries.length === 0 ? (
            <div className="rounded-md border border-app-border bg-app-panel px-4 py-8 text-center text-sm text-app-muted">
              {t("noEntries")}
            </div>
          ) : null}

          {filteredEntries.map((entry) => {
            const isRevealed = revealedIds.has(entry.id);
            const passwordLabel = isRevealed ? entry.password : "************";

            return (
              <article
                key={entry.id}
                className="relative rounded-md border border-app-border bg-app-panel p-4 text-sm shadow-sm"
              >
                <div className="grid gap-3">
                  <EntryCell label={t("service")} value={entry.serviceName} strong />
                  <InlineSecret
                    label={t("login")}
                    value={entry.login}
                    actionLabel={t("copyLogin")}
                    actionIcon={<Copy size={15} />}
                    copied={copiedId === `${entry.id}-login`}
                    onAction={() => copyText(entry.login, `${entry.id}-login`)}
                  />
                  <InlineSecret
                    label={t("password")}
                    value={passwordLabel}
                    monospace
                    actionLabel={isRevealed ? t("hidePassword") : t("showPassword")}
                    actionIcon={isRevealed ? <EyeOff size={15} /> : <Eye size={15} />}
                    copied={copiedId === `${entry.id}-password`}
                    extraActionLabel={t("copyPassword")}
                    extraActionIcon={<Copy size={15} />}
                    onAction={() => toggleReveal(entry.id)}
                    onExtraAction={() => copyText(entry.password, `${entry.id}-password`)}
                  />
                </div>
                <div className="absolute right-4 top-4 flex gap-2">
                  <RecordActionButton
                    tone="edit"
                    aria-label={t("editEntry")}
                    title={t("editEntry")}
                    onClick={() => openEditEntry(entry)}
                  >
                    <EditRecordIcon />
                  </RecordActionButton>
                  <RecordActionButton
                    tone="delete"
                    aria-label={t("deleteEntry")}
                    title={t("deleteEntry")}
                    onClick={() => handleDelete(entry)}
                  >
                    <DeleteRecordIcon />
                  </RecordActionButton>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <aside className="min-w-0">
        {editorOpen ? (
          <EntryEditor
            entry={editingEntry}
            onCancel={() => {
              setEditorOpen(false);
              setEditingEntry(null);
            }}
            onSave={handleSave}
          />
        ) : (
          <div className="rounded-md border border-app-border bg-app-panel p-5 text-sm text-app-muted">
            {t("selectOrAddEntry")}
          </div>
        )}
      </aside>
    </div>
  );
}

interface RecordActionButtonProps {
  children: ReactNode;
  tone: "edit" | "delete";
  "aria-label": string;
  title: string;
  onClick: () => void;
}

function RecordActionButton({
  children,
  tone,
  "aria-label": ariaLabel,
  title,
  onClick,
}: RecordActionButtonProps) {
  const toneClass =
    tone === "edit"
      ? "border-app-accent bg-app-accent text-white hover:bg-app-accentDark focus-visible:ring-app-accent"
      : "border-app-danger bg-app-danger text-white hover:bg-app-danger/85 focus-visible:ring-app-danger";

  return (
    <button
      type="button"
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-app-panel ${toneClass}`}
      aria-label={ariaLabel}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function EditRecordIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-[18px] w-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </svg>
  );
}

function DeleteRecordIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-[18px] w-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

interface InlineSecretProps {
  label: string;
  value: string;
  actionLabel: string;
  actionIcon: ReactNode;
  onAction: () => void;
  copied?: boolean;
  monospace?: boolean;
  extraActionLabel?: string;
  extraActionIcon?: ReactNode;
  onExtraAction?: () => void;
}

function InlineSecret({
  label,
  value,
  actionLabel,
  actionIcon,
  onAction,
  copied,
  monospace,
  extraActionLabel,
  extraActionIcon,
  onExtraAction,
}: InlineSecretProps) {
  const { t } = useI18n();

  return (
    <div className="min-w-0">
      <span className="mb-1 block text-xs font-semibold uppercase text-app-muted">{label}</span>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-app-border bg-app-subtle px-3 py-2">
        <span className={`block truncate ${monospace ? "font-mono" : "text-app-muted"}`}>
          {value}
        </span>
        <div className="flex gap-1">
          {onExtraAction ? (
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-app-muted transition hover:bg-app-panel hover:text-app-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-app-accent"
              aria-label={extraActionLabel}
              title={extraActionLabel}
              onClick={onExtraAction}
            >
              {extraActionIcon}
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-app-muted transition hover:bg-app-panel hover:text-app-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-app-accent"
            aria-label={actionLabel}
            title={actionLabel}
            onClick={onAction}
          >
            {actionIcon}
          </button>
        </div>
      </div>
      {copied ? <p className="mt-1 text-xs font-medium text-app-accent">{t("copied")}</p> : null}
    </div>
  );
}

interface EntryCellProps {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}

function EntryCell({ label, value, strong, muted }: EntryCellProps) {
  return (
    <div className={`min-w-0 ${strong ? "pr-[88px]" : ""}`}>
      <span className="mb-1 block text-xs font-semibold uppercase text-app-muted">{label}</span>
      <span
        className={`block truncate ${strong ? "font-semibold" : ""} ${
          muted ? "text-app-muted" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
