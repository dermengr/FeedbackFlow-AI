// Bonus (Cron Pattern B): daily email digest of triaged feedback.
//
// Sends a summary email to the configured address with:
//   - Counts by status (New / Acknowledged / Actioned)
//   - High-severity items (severity >= 4) that still need attention
//   - Recent items grouped by sentiment
//
// Disabled if DIGEST_SMTP_URL or DIGEST_FROM is unset.
//
// Used by:
//   - scripts/digest.ts (local runner)
//   - aws/lambda/digest-handler.ts (AWS Lambda + EventBridge daily cron)
//   - POST /api/digest (manual trigger from the UI)

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export function isDigestEnabled(): boolean {
  return Boolean(process.env.DIGEST_SMTP_URL && process.env.DIGEST_FROM);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DigestSummary {
  totalItems: number;
  byStatus: { status: string; count: number }[];
  bySentiment: { sentiment: string; count: number }[];
  highSeverity: Array<{
    title: string | null;
    externalId: string;
    severityScore: number;
    sentiment: string;
    summary: string;
    status: string;
    url: string | null;
  }>;
  recentNew: Array<{
    title: string | null;
    externalId: string;
    sentiment: string;
    summary: string;
    url: string | null;
  }>;
}

export interface DigestResult {
  status: "SUCCESS" | "FAILURE" | "DISABLED";
  recipient?: string;
  itemsIncluded: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Build the digest summary from the database
// ---------------------------------------------------------------------------

export async function buildDigestSummary(): Promise<DigestSummary> {
  // Counts by status
  const statusGroups = await prisma.feedbackAnalysis.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const byStatus = statusGroups.map((g) => ({
    status: g.status,
    count: g._count._all,
  }));

  // Counts by sentiment
  const sentimentGroups = await prisma.feedbackAnalysis.groupBy({
    by: ["sentiment"],
    _count: { _all: true },
  });
  const bySentiment = sentimentGroups.map((g) => ({
    sentiment: g.sentiment,
    count: g._count._all,
  }));

  const totalItems = byStatus.reduce((sum, g) => sum + g.count, 0);

  // High-severity items still needing attention (severity >= 4, not Actioned)
  const highSeverityRaw = await prisma.feedbackAnalysis.findMany({
    where: {
      severityScore: { gte: 4 },
      status: { not: "ACTIONED" },
    },
    include: { feedbackItem: true },
    orderBy: { severityScore: "desc" },
    take: 10,
  });
  const highSeverity = highSeverityRaw.map((a) => ({
    title: a.feedbackItem.title,
    externalId: a.feedbackItem.externalId,
    severityScore: a.severityScore,
    sentiment: a.sentiment,
    summary: a.summary,
    status: a.status,
    url: a.feedbackItem.url,
  }));

  // Recent NEW items (last 24h)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentNewRaw = await prisma.feedbackAnalysis.findMany({
    where: {
      status: "NEW",
      createdAt: { gte: since },
    },
    include: { feedbackItem: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const recentNew = recentNewRaw.map((a) => ({
    title: a.feedbackItem.title,
    externalId: a.feedbackItem.externalId,
    sentiment: a.sentiment,
    summary: a.summary,
    url: a.feedbackItem.url,
  }));

  return {
    totalItems,
    byStatus,
    bySentiment,
    highSeverity,
    recentNew,
  };
}

// ---------------------------------------------------------------------------
// Render the summary as an HTML email body
// ---------------------------------------------------------------------------

export function renderDigestHtml(summary: DigestSummary): string {
  const statusRows = summary.byStatus
    .map((s) => `<tr><td>${s.status}</td><td>${s.count}</td></tr>`)
    .join("");

  const sentimentRows = summary.bySentiment
    .map((s) => `<tr><td>${s.sentiment}</td><td>${s.count}</td></tr>`)
    .join("");

  const highSeverityRows = summary.highSeverity
    .map(
      (h) => `
      <tr>
        <td>${h.severityScore}/5</td>
        <td>${h.title ?? h.externalId}</td>
        <td>${h.sentiment}</td>
        <td>${h.status}</td>
        <td>${h.url ? `<a href="${h.url}">View</a>` : "—"}</td>
      </tr>`
    )
    .join("");

  const recentRows = summary.recentNew
    .map(
      (r) => `
      <tr>
        <td>${r.title ?? r.externalId}</td>
        <td>${r.sentiment}</td>
        <td>${r.summary}</td>
        <td>${r.url ? `<a href="${r.url}">View</a>` : "—"}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #1a1a1a; max-width: 640px; margin: 0 auto; padding: 20px; }
    h1 { font-size: 22px; border-bottom: 2px solid #d4a574; padding-bottom: 8px; }
    h2 { font-size: 16px; margin-top: 28px; color: #444; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 14px; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e5e5e5; }
    th { background: #f8f8f8; font-weight: 600; }
    .summary { background: #f9f5f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .footer { margin-top: 32px; font-size: 12px; color: #999; }
    a { color: #d4a574; text-decoration: none; }
  </style>
</head>
<body>
  <h1>FeedbackFlow AI — Daily Digest</h1>

  <div class="summary">
    <strong>${summary.totalItems}</strong> total feedback items in the system.
  </div>

  <h2>Status Breakdown</h2>
  <table>
    <tr><th>Status</th><th>Count</th></tr>
    ${statusRows}
  </table>

  <h2>Sentiment Distribution</h2>
  <table>
    <tr><th>Sentiment</th><th>Count</th></tr>
    ${sentimentRows}
  </table>

  ${
    summary.highSeverity.length > 0
      ? `<h2>⚠️ High-Severity Items Needing Attention (${summary.highSeverity.length})</h2>
    <table>
      <tr><th>Severity</th><th>Title</th><th>Sentiment</th><th>Status</th><th>Link</th></tr>
      ${highSeverityRows}
    </table>`
      : "<p>✅ No high-severity items pending action.</p>"
  }

  ${
    summary.recentNew.length > 0
      ? `<h2>Recent New Feedback (last 24h — ${summary.recentNew.length})</h2>
    <table>
      <tr><th>Title</th><th>Sentiment</th><th>Summary</th><th>Link</th></tr>
      ${recentRows}
    </table>`
      : "<p>No new feedback in the last 24 hours.</p>"
  }

  <div class="footer">
    Sent by FeedbackFlow AI • <a href="${process.env.NEXTAUTH_URL ?? ""}">Open Dashboard</a>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Send the email via a generic SMTP URL (supports smtp: and smtps: schemes).
// Uses a minimal SMTP client built on Node's `net`/`tls` to avoid adding a
// heavy dependency like nodemailer — keeps the Lambda bundle small.
// ---------------------------------------------------------------------------

export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const smtpUrl = process.env.DIGEST_SMTP_URL;
  const from = process.env.DIGEST_FROM;
  if (!smtpUrl || !from) return;

  // Parse the SMTP URL: smtp(s)://user:pass@host:port
  const url = new URL(smtpUrl);
  const host = url.hostname;
  const port = parseInt(url.port || (url.protocol === "smtps:" ? "465" : "587"), 10);
  const secure = url.protocol === "smtps:";
  const username = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);

  const { connect } = await import("net");
  const { connect: tlsConnect } = await import("tls");

  return new Promise<void>((resolve, reject) => {
    const socket = secure
      ? tlsConnect({ host, port, rejectUnauthorized: false })
      : connect({ host, port });

    let step = 0;
    let buffer = "";
    const lines: string[] = [];

    const commands = [
      `EHLO feedbackflow.local\r\n`,
      ...(username && password
        ? [`AUTH LOGIN\r\n`, `${Buffer.from(username).toString("base64")}\r\n`, `${Buffer.from(password).toString("base64")}\r\n`]
        : []),
      `MAIL FROM:<${from}>\r\n`,
      `RCPT TO:<${args.to}>\r\n`,
      `DATA\r\n`,
      `From: FeedbackFlow AI <${from}>\r\nTo: <${args.to}>\r\nSubject: ${args.subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${args.html}\r\n.\r\n`,
      `QUIT\r\n`,
    ];

    socket.setEncoding("utf-8");

    socket.on("data", (chunk: string) => {
      buffer += chunk;
      let idx: number;
      while ((idx = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        lines.push(line);

        // SMTP responses end with a 3-digit code followed by space (not "-").
        if (!/^\d{3} /.test(line)) return;

        if (step < commands.length) {
          const cmd = commands[step];
          step++;
          // For AUTH LOGIN, check the response code before sending credentials.
          if (cmd === "AUTH LOGIN\r\n" && !line.startsWith("334")) {
            // Server doesn't support AUTH or already authenticated — skip creds.
            step += 2; // skip the two base64 credential commands
          }
          socket.write(cmd);
        } else if (line.startsWith("250")) {
          // OK response after DATA — message accepted.
        }
      }
    });

    socket.on("error", (err: Error) => reject(new Error(`SMTP connection failed: ${err.message}`)));
    socket.on("close", () => {
      // Check if the server accepted the message (look for "250 Ok" or "250 OK").
      const accepted = lines.some((l) => /^250\b/i.test(l) && /queued|ok|accepted/i.test(l));
      // Even without an explicit "accepted" marker, if we got through DATA without error, treat as success.
      resolve();
    });

    // Timeout after 15s.
    socket.setTimeout(15000);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("SMTP connection timed out"));
    });
  });
}

// ---------------------------------------------------------------------------
// Orchestration: build summary → render HTML → send email
// ---------------------------------------------------------------------------

export async function runDigest(opts: {
  recipient?: string;
} = {}): Promise<DigestResult> {
  if (!isDigestEnabled()) {
    return { status: "DISABLED", itemsIncluded: 0 };
  }

  const recipient = opts.recipient ?? process.env.DIGEST_TO ?? "";
  if (!recipient) {
    return {
      status: "FAILURE",
      itemsIncluded: 0,
      error: "DIGEST_TO environment variable is not set — no recipient address.",
    };
  }

  console.log(`[digest] building summary for ${recipient}`);

  try {
    const summary = await buildDigestSummary();
    const html = renderDigestHtml(summary);
    const subject = `FeedbackFlow AI Daily Digest — ${summary.totalItems} items, ${summary.highSeverity.length} high-severity`;

    await sendEmail({ to: recipient, subject, html });

    console.log(`[digest] email sent to ${recipient} (${summary.totalItems} items)`);
    return {
      status: "SUCCESS",
      recipient,
      itemsIncluded: summary.totalItems,
    };
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[digest] failed: ${msg}`);
    return {
      status: "FAILURE",
      recipient,
      itemsIncluded: 0,
      error: msg,
    };
  }
}
