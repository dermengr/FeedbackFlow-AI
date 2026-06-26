import { describe, it, expect } from "vitest";
import {
  MESSAGE_KEYS,
  STATIC_LOCALES,
  enMessages,
  getStaticMessages,
  hasStaticMessages,
} from "@/lib/i18n/messages";

describe("i18n static messages", () => {
  it("registers all supported static locales", () => {
    expect(STATIC_LOCALES).toContain("en");
    expect(STATIC_LOCALES).toContain("es");
    expect(STATIC_LOCALES).toContain("fr");
    expect(STATIC_LOCALES.length).toBeGreaterThanOrEqual(12);
  });

  it("every static locale has all message keys", () => {
    for (const locale of STATIC_LOCALES) {
      const messages = getStaticMessages(locale);
      expect(messages).not.toBeNull();
      for (const key of MESSAGE_KEYS) {
        expect(messages?.[key]).toBeTruthy();
      }
    }
  });

  it("Spanish catalog translates nav labels", () => {
    const es = getStaticMessages("es");
    expect(es?.["nav.dashboard"]).toBe("Panel");
    expect(es?.["nav.inbox"]).toBe("Bandeja de entrada");
    expect(es?.["nav.dashboard"]).not.toBe(enMessages["nav.dashboard"]);
  });

  it("hasStaticMessages matches registry", () => {
    expect(hasStaticMessages("es")).toBe(true);
    expect(hasStaticMessages("xx")).toBe(false);
  });
});