"use client";

import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const v = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
    navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(v)}`, { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
