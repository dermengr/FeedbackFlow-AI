import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/llm", () => ({
  chatCompletion: vi.fn(),
}));

import { chatCompletion } from "@/lib/llm";
import { checkLlmHealth } from "@/lib/llm-health";

const mockChat = vi.mocked(chatCompletion);

beforeEach(() => {
  mockChat.mockReset();
  delete process.env.LLM_PROVIDER;
  delete process.env.OLLAMA_MODEL;
});

describe("checkLlmHealth", () => {
  it("returns healthy when the model responds", async () => {
    mockChat.mockResolvedValue("MODEL_OK");
    const result = await checkLlmHealth();
    expect(result.status).toBe("healthy");
    expect(result.reachable).toBe(true);
    expect(result.provider).toBe("ollama");
    expect(result.model).toBe("qwen2.5:0.5b");
    expect(result.probeResponse).toBe("MODEL_OK");
  });

  it("returns down when the LLM throws", async () => {
    mockChat.mockRejectedValue(new Error("connection refused"));
    const result = await checkLlmHealth();
    expect(result.status).toBe("down");
    expect(result.reachable).toBe(false);
    expect(result.detail).toContain("connection refused");
  });
});