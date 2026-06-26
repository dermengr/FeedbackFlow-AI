// Client-safe constants for API keys. Separated from api-keys.ts which
// imports node:crypto (server-only) and cannot be bundled into client components.

export const ALLOWED_SCOPES = [
  "read:feedback",
  "write:feedback",
  "read:analytics",
] as const;
export type ApiScope = (typeof ALLOWED_SCOPES)[number];
