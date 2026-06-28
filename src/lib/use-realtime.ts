"use client";

import { useEffect, useRef } from "react";

const STORAGE_KEY = "feedbackflow-realtime-enabled";
const DEFAULT_INTERVAL_MS = 30000;

/**
 * Lightweight real-time polling hook.
 *
 * When enabled in localStorage, the hook calls `refetch` on a 30-second
 * interval. Pages can opt-in by passing their own refetch callback.
 */
export function useRealtime(refetch?: () => void, intervalMs = DEFAULT_INTERVAL_MS) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    let intervalId: number | undefined;

    function start() {
      if (typeof window === "undefined") return;
      const enabled = window.localStorage.getItem(STORAGE_KEY) === "true";
      if (!enabled || !refetchRef.current) return;
      intervalId = window.setInterval(() => {
        refetchRef.current?.();
      }, intervalMs);
    }

    function stop() {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
    }

    function handleStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      stop();
      start();
    }

    start();
    window.addEventListener("storage", handleStorage);
    return () => {
      stop();
      window.removeEventListener("storage", handleStorage);
    };
  }, [intervalMs]);
}
