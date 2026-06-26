import { arMessages } from "./ar";
import { deMessages } from "./de";
import { enMessages, MESSAGE_KEYS, type MessageKey } from "./en";
import { esMessages } from "./es";
import { frMessages } from "./fr";
import { itMessages } from "./it";
import { jaMessages } from "./ja";
import { koMessages } from "./ko";
import { nlMessages } from "./nl";
import { plMessages } from "./pl";
import { ptMessages } from "./pt";
import { zhMessages } from "./zh";

const LOCALE_MESSAGES: Record<string, Record<MessageKey, string>> = {
  en: { ...enMessages },
  es: { ...esMessages },
  fr: { ...frMessages },
  de: { ...deMessages },
  pt: { ...ptMessages },
  it: { ...itMessages },
  nl: { ...nlMessages },
  pl: { ...plMessages },
  ja: { ...jaMessages },
  zh: { ...zhMessages },
  ko: { ...koMessages },
  ar: { ...arMessages },
};

export const STATIC_LOCALES = Object.keys(LOCALE_MESSAGES);

export function hasStaticMessages(locale: string): boolean {
  return locale.trim().toLowerCase() in LOCALE_MESSAGES;
}

export function getStaticMessages(
  locale: string
): Record<MessageKey, string> | null {
  const normalized = locale.trim().toLowerCase();
  const localeMessages = LOCALE_MESSAGES[normalized];
  if (!localeMessages) {
    return null;
  }
  if (normalized === "en") {
    return { ...enMessages };
  }
  return { ...enMessages, ...localeMessages };
}

export { enMessages, MESSAGE_KEYS, type MessageKey };