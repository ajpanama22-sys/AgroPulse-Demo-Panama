"use client";

import { useEffect } from "react";

export default function RegisterSw({ path }: { path: string }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(path, { scope: path === "/sw-campo.js" ? "/campo" : "/ejecutivo" }).catch(() => {});
    }
  }, [path]);
  return null;
}
