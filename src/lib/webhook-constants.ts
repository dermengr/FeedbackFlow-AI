// Client-safe constants for webhooks. Separated from webhooks.ts which
// imports node crypto (server-only) and cannot be bundled into client components.

export const VALID_EVENTS = [
  "feedback.new",
  "feedback.escalated",
  "feedback.actioned",
  "ingest.complete",
  "digest.sent",
] as const;
export type WebhookEvent = (typeof VALID_EVENTS)[number];
