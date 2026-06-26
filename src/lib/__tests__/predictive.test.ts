import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM chatJson so no network/provider call is made.
const { mockChatJson } = vi.hoisted(() => ({
  mockChatJson: vi.fn(),
}));

vi.mock("@/lib/llm", () => ({
  chatJson: mockChatJson,
}));

import {
  predictSeverity,
  batchPredictSeverity,
  calibratePrediction,
  SEVERITY_SYSTEM_PROMPT,
} from "@/lib/predictive";

beforeEach(() => {
  mockChatJson.mockReset();
});

describe("predictive", () => {
  describe("SEVERITY_SYSTEM_PROMPT", () => {
    it("matches the required spec", () => {
      expect(SEVERITY_SYSTEM_PROMPT).toBe(
        "You are a severity prediction model. Given customer feedback text, predict the severity level 1-5. Return JSON with {severity: number, confidence: number, reasoning: string, suggestedPriority: string}"
      );
    });
  });

  describe("predictSeverity", () => {
    it("returns a parsed and calibrated prediction for a valid LLM response", async () => {
      mockChatJson.mockResolvedValue({
        severity: 3,
        confidence: 0.8,
        reasoning: "Mild frustration about a feature.",
        suggestedPriority: "medium",
      });

      const result = await predictSeverity("The dashboard loads slowly.");

      expect(mockChatJson).toHaveBeenCalledWith(
        SEVERITY_SYSTEM_PROMPT,
        "The dashboard loads slowly.",
        { temperature: 0 }
      );
      expect(result).toEqual({
        severity: 3,
        confidence: 0.8,
        reasoning: "Mild frustration about a feature.",
        suggestedPriority: "medium",
      });
    });

    it("raises severity to at least 4 when a high-severity keyword is present", async () => {
      mockChatJson.mockResolvedValue({
        severity: 2,
        confidence: 0.5,
        reasoning: "App keeps crashing.",
        suggestedPriority: "low",
      });

      const result = await predictSeverity("The app crashes on startup");
      expect(result.severity).toBe(4);
      // Non-severity fields are preserved.
      expect(result.reasoning).toBe("App keeps crashing.");
      expect(result.suggestedPriority).toBe("low");
    });

    it("caps severity at 2 when a low-severity keyword is present", async () => {
      mockChatJson.mockResolvedValue({
        severity: 4,
        confidence: 0.6,
        reasoning: "Just a typo.",
        suggestedPriority: "high",
      });

      const result = await predictSeverity("There is a typo on the homepage");
      expect(result.severity).toBe(2);
    });

    it("throws when the LLM call fails", async () => {
      mockChatJson.mockRejectedValue(new Error("LLM down"));

      await expect(
        predictSeverity("Some feedback text")
      ).rejects.toThrow("LLM down");
    });

    it("throws when the LLM returns invalid JSON-shaped output (out-of-range severity)", async () => {
      mockChatJson.mockResolvedValue({
        severity: 9,
        confidence: 0.7,
        reasoning: "x",
        suggestedPriority: "high",
      });

      await expect(predictSeverity("Some text")).rejects.toThrow(
        /invalid severity/i
      );
    });

    it("throws when the LLM returns invalid confidence", async () => {
      mockChatJson.mockResolvedValue({
        severity: 3,
        confidence: 1.5,
        reasoning: "x",
        suggestedPriority: "high",
      });

      await expect(predictSeverity("Some text")).rejects.toThrow(
        /invalid confidence/i
      );
    });

    it("throws when the LLM returns empty reasoning", async () => {
      mockChatJson.mockResolvedValue({
        severity: 3,
        confidence: 0.5,
        reasoning: "",
        suggestedPriority: "high",
      });

      await expect(predictSeverity("Some text")).rejects.toThrow(
        /empty reasoning/i
      );
    });

    it("throws on empty input text", async () => {
      await expect(predictSeverity("")).rejects.toThrow("text is required");
      await expect(predictSeverity("   ")).rejects.toThrow("text is required");
      expect(mockChatJson).not.toHaveBeenCalled();
    });
  });

  describe("batchPredictSeverity", () => {
    it("returns a result per text, isolating failures", async () => {
      mockChatJson
        .mockResolvedValueOnce({
          severity: 5,
          confidence: 0.9,
          reasoning: "Outage reported.",
          suggestedPriority: "critical",
        })
        .mockRejectedValueOnce(new Error("LLM down"))
        .mockResolvedValueOnce({
          severity: 1,
          confidence: 0.7,
          reasoning: "Cosmetic nitpick.",
          suggestedPriority: "low",
        });

      const results = await batchPredictSeverity([
        "Total outage — nothing works",
        "Some text that will fail",
        "Just a typo",
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].ok).toBe(true);
      // "outage" forces min severity 4, but LLM said 5 -> stays 5.
      expect((results[0] as { prediction: { severity: number } }).prediction
        .severity).toBe(5);
      expect(results[1].ok).toBe(false);
      expect((results[1] as { error: string }).error).toBe("LLM down");
      expect(results[2].ok).toBe(true);
      // "typo" caps severity at 2, LLM said 1 -> stays 1.
      expect((results[2] as { prediction: { severity: number } }).prediction
        .severity).toBe(1);
    });

    it("returns an empty array for an empty input", async () => {
      const results = await batchPredictSeverity([]);
      expect(results).toEqual([]);
      expect(mockChatJson).not.toHaveBeenCalled();
    });
  });

  describe("calibratePrediction", () => {
    it("raises severity to 4 when 'crash' is present", () => {
      const out = calibratePrediction(
        { severity: 2 },
        "The app keeps crashing when I upload a file"
      );
      expect(out.severity).toBe(4);
    });

    it("raises severity to 4 when 'data loss' is present", () => {
      const out = calibratePrediction(
        { severity: 1 },
        "I experienced data loss after the update"
      );
      expect(out.severity).toBe(4);
    });

    it("raises severity to 4 when 'outage' is present", () => {
      const out = calibratePrediction(
        { severity: 3 },
        "There is a full outage in production"
      );
      expect(out.severity).toBe(4);
    });

    it("does not lower an already-high severity when a high keyword is present", () => {
      const out = calibratePrediction(
        { severity: 5 },
        "Critical crash affecting all users"
      );
      expect(out.severity).toBe(5);
    });

    it("caps severity at 2 when 'typo' is present", () => {
      const out = calibratePrediction(
        { severity: 4 },
        "There is a typo on the landing page"
      );
      expect(out.severity).toBe(2);
    });

    it("caps severity at 2 when 'cosmetic' is present", () => {
      const out = calibratePrediction(
        { severity: 3 },
        "This is purely a cosmetic issue"
      );
      expect(out.severity).toBe(2);
    });

    it("does not raise a low severity when no low keyword is present", () => {
      const out = calibratePrediction(
        { severity: 1 },
        "There is a typo in the footer"
      );
      expect(out.severity).toBe(1);
    });

    it("leaves severity unchanged when no keywords are present", () => {
      expect(calibratePrediction({ severity: 3 }, "The dashboard is slow").severity).toBe(3);
      expect(calibratePrediction({ severity: 1 }, "Hello world").severity).toBe(1);
      expect(calibratePrediction({ severity: 5 }, "Everything is broken").severity).toBe(5);
    });

    it("high-severity keyword takes precedence over low-severity keyword", () => {
      // Both "crash" and "minor" present -> treated as high severity.
      const out = calibratePrediction(
        { severity: 2 },
        "This is a minor crash but still a crash"
      );
      expect(out.severity).toBe(4);
    });

    it("is case-insensitive", () => {
      const out = calibratePrediction(
        { severity: 1 },
        "The app CRASHES constantly"
      );
      expect(out.severity).toBe(4);
    });

    it("clamps out-of-range severities into 1-5", () => {
      expect(calibratePrediction({ severity: 0 }, "nothing special").severity).toBe(1);
      expect(calibratePrediction({ severity: 9 }, "nothing special").severity).toBe(5);
    });

    it("returns a copy and does not mutate the input", () => {
      const input = { severity: 3 };
      const out = calibratePrediction(input, "The app crashes");
      expect(out).not.toBe(input);
      expect(input.severity).toBe(3);
      expect(out.severity).toBe(4);
    });

    it("returns the prediction unchanged when no text is supplied", () => {
      const out = calibratePrediction({ severity: 3 });
      expect(out.severity).toBe(3);
      expect(out).not.toBe({ severity: 3 });
    });
  });
});
