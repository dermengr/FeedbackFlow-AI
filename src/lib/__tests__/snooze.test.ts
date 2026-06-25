import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma so the snooze service can be tested without a database.
// vi.hoisted ensures the mock fns are initialized before the hoisted
// vi.mock factory runs.
const { mockUpdate, mockUpdateMany } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackAnalysis: {
      update: mockUpdate,
      updateMany: mockUpdateMany,
    },
  },
}));

beforeEach(() => {
  mockUpdate.mockReset();
  mockUpdateMany.mockReset();
});

import {
  snoozeFeedback,
  unsnoozeFeedback,
  clearExpiredSnoozes,
} from "@/lib/snooze";

describe("Snooze service", () => {
  describe("snoozeFeedback", () => {
    it("calls feedbackAnalysis.update with the given date", async () => {
      const until = new Date("2099-01-01T00:00:00Z");
      mockUpdate.mockResolvedValue({ id: "a1", feedbackItemId: "f1", snoozedUntil: until });

      await snoozeFeedback("f1", until);

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { feedbackItemId: "f1" },
        data: { snoozedUntil: until },
      });
    });
  });

  describe("unsnoozeFeedback", () => {
    it("sets snoozedUntil to null", async () => {
      mockUpdate.mockResolvedValue({ id: "a1", feedbackItemId: "f1", snoozedUntil: null });

      await unsnoozeFeedback("f1");

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { feedbackItemId: "f1" },
        data: { snoozedUntil: null },
      });
    });
  });

  describe("clearExpiredSnoozes", () => {
    it("calls updateMany with snoozedUntil lt now and returns the count", async () => {
      mockUpdateMany.mockResolvedValue({ count: 3 });

      const before = Date.now();
      const count = await clearExpiredSnoozes();
      const after = Date.now();

      expect(count).toBe(3);
      expect(mockUpdateMany).toHaveBeenCalledTimes(1);
      const call = mockUpdateMany.mock.calls[0][0];
      expect(call.data).toEqual({ snoozedUntil: null });
      expect(call.where).toHaveProperty("snoozedUntil");
      expect(call.where.snoozedUntil).toHaveProperty("lt");
      const lt: Date = call.where.snoozedUntil.lt;
      expect(lt.getTime()).toBeGreaterThanOrEqual(before);
      expect(lt.getTime()).toBeLessThanOrEqual(after);
    });
  });
});
