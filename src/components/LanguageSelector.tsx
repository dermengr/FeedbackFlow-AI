"use client";

import { Globe } from "lucide-react";
import { useTranslation } from "@/contexts/LocaleContext";
import { cn } from "@/lib/utils";

export function LanguageSelector({ compact }: { compact?: boolean }) {
  const { locale, languages, loading, setLocale, t } = useTranslation();

  return (
    <label
      className={cn(
        "inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400",
        compact ? "text-xs" : "text-sm"
      )}
    >
      <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sr-only">{t("locale.label")}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        disabled={loading}
        aria-label={t("locale.label")}
        className={cn(
          "rounded-lg border border-slate-200 bg-white py-1.5 pl-2 pr-7 text-slate-700 shadow-sm transition-all",
          "hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20",
          "dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600",
          compact ? "text-xs" : "text-sm",
          loading && "opacity-60"
        )}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}