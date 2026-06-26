import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock crypto so generateApiKey / hashApiKey produce deterministic output.
const { mockRandomBytes, mockCreateHash } = vi.hoisted(() => ({
  mockRandomBytes: vi.fn(),
  mockCreateHash: vi.fn(),
}));

vi.mock("node:crypto", () => ({
  default: {
    randomBytes: mockRandomBytes,
    createHash: mockCreateHash,
  },
}));

// Mock prisma so the api-keys service can be tested without a database.
const { mockCreate, mockFindMany, mockFindUnique, mockDelete, mockUpdate } =
  vi.hoisted(() => ({
    mockCreate: vi.fn(),
    mockFindMany: vi.fn(),
    mockFindUnique: vi.fn(),
    mockDelete: vi.fn(),
    mockUpdate: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      create: mockCreate,
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      delete: mockDelete,
      update: mockUpdate,
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Default fake hashing: echo the data as hex-ish digest so we can assert
  // the raw key was hashed (not stored verbatim).
  mockCreateHash.mockReturnValue({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockImplementation((enc: string) => `hash_${enc}`),
  });
});

import {
  generateApiKey,
  hashApiKey,
  createApiKey,
  listApiKeys,
  deleteApiKey,
  validateApiKey,
  updateLastUsed,
} from "@/lib/api-keys";

describe("generateApiKey", () => {
  it("produces a key with the ffk_ prefix and 32 hex chars", () => {
    mockRandomBytes.mockReturnValueOnce(Buffer.from("0123456789abcdef0123456789abcdef", "hex"));

    const { rawKey } = generateApiKey();

    expect(rawKey).toMatch(/^ffk_[0-9a-f]{32}$/);
    expect(rawKey.length).toBe(4 + 32);
  });

  it("hashes the raw key with sha256 and returns the hash", () => {
    mockRandomBytes.mockReturnValueOnce(
      Buffer.from("0123456789abcdef0123456789abcdef", "hex")
    );

    const { rawKey, hashedKey } = generateApiKey();

    // createHash was called with "sha256"
    expect(mockCreateHash).toHaveBeenCalledWith("sha256");
    // The digest was requested as hex
    expect(hashedKey).toBe("hash_hex");
    // The hash must NOT equal the raw key
    expect(hashedKey).not.toBe(rawKey);
  });

  it("extracts the first 12 characters as the prefix", () => {
    mockRandomBytes.mockReturnValueOnce(
      Buffer.from("0123456789abcdef0123456789abcdef", "hex")
    );

    const { rawKey, prefix } = generateApiKey();

    expect(prefix).toBe(rawKey.slice(0, 12));
    expect(prefix).toMatch(/^ffk_[0-9a-f]{8}$/);
    expect(prefix.length).toBe(12);
  });
});

describe("hashApiKey", () => {
  it("uses sha256 and a hex digest", () => {
    const hash = hashApiKey("ffk_something");

    expect(mockCreateHash).toHaveBeenCalledWith("sha256");
    expect(hash).toBe("hash_hex");
  });
});

describe("createApiKey", () => {
  it("stores the hash (not the raw key) and returns the raw key once", async () => {
    mockRandomBytes.mockReturnValueOnce(
      Buffer.from("0123456789abcdef0123456789abcdef", "hex")
    );
    const createdDate = new Date("2024-02-01T00:00:00.000Z");
    mockCreate.mockResolvedValueOnce({
      id: "key_1",
      name: "CI bot",
      prefix: "ffk_01234567",
      scopes: ["read:feedback"],
      lastUsedAt: null,
      createdAt: createdDate,
    });

    const result = await createApiKey("user_1", {
      name: "CI bot",
      scopes: ["read:feedback"],
    });

    // The persisted record uses the hashed key, never the raw key.
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0][0];
    expect(call.data.hashedKey).toBe("hash_hex");
    expect(call.data.hashedKey).not.toBe(result.rawKey);
    expect(call.data).not.toHaveProperty("hashedKey", result.rawKey);
    expect(call.data.userId).toBe("user_1");
    expect(call.data.name).toBe("CI bot");
    expect(call.data.scopes).toEqual(["read:feedback"]);

    // The raw key is returned to the caller exactly once.
    expect(result.rawKey).toMatch(/^ffk_[0-9a-f]{32}$/);
    expect(result.id).toBe("key_1");
    expect((result as unknown as Record<string, unknown>).hashedKey).toBeUndefined();
    expect(result.createdAt).toBe(createdDate.toISOString());
  });

  it("filters out scopes that are not in the allowed list", async () => {
    mockRandomBytes.mockReturnValueOnce(
      Buffer.from("0123456789abcdef0123456789abcdef", "hex")
    );
    mockCreate.mockResolvedValueOnce({
      id: "key_2",
      name: "bad scopes",
      prefix: "ffk_01234567",
      scopes: ["read:feedback"],
      lastUsedAt: null,
      createdAt: new Date("2024-02-01T00:00:00.000Z"),
    });

    await createApiKey("user_1", {
      name: "bad scopes",
      scopes: ["read:feedback", "admin:all", "delete:everything"],
    });

    const call = mockCreate.mock.calls[0][0];
    expect(call.data.scopes).toEqual(["read:feedback"]);
  });
});

