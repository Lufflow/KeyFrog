import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { clsx } from "clsx";

interface FieldProps {
  label: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, error, children }: FieldProps) {
  return (
    <label className="grid gap-2 text-sm font-medium text-app-ink">
      <span>{label}</span>
      {children}
      {error ? <span className="text-xs font-medium text-app-danger">{error}</span> : null}
    </label>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "h-10 rounded-md border border-app-border bg-app-panel px-3 text-sm text-app-ink outline-none transition placeholder:text-app-muted/70 focus:border-app-accent focus:ring-2 focus:ring-app-accent/20",
        className,
      )}
      {...props}
    />
  );
}

export function SelectInput({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        "select-input h-10 appearance-none rounded-md border border-app-border bg-app-panel px-3 pr-10 text-sm text-app-ink outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent/20",
        className,
      )}
      {...props}
    />
  );
}
