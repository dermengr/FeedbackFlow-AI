import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { VALID_EVENTS, type WebhookEvent } from "@/lib/webhook-constants";

// Re-export for backward compatibility (server-side consumers).
export { VALID_EVENTS, type WebhookEvent };

export interface WebhookDto {
  id: string;
  name: string;
  url: string;
  events: string[];
  hasSecret: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookInput {
  name: string;
  url: string;
  events: string[];
  secret?: string | null;
}

export interface UpdateWebhookInput {
  name?: string;
  url?: string;
  events?: string[];
  secret?: string | null;
  enabled?: boolean;
}

export interface TriggerResult {
  success: boolean;
  statusCode?: number;
}

function isValidEvent(value: string): value is WebhookEvent {
  return (VALID_EVENTS as readonly string[]).includes(value);
}

function toDto(w: {
  id: string;
  name: string;
  url: string;
  events: unknown;
  secret: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): WebhookDto {
  const events = Array.isArray(w.events) ? (w.events as string[]) : [];
  return {
    id: w.id,
    name: w.name,
    url: w.url,
    events,
    hasSecret: Boolean(w.secret),
    enabled: w.enabled,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

const WEBHOOK_FETCH_TIMEOUT_MS = 10_000;

function isBlockedWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
    if (host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("169.254.")) {
      return true;
    }
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
    return false;
  } catch {
    return true;
  }
}

// listWebhooks — return all webhook configs, newest first.
export async function listWebhooks(): Promise<WebhookDto[]> {
  const webhooks = await prisma.webhookConfig.findMany({
    orderBy: { createdAt: "desc" },
  });
  return webhooks.map(toDto);
}

// createWebhook — create a new webhook config after validating events.
export async function createWebhook(
  data: CreateWebhookInput
): Promise<WebhookDto> {
  if (!data.name || !data.name.trim()) {
    throw new Error("Webhook name is required");
  }
  if (!data.url || !data.url.trim()) {
    throw new Error("Webhook URL is required");
  }
  if (isBlockedWebhookUrl(data.url.trim())) {
    throw new Error("Webhook URL must be a public HTTPS endpoint");
  }
  if (!Array.isArray(data.events) || data.events.length === 0) {
    throw new Error("At least one event is required");
  }
  for (const ev of data.events) {
    if (!isValidEvent(ev)) {
      throw new Error(`Invalid event: ${ev}`);
    }
  }

  const webhook = await prisma.webhookConfig.create({
    data: {
      name: data.name.trim(),
      url: data.url.trim(),
      events: data.events as Prisma.InputJsonValue,
      secret: data.secret?.trim() || null,
      enabled: true,
    },
  });
  return toDto(webhook);
}

// updateWebhook — update an existing webhook config.
export async function updateWebhook(
  id: string,
  data: UpdateWebhookInput
): Promise<WebhookDto> {
  const updateData: Prisma.WebhookConfigUpdateInput = {};
  if (data.name !== undefined) {
    if (!data.name.trim()) throw new Error("Webhook name cannot be empty");
    updateData.name = data.name.trim();
  }
  if (data.url !== undefined) {
    if (!data.url.trim()) throw new Error("Webhook URL cannot be empty");
    if (isBlockedWebhookUrl(data.url.trim())) {
      throw new Error("Webhook URL must be a public HTTPS endpoint");
    }
    updateData.url = data.url.trim();
  }
  if (data.events !== undefined) {
    if (!Array.isArray(data.events) || data.events.length === 0) {
      throw new Error("At least one event is required");
    }
    for (const ev of data.events) {
      if (!isValidEvent(ev)) {
        throw new Error(`Invalid event: ${ev}`);
      }
    }
    updateData.events = data.events as Prisma.InputJsonValue;
  }
  if (data.secret !== undefined) {
    updateData.secret = data.secret?.trim() || null;
  }
  if (data.enabled !== undefined) {
    updateData.enabled = data.enabled;
  }

  const webhook = await prisma.webhookConfig.update({
    where: { id },
    data: updateData,
  });
  return toDto(webhook);
}

// deleteWebhook — remove a webhook config by id.
export async function deleteWebhook(id: string): Promise<void> {
  await prisma.webhookConfig.delete({ where: { id } });
}

// triggerWebhook — POST a JSON payload to the webhook URL, optionally signed
// with an HMAC-SHA256 signature header when a secret is configured.
export async function triggerWebhook(
  webhookId: string,
  event: string,
  payload: unknown
): Promise<TriggerResult> {
  const webhook = await prisma.webhookConfig.findUnique({
    where: { id: webhookId },
  });
  if (!webhook) {
    return { success: false };
  }
  if (!webhook.enabled) {
    return { success: false };
  }
  const events = Array.isArray(webhook.events) ? (webhook.events as string[]) : [];
  if (!events.includes(event)) {
    return { success: false };
  }

  const body = JSON.stringify({ event, payload, timestamp: Date.now() });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (webhook.secret) {
    const signature = crypto
      .createHmac("sha256", webhook.secret)
      .update(body)
      .digest("hex");
    headers["X-Webhook-Signature"] = signature;
  }

  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(WEBHOOK_FETCH_TIMEOUT_MS),
    });
    return { success: res.ok, statusCode: res.status };
  } catch (err) {
    console.warn(
      `[webhooks] trigger failed for ${webhookId} (${event}):`,
      err
    );
    return { success: false };
  }
}

/** Fire all enabled webhooks subscribed to `event` (best-effort, non-blocking). */
export async function dispatchWebhooks(
  event: WebhookEvent,
  payload: unknown
): Promise<void> {
  const webhooks = await prisma.webhookConfig.findMany({
    where: { enabled: true },
  });

  const targets = webhooks.filter((w) => {
    const events = Array.isArray(w.events) ? (w.events as string[]) : [];
    return events.includes(event);
  });

  await Promise.all(
    targets.map((w) => triggerWebhook(w.id, event, payload).catch(() => undefined))
  );
}
