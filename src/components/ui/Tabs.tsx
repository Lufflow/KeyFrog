import { clsx } from "clsx";
import type { ReactNode } from "react";

interface TabItem<T extends string> {
  id: T;
  label: string;
  icon: ReactNode;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  active: T;
  onChange: (tab: T) => void;
}

export function Tabs<T extends string>({ items, active, onChange }: TabsProps<T>) {
  return (
    <div className="flex gap-1 overflow-x-auto lg:grid">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={clsx(
            "flex h-10 shrink-0 items-center gap-3 rounded-md px-3 text-left text-sm font-medium transition",
            active === item.id
              ? "bg-app-accent text-white"
              : "text-app-muted hover:bg-app-subtle hover:text-app-ink",
          )}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
