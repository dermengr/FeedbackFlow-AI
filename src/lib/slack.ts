// Bonus: outgoing Slack webhook for high-severity feedback (severity >= 4).
// Disabled if SLACK_WEBHOOK_URL is unset.

export interface SlackPayload {
  text: string;
  blocks?: unknown[];
}

export function isSlackEnabled(): boolean {
  return Boolean(process.env.SLACK_WEBHOOK_URL);
}

export async function sendSlackMessage(payload: SlackPayload): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Slack webhook failed (${res.status}): ${text}`);
  }
}

export async function notifyHighSeverity(args: {
  externalId: string;
  title?: string | null;
  url?: string | null;
  sentiment: string;
  topics: string[];
  severityScore: number;
  summary: string;
}): Promise<void> {
  if (!isSlackEnabled()) return;

  const topicStr = args.topics.join(", ");
  const link = args.url ? `<${args.url}|${args.externalId}>` : args.externalId;
  const text = `:rotating_light: *High severity feedback* (severity ${args.severityScore}/5)\n*${args.title ?? args.externalId}*\n${args.summary}\n_Sentiment: ${args.sentiment} • Topics: ${topicStr}_\n${link}`;

  await sendSlackMessage({ text });
}
