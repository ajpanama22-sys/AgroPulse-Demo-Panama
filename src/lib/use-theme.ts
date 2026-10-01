"use client";

// Tema claro/oscuro recordado en este navegador (preferencia por visitante).
import { useSyncExternalStore } from "react";

const KEY = "agp-theme";
const listeners = new Set<() => void>();

function leer(): "light" | "dark" {
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    leer,
    () => "light" as const,
  );
  const toggle = () => {
    try {
      localStorage.setItem(KEY, theme === "dark" ? "light" : "dark");
    } catch {}
    listeners.forEach((l) => l());
  };
  return { theme, toggle };
}
