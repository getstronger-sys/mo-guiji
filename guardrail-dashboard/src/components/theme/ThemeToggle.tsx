"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const options: { id: ThemePreference; label: string; icon: typeof Moon }[] = [
  { id: "dark", label: "深色", icon: Moon },
  { id: "light", label: "浅色", icon: Sun },
  { id: "system", label: "系统", icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div className={cn("rounded-lg bg-background/60 p-1 ring-1 ring-border", className)}>
      <div className="mb-1.5 flex items-center justify-between px-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted">外观</p>
        {theme === "system" && (
          <span className="text-[9px] text-muted">
            当前 {resolvedTheme === "dark" ? "深色" : "浅色"}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {options.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-[10px] font-medium transition-all",
              theme === id
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "text-muted hover:text-foreground"
            )}
            aria-pressed={theme === id}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
