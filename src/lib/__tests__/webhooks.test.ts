import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma with a mock webhookConfig model we control from each test.
const { mockWebhookConfig } = vi.hoisted(() => ({
  mockWebhookConfig: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    webhookConfig: mockWebhookConfig,
  },
}));

// Mock global fetch for triggerWebhook tests.
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import {
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  triggerWebhook,
  VALID_EVENTS,
} from "@/lib/webhooks";

beforeEach(() => {
  mockWebhookConfig.findMany.mockReset();
  mockWebhookConfig.findUnique.mockReset();
  mockWebhookConfig.create.mockReset();
  mockWebhookConfig.update.mockReset();
  mockWebhookConfig.delete.mockReset();
  mockFetch.mockReset();
});

function makeRow(overrides: Partial<{
  id: string;
  name: string;
  url: string;
  events: unknown;
  secret: string | null;
  enabled: boolean;
}> = {}) {
  return {
    id: "w1",
    name: "Notify",
    url: "https://example.com/hook",
    events: ["feedback.new"],
    secret: null,
    enabled: true,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-02T00:00:00Z"),
    ...overrides,
  };
}

describe("webhooks service", () => {
  describe("VALID_EVENTS", () => {
    it("exports the expected set of events", () => {
      expect(VALID_EVENTS).toEqual([
        "feedback.new",
        "feedback.escalated",
        "feedback.actioned",
        "ingest.complete",
        "digest.sent",
      ]);
    });
  });

  describe("listWebhooks", () => {
    it("returns webhooks mapped to WebhookDto, newest first", async () => {
      mockWebhookConfig.findMany.mockResolvedValue([
        makeRow({ id: "w2", name: "B" }),
        makeRow({ id: "w1", name: "A" }),
      ]);

      const webhooks = await listWebhooks();

      expect(mockWebhookConfig.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "desc" },
      });
      expect(webhooks).toHaveLength(2);
      expect(webhooks[0]).toEqual({
        id: "w2",
        name: "B",
        url: "https://example.com/hook",
        events: ["feedback.new"],
        hasSecret: false,
        enabled: true,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
      });
    });

    it("returns an empty array when no webhooks exist", async () => {
      mockWebhookConfig.findMany.mockResolvedValue([]);
      const webhooks = await listWebhooks();
      expect(webhooks).toEqual([]);
    });
  });

  describe("createWebhook", () => {
    it("calls prisma.webhookConfig.create with validated data", async () => {
      mockWebhookConfig.create.mockResolvedValue(
        makeRow({ id: "w3", name: "New", events: ["feedback.new", "digest.sent"] })
      );

      const webhook = await createWebhook({
        name: "New",
        url: "https://example.com/hook",
        events: ["feedback.new", "digest.sent"],
      });

      expect(mockWebhookConfig.create).toHaveBeenCalledWith({
        data: {
          name: "New",
          url: "https://example.com/hook",
          events: ["feedback.new", "digest.sent"],
          secret: null,
          enabled: true,
        },
      });
      expect(webhook.id).toBe("w3");
      expect(webhook.events).toEqual(["feedback.new", "digest.sent"]);
    });

    it("passes a trimmed secret when provided", async () => {
      mockWebhookConfig.create.mockResolvedValue(
        makeRow({ secret: "shh" })
      );
      await createWebhook({
        name: "X",
        url: "https://example.com/hook",
        events: ["feedback.new"],
        secret: "  shh  ",
      });
      expect(mockWebhookConfig.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ secret: "shh" }),
      });
    });

    it("throws when name is empty", async () => {
      await expect(
        createWebhook({ name: "", url: "https://example.com", events: ["feedback.new"] })
      ).rejects.toThrow(/name is required/);
      expect(mockWebhookConfig.create).not.toHaveBeenCalled();
    });

    it("throws when url is empty", async () => {
      await expect(
        createWebhook({ name: "X", url: "", events: ["feedback.new"] })
      ).rejects.toThrow(/URL is required/);
      expect(mockWebhookConfig.create).not.toHaveBeenCalled();
    });

    it("throws when events is empty", async () => {
      await expect(
        createWebhook({ name: "X", url: "https://example.com", events: [] })
      ).rejects.toThrow(/At least one event/);
      expect(mockWebhookConfig.create).not.toHaveBeenCalled();
    });

    it("throws on invalid events", async () => {
      await expect(
        createWebhook({
          name: "X",
          url: "https://example.com",
          events: ["feedback.new", "not.real"],
        })
      ).rejects.toThrow(/Invalid event: not\.real/);
      expect(mockWebhookConfig.create).not.toHaveBeenCalled();
    });
  });

  describe("updateWebhook", () => {
    it("calls prisma.webhookConfig.update with provided fields", async () => {
      mockWebhookConfig.update.mockResolvedValue(
        makeRow({ name: "Renamed", enabled: false })
      );

      const webhook = await updateWebhook("w1", {
        name: "Renamed",
        enabled: false,
      });

      expect(mockWebhookConfig.update).toHaveBeenCalledWith({
        where: { id: "w1" },
        data: { name: "Renamed", enabled: false },
      });
      expect(webhook.name).toBe("Renamed");
      expect(webhook.enabled).toBe(false);
    });

    it("validates events when updating them", async () => {
      await expect(
        updateWebhook("w1", { events: ["bogus"] })
      ).rejects.toThrow(/Invalid event: bogus/);
      expect(mockWebhookConfig.update).not.toHaveBeenCalled();
    });

    it("clears secret when given empty string", async () => {
      mockWebhookConfig.update.mockResolvedValue(makeRow({ secret: null }));
      await updateWebhook("w1", { secret: "   " });
      expect(mockWebhookConfig.update).toHaveBeenCalledWith({
        where: { id: "w1" },
        data: { secret: null },
      });
    });
  });

  describe("deleteWebhook", () => {
    it("calls prisma.webhookConfig.delete with the provided id", async () => {
      mockWebhookConfig.delete.mockResolvedValue({ id: "w1" });
      await deleteWebhook("w1");
      expect(mockWebhookConfig.delete).toHaveBeenCalledWith({
        where: { id: "w1" },
      });
    });
  });

  describe("triggerWebhook", () => {
    it("POSTs JSON to the webhook URL and returns success on 2xx", async () => {
      mockWebhookConfig.findUnique.mockResolvedValue(makeRow());
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const result = await triggerWebhook("w1", "feedback.new", { id: "f1" });

      expect(result).toEqual({ success: true, statusCode: 200 });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("https://example.com/hook");
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body as string);
      expect(body.event).toBe("feedback.new");
      expect(body.payload).toEqual({ id: "f1" });
      expect(init.headers["Content-Type"]).toBe("application/json");
      expect(init.headers["X-Webhook-Signature"]).toBeUndefined();
    });

    it("returns success false on non-ok response with statusCode", async () => {
      mockWebhookConfig.findUnique.mockResolvedValue(makeRow());
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const result = await triggerWebhook("w1", "feedback.new", {});

      expect(result).toEqual({ success: false, statusCode: 500 });
    });

    it("includes an HMAC-SHA256 signature header when a secret is set", async () => {
      mockWebhookConfig.findUnique.mockResolvedValue(
        makeRow({ secret: "topsecret" })
      );
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      await triggerWebhook("w1", "feedback.new", { id: "f1" });

      const init = mockFetch.mock.calls[0][1];
      const body = init.body as string;
      const expected = require("crypto")
        .createHmac("sha256", "topsecret")
        .update(body)
        .digest("hex");
      expect(init.headers["X-Webhook-Signature"]).toBe(expected);
    });

    it("does not send when webhook does not exist", async () => {
      mockWebhookConfig.findUnique.mockResolvedValue(null);
      const result = await triggerWebhook("missing", "feedback.new", {});
      expect(result).toEqual({ success: false });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("does not send when webhook is disabled", async () => {
      mockWebhookConfig.findUnique.mockResolvedValue(makeRow({ enabled: false }));
      const result = await triggerWebhook("w1", "feedback.new", {});
      expect(result).toEqual({ success: false });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("does not send when the event is not subscribed", async () => {
      mockWebhookConfig.findUnique.mockResolvedValue(
        makeRow({ events: ["digest.sent"] })
      );
      const result = await triggerWebhook("w1", "feedback.new", {});
      expect(result).toEqual({ success: false });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns success false when fetch throws", async () => {
      mockWebhookConfig.findUnique.mockResolvedValue(makeRow());
      mockFetch.mockRejectedValue(new Error("network"));
      const result = await triggerWebhook("w1", "feedback.new", {});
      expect(result).toEqual({ success: false });
    });
  });
});
