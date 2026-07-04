"use client";

import { useSyncExternalStore } from "react";

type Theme = "future" | "minimal";
const THEME_EVENT = "ray-theme-change";

function getTheme(): Theme {
  return document.documentElement.dataset.theme === "minimal" ? "minimal" : "future";
}

function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("ray-theme", theme);
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function ThemeSwitcher() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "future" as Theme);

  return (
    <div className="theme-nav-item" role="group" aria-label="主題">
      <span className="theme-nav-label">主題</span>
      <button type="button" className="theme-option" aria-pressed={theme === "future"} onClick={() => setTheme("future")}>未來風</button>
      <button type="button" className="theme-option" aria-pressed={theme === "minimal"} onClick={() => setTheme("minimal")}>簡約風</button>
    </div>
  );
}
