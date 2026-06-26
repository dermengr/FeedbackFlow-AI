import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma so the notifications service can be tested without a database.
// vi.hoisted ensures the mock fns are initialized before the hoisted
// vi.mock factory runs.
const { mockUpsert } = vi.hoisted(() => ({
  mockUpsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notificationPref: {
      upsert: mockUpsert,
    },
  },
}));

beforeEach(() => {
  mockUpsert.mockReset();
});

import {
  getNotificationPrefs,
  updateNotificationPrefs,
  shouldNotifyUser,
  DEFAULT_PREFS,
} from "@/lib/notifications";

const samplePrefs = {
  id: "np1",
  userId: "u1",
  emailEnabled: true,
  slackEnabled: false,
  minSeverity: 3,
  digestFrequency: "daily",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Notification preferences service", () => {
  describe("DEFAULT_PREFS", () => {
    it("exposes the expected defaults", () => {
      expect(DEFAULT_PREFS).toEqual({
        emailEnabled: true,
        slackEnabled: false,
        minSeverity: 3,
        digestFrequency: "daily",
      });
    });
  });

  describe("getNotificationPrefs", () => {
    it("returns existing preferences via upsert", async () => {
      mockUpsert.mockResolvedValue(samplePrefs);

      const result = await getNotificationPrefs("u1");

      expect(result).toEqual(samplePrefs);
      expect(mockUpsert).toHaveBeenCalledTimes(1);
      const call = mockUpsert.mock.calls[0][0];
      expect(call.where).toEqual({ userId: "u1" });
      expect(call.update).toEqual({});
    });

    it("creates a default row when none exists and returns it", async () => {
      mockUpsert.mockResolvedValue(samplePrefs);

      const result = await getNotificationPrefs("u1");

      expect(result).toEqual(samplePrefs);
      expect(mockUpsert).toHaveBeenCalledTimes(1);
      const call = mockUpsert.mock.calls[0][0];
      expect(call.where).toEqual({ userId: "u1" });
      expect(call.create.userId).toBe("u1");
      expect(call.create.emailEnabled).toBe(DEFAULT_PREFS.emailEnabled);
      expect(call.create.slackEnabled).toBe(DEFAULT_PREFS.slackEnabled);
      expect(call.create.minSeverity).toBe(DEFAULT_PREFS.minSeverity);
      expect(call.create.digestFrequency).toBe(DEFAULT_PREFS.digestFrequency);
    });
  });

  describe("updateNotificationPrefs", () => {
    it("upserts with only the supplied fields", async () => {
      mockUpsert.mockResolvedValue({ ...samplePrefs, slackEnabled: true });

      await updateNotificationPrefs("u1", { slackEnabled: true });

      expect(mockUpsert).toHaveBeenCalledTimes(1);
      const call = mockUpsert.mock.calls[0][0];
      expect(call.where).toEqual({ userId: "u1" });
      // Omitted fields should not appear in the update payload.
      expect(call.update).toEqual({ slackEnabled: true });
      // The create fallback should fill in the supplied value plus defaults.
      expect(call.create.userId).toBe("u1");
      expect(call.create.slackEnabled).toBe(true);
      expect(call.create.emailEnabled).toBe(DEFAULT_PREFS.emailEnabled);
      expect(call.create.minSeverity).toBe(DEFAULT_PREFS.minSeverity);
      expect(call.create.digestFrequency).toBe(DEFAULT_PREFS.digestFrequency);
    });

    it("passes through all fields when supplied together", async () => {
      mockUpsert.mockResolvedValue(samplePrefs);

      await updateNotificationPrefs("u1", {
        emailEnabled: false,
        slackEnabled: true,
        minSeverity: 5,
        digestFrequency: "weekly",
      });

      const call = mockUpsert.mock.calls[0][0];
      expect(call.update).toEqual({
        emailEnabled: false,
        slackEnabled: true,
        minSeverity: 5,
        digestFrequency: "weekly",
      });
    });
  });

  describe("shouldNotifyUser", () => {
    it("returns true when a channel is enabled and severity meets threshold", async () => {
      mockUpsert.mockResolvedValue({
        ...samplePrefs,
        emailEnabled: true,
        slackEnabled: false,
        minSeverity: 3,
      });

      const ok = await shouldNotifyUser("u1", "feedback.escalated", 4);
      expect(ok).toBe(true);
    });

    it("returns true when severity exactly equals the threshold", async () => {
      mockUpsert.mockResolvedValue({
        ...samplePrefs,
        emailEnabled: true,
        minSeverity: 3,
      });

      const ok = await shouldNotifyUser("u1", "feedback.new", 3);
      expect(ok).toBe(true);
    });

    it("returns false when severity is below the threshold", async () => {
      mockUpsert.mockResolvedValue({
        ...samplePrefs,
        emailEnabled: true,
        slackEnabled: true,
        minSeverity: 4,
      });

      const ok = await shouldNotifyUser("u1", "feedback.new", 2);
      expect(ok).toBe(false);
    });

    it("returns false when both email and slack are disabled", async () => {
      mockUpsert.mockResolvedValue({
        ...samplePrefs,
        emailEnabled: false,
        slackEnabled: false,
        minSeverity: 1,
      });

      const ok = await shouldNotifyUser("u1", "feedback.escalated", 5);
      expect(ok).toBe(false);
    });

    it("returns true when only slack is enabled and severity meets threshold", async () => {
      mockUpsert.mockResolvedValue({
        ...samplePrefs,
        emailEnabled: false,
        slackEnabled: true,
        minSeverity: 2,
      });

      const ok = await shouldNotifyUser("u1", "feedback.escalated", 3);
      expect(ok).toBe(true);
    });

    it("creates default prefs and evaluates them when none exist", async () => {
      mockUpsert.mockResolvedValue({ ...samplePrefs, minSeverity: 3 });

      // Default prefs have emailEnabled=true, minSeverity=3.
      const ok = await shouldNotifyUser("u1", "feedback.new", 3);
      expect(ok).toBe(true);
      expect(mockUpsert).toHaveBeenCalledTimes(1);
    });
  });
});
