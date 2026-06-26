"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { LocaleProvider } from "@/contexts/LocaleContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <LocaleProvider>{children}</LocaleProvider>
    </SessionProvider>
  );
}
