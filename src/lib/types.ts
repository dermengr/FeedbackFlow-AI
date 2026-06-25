// Shared domain types used across the app.

export const SENTIMENTS = ["positive", "neutral", "negative"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

// Canonical topic taxonomy used by the LLM prompt. The model may emit any
// string, but these are the expected/encouraged values.
export const TOPIC_TAXONOMY = [
  "Bug Report",
  "Feature Request",
  "Pricing",
  "Performance",
  "UX/UI",
  "Documentation",
  "Security",
  "Integration",
  "Customer Support",
  "Onboarding",
  "Other",
] as const;

export type Topic = (typeof TOPIC_TAXONOMY)[number];

export type FeedbackStatus = "NEW" | "ACKNOWLEDGED" | "ACTIONED";

export const FEEDBACK_STATUSES = ["NEW", "ACKNOWLEDGED", "ACTIONED"] as const;

// Shape returned by the LLM and stored (minus storage concerns).
export interface LlmAnalysisResult {
  sentiment: Sentiment;
  topics: string[];
  severity_score: number; // 1-5
  summary: string;
}

// A normalized feedback item fetched from an external source, before persistence.
export interface RawFeedbackItem {
  source: string;
  externalId: string;
  title?: string | null;
  rawContent: string;
  authorLogin?: string | null;
  url?: string | null;
  originalTimestamp: Date;
}
