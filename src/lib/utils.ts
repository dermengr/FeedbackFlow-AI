// Small shared helpers.

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDay(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function truncate(text: string, max = 160): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Compute exponential backoff delay (ms) for an attempt number (1-indexed),
// capped at 30s, with optional jitter.
export function backoffDelay(attempt: number, capMs = 30_000): number {
  const base = Math.min(capMs, 2 ** (attempt - 1) * 1000);
  const jitter = Math.floor(Math.random() * 500);
  return base + jitter;
}
