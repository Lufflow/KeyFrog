import { invoke } from "@tauri-apps/api/core";

import type { EntryInput, PasswordOptions, VaultEntry } from "../app/types";

export const api = {
  vaultExists: () => invoke<boolean>("vault_exists"),
  initializeVault: (masterPassword: string) =>
    invoke<void>("initialize_vault", { masterPassword }),
  unlockVault: (masterPassword: string) =>
    invoke<void>("unlock_vault", { masterPassword }),
  lockVault: () => invoke<void>("lock_vault"),
  resetVault: () => invoke<void>("reset_vault"),
  listEntries: () => invoke<VaultEntry[]>("list_entries"),
  createEntry: (input: EntryInput) => invoke<VaultEntry>("create_entry", { input }),
  updateEntry: (id: string, input: EntryInput) =>
    invoke<VaultEntry>("update_entry", { id, input }),
  deleteEntry: (id: string) => invoke<void>("delete_entry", { id }),
  generatePassword: (options: PasswordOptions) =>
    invoke<string>("generate_password", { options }),
};
