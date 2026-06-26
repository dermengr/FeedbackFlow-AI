import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockChatJson } = vi.hoisted(() => ({
  mockChatJson: vi.fn(),
}));

vi.mock("@/lib/llm", () => ({
  chatJson: mockChatJson,
}));

import { translateText, translateUiMessages } from "@/lib/app-translation";

beforeEach(() => {
  mockChatJson.mockReset();
});

describe("app-translation", () => {
  it("returns original text for English target without LLM", async () => {
    const result = await translateText("Hello", "en");
    expect(mockChatJson).not.toHaveBeenCalled();
    expect(result.translatedText).toBe("Hello");
  });

  it("translates text via LLM for non-English targets", async () => {
    mockChatJson.mockResolvedValue({
      translatedText: "Hola",
      detectedLanguage: "en",
      confidence: 0.9,
    });

    const result = await translateText("Hello", "es");
    expect(mockChatJson).toHaveBeenCalledTimes(1);
    expect(result.translatedText).toBe("Hola");
    expect(result.targetLanguage).toBe("es");
  });

  it("returns English messages unchanged for en locale", async () => {
    const messages = await translateUiMessages("en");
    expect(mockChatJson).not.toHaveBeenCalled();
    expect(messages["nav.inbox"]).toBe("Inbox");
  });

  it("returns static Spanish catalog without LLM", async () => {
    const messages = await translateUiMessages("es");
    expect(mockChatJson).not.toHaveBeenCalled();
    expect(messages["nav.inbox"]).toBe("Bandeja de entrada");
    expect(messages["nav.dashboard"]).toBe("Panel");
  });

  it("uses LLM for keyed subset even when static catalog exists", async () => {
    mockChatJson.mockResolvedValue({
      "nav.inbox": "Bandeja LLM",
      "nav.dashboard": "Panel LLM",
    });

    const messages = await translateUiMessages("es", ["nav.inbox", "nav.dashboard"]);
    expect(mockChatJson).toHaveBeenCalled();
    expect(messages["nav.inbox"]).toBe("Bandeja LLM");
    expect(messages["nav.dashboard"]).toBe("Panel LLM");
  });

  it("preserves sourceLanguage as detectedLanguage when provided", async () => {
    mockChatJson.mockResolvedValue({
      translatedText: "Hola",
      detectedLanguage: "es",
      confidence: 0.9,
    });

    const result = await translateText("Hello", "es", "en");
    expect(result.detectedLanguage).toBe("en");
    expect(result.translatedText).toBe("Hola");
  });
});