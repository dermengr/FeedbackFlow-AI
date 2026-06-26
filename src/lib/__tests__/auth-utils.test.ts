import { describe, it, expect } from "vitest";
import { sanitizeCallbackUrl } from "@/lib/auth-utils";

describe("sanitizeCallbackUrl", () => {
  it("returns fallback for empty values", () => {
    expect(sanitizeCallbackUrl(null)).toBe("/dashboard");
    expect(sanitizeCallbackUrl("")).toBe("/dashboard");
  });

  it("keeps relative paths", () => {
    expect(sanitizeCallbackUrl("/inbox")).toBe("/inbox");
    expect(sanitizeCallbackUrl("/dashboard")).toBe("/dashboard");
  });

  it("maps root path to dashboard", () => {
    expect(sanitizeCallbackUrl("/")).toBe("/dashboard");
  });

  it("strips host from absolute callback URLs", () => {
    expect(sanitizeCallbackUrl("http://localhost:3000/dashboard")).toBe(
      "/dashboard"
    );
    expect(sanitizeCallbackUrl("https://example.app.github.dev/inbox")).toBe(
      "/inbox"
    );
  });

  it("rejects unsafe values", () => {
    expect(sanitizeCallbackUrl("//evil.com")).toBe("/dashboard");
    expect(sanitizeCallbackUrl("https://evil.com")).toBe("/dashboard");
  });
});