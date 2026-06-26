import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isGoogleAuthEnabled } from "@/lib/auth";

describe("isGoogleAuthEnabled", () => {
  const originalId = process.env.GOOGLE_CLIENT_ID;
  const originalSecret = process.env.GOOGLE_CLIENT_SECRET;

  afterEach(() => {
    process.env.GOOGLE_CLIENT_ID = originalId;
    process.env.GOOGLE_CLIENT_SECRET = originalSecret;
  });

  it("returns false when Google env vars are missing", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(isGoogleAuthEnabled()).toBe(false);
  });

  it("returns true when both Google env vars are set", () => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    expect(isGoogleAuthEnabled()).toBe(true);
  });

  it("returns false when only client id is set", () => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(isGoogleAuthEnabled()).toBe(false);
  });
});