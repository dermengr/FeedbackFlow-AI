"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LANGUAGES,
  type LanguageOption,
} from "@/lib/i18n/languages";
import {
  enMessages,
  getStaticMessages,
  hasStaticMessages,
  type MessageKey,
} from "@/lib/i18n/messages";

const STORAGE_KEY = "ff_locale";
const CACHE_PREFIX = "ff_ui_messages_";

type Messages = Record<string, string>;

interface LocaleContextValue {
  locale: string;
  languages: LanguageOption[];
  loading: boolean;
  setLocale: (code: string) => void;
  t: (key: MessageKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readCachedMessages(locale: string): Messages | null {
  if (typeof window === "undefined" || locale === DEFAULT_LOCALE) return null;
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${locale}`);
    if (!raw) return null;
    return JSON.parse(raw) as Messages;
  } catch {
    return null;
  }
}

function writeCachedMessages(locale: string, messages: Messages) {
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${locale}`, JSON.stringify(messages));
  } catch {
    // Storage full or unavailable — ignore.
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);
  const [messages, setMessages] = useState<Messages>({ ...enMessages });
  const [loading, setLoading] = useState(false);

  const loadUiMessages = useCallback(async (code: string) => {
    if (hasStaticMessages(code)) {
      const staticMessages = getStaticMessages(code);
      if (staticMessages) {
        setMessages(staticMessages);
        return;
      }
    }

    const cached = readCachedMessages(code);
    if (cached) {
      setMessages({ ...enMessages, ...cached });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/translate/ui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: code }),
      });
      if (!res.ok) {
        setMessages({ ...enMessages });
        return;
      }
      const data = (await res.json()) as { messages: Messages };
      const merged = { ...enMessages, ...data.messages };
      setMessages(merged);
      writeCachedMessages(code, data.messages);
    } catch {
      setMessages({ ...enMessages });
    } finally {
      setLoading(false);
    }
  }, []);

  const setLocale = useCallback(
    (code: string) => {
      const normalized = code.trim().toLowerCase();
      setLocaleState(normalized);
      try {
        localStorage.setItem(STORAGE_KEY, normalized);
      } catch {
        // ignore
      }
      document.documentElement.lang = normalized;
      void loadUiMessages(normalized);
    },
    [loadUiMessages]
  );

  useEffect(() => {
    let initial = DEFAULT_LOCALE;
    try {
      initial = localStorage.getItem(STORAGE_KEY) ?? DEFAULT_LOCALE;
    } catch {
      // ignore
    }
    setLocaleState(initial);
    document.documentElement.lang = initial;
    void loadUiMessages(initial);
  }, [loadUiMessages]);

  const t = useCallback(
    (key: MessageKey) => messages[key] ?? enMessages[key] ?? key,
    [messages]
  );

  const value = useMemo(
    () => ({
      locale,
      languages: SUPPORTED_LANGUAGES,
      loading,
      setLocale,
      t,
    }),
    [locale, loading, setLocale, t]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return {
      locale: DEFAULT_LOCALE,
      languages: SUPPORTED_LANGUAGES,
      loading: false,
      setLocale: () => undefined,
      t: (key: MessageKey) => enMessages[key] ?? key,
    };
  }
  return ctx;
}