"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "ieee-hub-theme";

function getSystemTheme(): ThemeMode {
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

function readInitialTheme(): ThemeMode {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return getSystemTheme();
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<ThemeMode | null>(null);

  useEffect(() => {
    const t = readInitialTheme();
    setTheme(t);
    document.documentElement.dataset.theme = t;
    document.documentElement.style.colorScheme = t;

    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;

    const onChange = () => {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark") return; // user explicitly chose
      const next = getSystemTheme();
      setTheme(next);
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
    };

    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const isDark = theme === "dark";

  const ariaLabel = useMemo(
    () => (isDark ? "Switch to light theme" : "Switch to dark theme"),
    [isDark]
  );

  function toggle() {
    const next: ThemeMode = isDark ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={ariaLabel}
      className={
        "relative inline-flex items-center justify-center rounded-full border px-2.5 py-2 transition-all duration-200 " +
        "bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)] shadow-[0_2px_8px_var(--shadow)] " +
        "hover:bg-[var(--bg-secondary)] focus:outline-none focus:ring-4 focus:ring-[color-mix(in_srgb,var(--accent-primary)_20%,transparent)] " +
        className
      }
    >
      <span className="relative w-6 h-6">
        <Sun
          className={
            "absolute inset-0 w-6 h-6 transition-all duration-200 " +
            (isDark ? "opacity-0 -rotate-90 scale-75" : "opacity-100 rotate-0 scale-100")
          }
          style={{ color: "var(--accent-gold)" }}
        />
        <Moon
          className={
            "absolute inset-0 w-6 h-6 transition-all duration-200 " +
            (isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-75")
          }
          style={{ color: "var(--accent-primary)" }}
        />
      </span>
    </button>
  );
}

