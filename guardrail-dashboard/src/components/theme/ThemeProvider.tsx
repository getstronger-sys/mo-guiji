"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ResolvedTheme, ThemePreference } from "@/lib/theme";
import {
  applyTheme,
  getStoredTheme,
  getSystemTheme,
  resolveTheme,
  SYSTEM_THEME_QUERY,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");

  const syncTheme = useCallback((preference: ThemePreference) => {
    const resolved = resolveTheme(preference);
    setThemeState(preference);
    setResolvedTheme(resolved);
    applyTheme(preference);
  }, []);

  useEffect(() => {
    syncTheme(getStoredTheme());
  }, [syncTheme]);

  useEffect(() => {
    if (theme !== "system") return;

    const media = window.matchMedia(SYSTEM_THEME_QUERY);
    const onChange = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      document.documentElement.setAttribute("data-theme", resolved);
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback(
    (next: ThemePreference) => {
      syncTheme(next);
    },
    [syncTheme]
  );

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
