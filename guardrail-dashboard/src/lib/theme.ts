export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

/** @deprecated Use ThemePreference */
export type Theme = ThemePreference;

export const THEME_STORAGE_KEY = "guardtrace-theme";

export const chartColors: Record<
  ResolvedTheme,
  { grid: string; muted: string; barBg: string; accent: string; safe: string; foreground: string }
> = {
  dark: {
    grid: "#1e2a42",
    muted: "#8b9cb8",
    barBg: "#1e2a42",
    accent: "#3b82f6",
    safe: "#10b981",
    foreground: "#e8ecf4",
  },
  light: {
    grid: "#e2e8f0",
    muted: "#64748b",
    barBg: "#e2e8f0",
    accent: "#2563eb",
    safe: "#059669",
    foreground: "#0f172a",
  },
};

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") return getSystemTheme();
  return preference;
}

export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "dark" || stored === "light" || stored === "system") return stored;
  return "system";
}

export function applyTheme(preference: ThemePreference) {
  const resolved = resolveTheme(preference);
  document.documentElement.setAttribute("data-theme", resolved);
  localStorage.setItem(THEME_STORAGE_KEY, preference);
}

export const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";
