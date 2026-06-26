import { chatJson } from "@/lib/llm";

// ---------------------------------------------------------------------------
// Predictive Severity
//
// Before running a full analysis (sentiment, topics, action items, etc.) we
// ask the local LLM to quickly predict how *severe* a piece of feedback is
// likely to be. This lets the UI / routing pipeline prioritise urgent items
// (crashes, outages, data loss) ahead of trivial ones (typos, cosmetics).
//
// The LLM output is post-processed by `calibratePrediction`, which applies
// deterministic keyword rules so that critical phrases can never be
// under-predicted and trivial phrases can never be over-predicted — even if
// the model is slightly off.
// ---------------------------------------------------------------------------

export interface SeverityPrediction {
  severity: number;
  confidence: number;
  reasoning: string;
  suggestedPriority: string;
}

export const SEVERITY_SYSTEM_PROMPT =
  "You are a severity prediction model. Given customer feedback text, predict the severity level 1-5. Return JSON with {severity: number, confidence: number, reasoning: string, suggestedPriority: string}";

// Keywords that should force a minimum severity of 4 (urgent / critical).
const HIGH_SEVERITY_KEYWORDS = [
  "crash",
  "data loss",
  "outage",
  "down",
  "unavailable",
  "broken",
  "critical",
  "urgent",
  "emergency",
  "security",
  "breach",
  "corrupt",
  "fatal",
  "cannot access",
  "can't access",
  "locked out",
  "payment failed",
  "billing error",
];

// Keywords that should cap severity at a maximum of 2 (trivial / cosmetic).
const LOW_SEVERITY_KEYWORDS = [
  "typo",
  "cosmetic",
  "spelling",
  "padding",
  "alignment",
  "color",
  "colour",
  "font",
  "whitespace",
  "nitpick",
  "minor",
  "nice to have",
  "nit",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Adjust a severity prediction based on keyword rules.
 *
 * - If the text contains a high-severity keyword (e.g. "crash", "data loss",
 *   "outage") the severity is raised to at least 4.
 * - If the text contains a low-severity keyword (e.g. "typo", "cosmetic") the
 *   severity is capped at 2.
 * - Otherwise the prediction is returned unchanged.
 *
 * High-severity keywords take precedence over low-severity ones when both are
 * present (an outage that someone also called "minor" is still an outage).
 *
 * The returned object is a shallow copy; the input is not mutated.
 */
export function calibratePrediction(
  prediction: { severity: number },
  text?: string
): { severity: number } {
  // When no text is supplied we cannot apply keyword rules, so return as-is.
  if (!text) {
    return { ...prediction };
  }

  const lower = text.toLowerCase();

  const hasHigh = HIGH_SEVERITY_KEYWORDS.some((kw) => lower.includes(kw));
  const hasLow = LOW_SEVERITY_KEYWORDS.some((kw) => lower.includes(kw));

  let severity = clamp(Math.round(prediction.severity), 1, 5);

  if (hasHigh) {
    severity = Math.max(severity, 4);
  }
  if (hasLow && !hasHigh) {
    severity = Math.min(severity, 2);
  }

  return { severity };
}

/**
 * Predict the severity of a single piece of feedback text using the local LLM.
 *
 * The LLM response is validated and calibrated against keyword rules. Throws
 * if the LLM call fails or returns invalid JSON / out-of-range values.
 */
export async function predictSeverity(
  text: string
): Promise<SeverityPrediction> {
  if (!text || !text.trim()) {
    throw new Error("text is required");
  }

  const raw = await chatJson<Record<string, unknown>>(
    SEVERITY_SYSTEM_PROMPT,
    text,
    { temperature: 0 }
  );

  const prediction = parsePrediction(raw);
  const calibrated = calibratePrediction(prediction, text);
  return { ...prediction, ...calibrated };
}

/**
 * Predict severities for many texts, isolating failures so one bad input does
 * not abort the whole batch. Returns a parallel array of results where each
 * entry is either `{ ok: true, prediction }` or `{ ok: false, error }`.
 */
export async function batchPredictSeverity(
  texts: string[]
): Promise<
  Array<
    | { ok: true; prediction: SeverityPrediction }
    | { ok: false; error: string }
  >
> {
  const results: Awaited<ReturnType<typeof batchPredictSeverity>> = [];
  for (const text of texts) {
    try {
      const prediction = await predictSeverity(text);
      results.push({ ok: true, prediction });
    } catch (err) {
      results.push({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}

// Validate + coerce the raw LLM JSON into a SeverityPrediction.
function parsePrediction(raw: Record<string, unknown>): SeverityPrediction {
  const severity = Number(raw.severity);
  const confidence = Number(raw.confidence);
  const reasoning = typeof raw.reasoning === "string" ? raw.reasoning : "";
  const suggestedPriority =
    typeof raw.suggestedPriority === "string" ? raw.suggestedPriority : "";

  if (!Number.isFinite(severity) || severity < 1 || severity > 5) {
    throw new Error(
      `LLM returned invalid severity: ${JSON.stringify(raw.severity)}`
    );
  }
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error(
      `LLM returned invalid confidence: ${JSON.stringify(raw.confidence)}`
    );
  }
  if (!reasoning) {
    throw new Error("LLM returned empty reasoning");
  }
  if (!suggestedPriority) {
    throw new Error("LLM returned empty suggestedPriority");
  }

  return {
    severity: Math.round(severity),
    confidence,
    reasoning,
    suggestedPriority,
  };
}
