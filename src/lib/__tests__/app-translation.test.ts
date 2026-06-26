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

  it("translates UI catalog via LLM for other locales", async () => {
    mockChatJson.mockResolvedValue({
      "nav.inbox": "Bandeja de entrada",
      "nav.dashboard": "Panel",
    });

    const messages = await translateUiMessages("es", ["nav.inbox", "nav.dashboard"]);
    expect(mockChatJson).toHaveBeenCalledTimes(1);
    expect(messages["nav.inbox"]).toBe("Bandeja de entrada");
    expect(messages["nav.dashboard"]).toBe("Panel");
  });
});