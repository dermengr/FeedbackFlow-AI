"use client";

import { Toaster } from "sonner";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ToastProvider() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch by rendering a placeholder until mounted.
  if (!mounted) return null;

  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      theme={theme === "dark" ? "dark" : "light"}
      toastOptions={{
        className: "rounded-xl border border-slate-200 shadow-lg dark:border-slate-700",
      }}
    />
  );
}
