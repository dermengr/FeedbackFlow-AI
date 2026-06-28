"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { ToastProvider } from "@/components/ToastProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <LocaleProvider>
        {children}
        <ToastProvider />
      </LocaleProvider>
    </SessionProvider>
  );
}
