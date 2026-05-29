export type AppTab = "vault" | "generator" | "settings";
export type AppLanguage = "ru" | "en";
export type AppTheme = "light" | "dark";

export interface VaultEntry {
  id: string;
  serviceName: string;
  login: string;
  password: string;
  createdAt: string;
  updatedAt: string;
}

export interface EntryInput {
  serviceName: string;
  login: string;
  password: string;
}

export interface PasswordOptions {
  length: number;
  includeLowercase: boolean;
  includeUppercase: boolean;
  includeDigits: boolean;
  includeSymbols: boolean;
  excludeAmbiguous: boolean;
  lowercaseWeight: number;
  uppercaseWeight: number;
  digitsWeight: number;
  symbolsWeight: number;
}

export interface PasswordPattern {
  id: string;
  name: string;
  options: PasswordOptions;
}
