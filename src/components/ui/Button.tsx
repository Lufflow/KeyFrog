import type { ButtonHTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "info"
  | "warning"
  | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-app-accent bg-app-accent text-white hover:bg-app-accentDark focus-visible:ring-app-accent",
  secondary:
    "border-app-border bg-app-panel text-app-ink hover:bg-app-subtle focus-visible:ring-app-accent",
  ghost:
    "border-transparent bg-transparent text-app-muted hover:bg-app-subtle hover:text-app-ink focus-visible:ring-app-accent",
  danger:
    "border-app-danger bg-app-danger text-white hover:bg-app-danger/85 focus-visible:ring-app-danger",
  info:
    "border-sky-700/60 bg-sky-800/80 text-white hover:bg-sky-800 focus-visible:ring-sky-700",
  warning:
    "border-amber-700/45 bg-amber-700/25 text-amber-100 hover:bg-amber-700/35 focus-visible:ring-amber-600",
  icon:
    "h-9 w-9 shrink-0 border-app-border bg-app-panel p-0 text-app-muted hover:bg-app-subtle hover:text-app-ink focus-visible:ring-app-accent",
};

export function Button({
  variant = "secondary",
  icon,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