describe("listApiKeys", () => {
  it("queries by userId and omits the hashedKey via select", async () => {
    const date = new Date("2024-03-01T00:00:00.000Z");
    mockFindMany.mockResolvedValueOnce([
      {
        id: "key_1",
        name: "CI bot",
        prefix: "ffk_01234567",
        scopes: ["read:feedback"],
        lastUsedAt: date,
        createdAt: date,
      },
    ]);

    const result = await listApiKeys("user_1");

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "key_1",
      name: "CI bot",
      prefix: "ffk_01234567",
      scopes: ["read:feedback"],
      lastUsedAt: date.toISOString(),
      createdAt: date.toISOString(),
    });
    // No DTO should expose a hashedKey field.
    expect(result[0]).not.toHaveProperty("hashedKey");
  });
});

describe("deleteApiKey", () => {
  it("deletes the key when it exists and is owned by the user", async () => {
    mockFindUnique.mockResolvedValueOnce({ id: "key_1", userId: "user_1" });
    mockDelete.mockResolvedValueOnce({ id: "key_1" });

    const ok = await deleteApiKey("key_1", "user_1");

    expect(ok).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "key_1" } });
  });

  it("returns false when the key is owned by another user", async () => {
    mockFindUnique.mockResolvedValueOnce({ id: "key_1", userId: "user_2" });

    const ok = await deleteApiKey("key_1", "user_1");

    expect(ok).toBe(false);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("returns false when the key does not exist", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const ok = await deleteApiKey("missing", "user_1");

    expect(ok).toBe(false);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

describe("updateLastUsed", () => {
  it("sets lastUsedAt to the current time", async () => {
    mockUpdate.mockResolvedValueOnce({ id: "key_1" });
    const before = Date.now();

    await updateLastUsed("key_1");

    const after = Date.now();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "key_1" },
      data: { lastUsedAt: expect.any(Date) },
    });
    const ts: Date = mockUpdate.mock.calls[0][0].data.lastUsedAt;
    expect(ts.getTime()).toBeGreaterThanOrEqual(before);
    expect(ts.getTime()).toBeLessThanOrEqual(after);
  });

  it("does not throw when the update fails (best-effort)", async () => {
    mockUpdate.mockRejectedValueOnce(new Error("db down"));

    await expect(updateLastUsed("key_1")).resolves.toBeUndefined();
  });
});

describe("validateApiKey", () => {
  it("returns null for keys without the ffk_ prefix", async () => {
    const result = await validateApiKey("not_a_real_key");
    expect(result).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("looks up by hash, updates lastUsedAt, and returns userId + scopes", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: "key_1",
      userId: "user_1",
      scopes: ["read:feedback", "read:analytics"],
    });
    mockUpdate.mockResolvedValueOnce({ id: "key_1" });

    const result = await validateApiKey("ffk_0123456789abcdef0123456789abcdef");

    expect(mockFindUnique).toHaveBeenCalledTimes(1);
    const call = mockFindUnique.mock.calls[0][0];
    expect(call.where.hashedKey).toBe("hash_hex");
    expect(call.where.hashedKey).not.toBe(
      "ffk_0123456789abcdef0123456789abcdef"
    );

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "key_1" },
      data: { lastUsedAt: expect.any(Date) },
    });

    expect(result).toEqual({
      userId: "user_1",
      scopes: ["read:feedback", "read:analytics"],
    });
  });

  it("returns null when no key matches the hash", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const result = await validateApiKey("ffk_0123456789abcdef0123456789abcdef");

    expect(result).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("normalizes non-array scopes to an empty array", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: "key_1",
      userId: "user_1",
      scopes: null,
    });
    mockUpdate.mockResolvedValueOnce({ id: "key_1" });

    const result = await validateApiKey("ffk_0123456789abcdef0123456789abcdef");

    expect(result).toEqual({ userId: "user_1", scopes: [] });
  });
});
