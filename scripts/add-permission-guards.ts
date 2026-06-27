import fs from "fs";
import path from "path";

const PERMISSION_MAP: Record<string, { read?: string; write?: string }> = {
  "src/app/api/feedback/route.ts": { read: "API_FEEDBACK_READ", write: "API_FEEDBACK_WRITE" },
  "src/app/api/feedback/[id]/route.ts": { read: "API_FEEDBACK_READ", write: "API_FEEDBACK_WRITE" },
  "src/app/api/feedback/[id]/reply/route.ts": { write: "API_COMMENTS_WRITE" },
  "src/app/api/feedback/[id]/labels/route.ts": { write: "API_LABELS_WRITE" },
  "src/app/api/feedback/[id]/archive/route.ts": { write: "API_ARCHIVE_WRITE" },
  "src/app/api/feedback/[id]/snooze/route.ts": { write: "API_SNOOZE_WRITE" },
  "src/app/api/feedback/[id]/assign/route.ts": { write: "API_ASSIGN_WRITE" },
  "src/app/api/feedback/[id]/comments/route.ts": { write: "API_COMMENTS_WRITE" },
  "src/app/api/feedback/[id]/vote/route.ts": { write: "API_VOTE_WRITE" },
  "src/app/api/feedback/[id]/links/route.ts": { write: "API_LINKS_WRITE" },
  "src/app/api/feedback/[id]/translate/route.ts": { write: "API_TRANSLATE_WRITE" },
  "src/app/api/feedback/[id]/impact/route.ts": { read: "API_FEEDBACK_READ" },
  "src/app/api/feedback/[id]/activity/route.ts": { read: "API_FEEDBACK_READ" },
  "src/app/api/feedback/[id]/similar/route.ts": { read: "API_FEEDBACK_READ" },
  "src/app/api/feedback/[id]/suggest-categories/route.ts": { read: "API_FEEDBACK_READ" },
  "src/app/api/feedback/export/route.ts": { read: "API_EXPORT_READ" },
  "src/app/api/feedback/bulk/route.ts": { write: "API_FEEDBACK_BULK" },
  "src/app/api/feedback/clusters/route.ts": { read: "API_FEEDBACK_READ" },
  "src/app/api/insights/route.ts": { read: "API_INSIGHTS_READ" },
  "src/app/api/trends/route.ts": { read: "API_TRENDS_READ" },
  "src/app/api/trends/emerging/route.ts": { read: "API_EMERGING_TRENDS_READ" },
  "src/app/api/dashboard/route.ts": { read: "API_FEEDBACK_READ" },
  "src/app/api/correlations/route.ts": { read: "API_CORRELATIONS_READ" },
  "src/app/api/comparison/route.ts": { read: "API_COMPARISON_READ" },
  "src/app/api/funnel/route.ts": { read: "API_FUNNEL_READ" },
  "src/app/api/heatmap/route.ts": { read: "API_HEATMAP_READ" },
  "src/app/api/anomalies/route.ts": { read: "API_ANOMALIES_READ" },
  "src/app/api/stats/realtime/route.ts": { read: "API_REALTIME_STATS_READ" },
  "src/app/api/digest/route.ts": { read: "API_DIGEST_READ" },
  "src/app/api/team/metrics/route.ts": { read: "API_TEAM_READ", write: "API_TEAM_READ" },
  "src/app/api/sources/route.ts": { read: "API_SOURCES_READ", write: "API_SOURCES_WRITE" },
  "src/app/api/sources/[id]/route.ts": { read: "API_SOURCES_READ", write: "API_SOURCES_WRITE" },
  "src/app/api/sources/github/route.ts": { write: "API_SOURCES_WRITE" },
  "src/app/api/health/route.ts": { read: "API_HEALTH_READ" },
  "src/app/api/health/llm/route.ts": { read: "API_HEALTH_READ" },
  "src/app/api/logs/route.ts": { read: "API_LOGS_READ" },
  "src/app/api/routing-rules/route.ts": { read: "API_ROUTING_READ", write: "API_ROUTING_WRITE" },
  "src/app/api/routing-rules/[id]/route.ts": { read: "API_ROUTING_READ", write: "API_ROUTING_WRITE" },
  "src/app/api/webhooks/route.ts": { read: "API_WEBHOOKS_READ", write: "API_WEBHOOKS_WRITE" },
  "src/app/api/webhooks/[id]/route.ts": { read: "API_WEBHOOKS_READ", write: "API_WEBHOOKS_WRITE" },
  "src/app/api/webhook/slack/route.ts": { write: "API_WEBHOOKS_WRITE" },
  "src/app/api/widgets/route.ts": { read: "API_WIDGETS_READ", write: "API_WIDGETS_WRITE" },
  "src/app/api/widgets/[id]/route.ts": { read: "API_WIDGETS_READ", write: "API_WIDGETS_WRITE" },
  "src/app/api/views/route.ts": { read: "API_VIEWS_READ", write: "API_VIEWS_WRITE" },
  "src/app/api/views/[id]/route.ts": { read: "API_VIEWS_READ", write: "API_VIEWS_WRITE" },
  "src/app/api/export/templates/route.ts": { read: "API_EXPORT_READ", write: "API_EXPORT_WRITE" },
  "src/app/api/export/templates/[id]/route.ts": { read: "API_EXPORT_READ", write: "API_EXPORT_WRITE" },
  "src/app/api/search/route.ts": { read: "API_SEARCH_READ" },
  "src/app/api/search/suggestions/route.ts": { read: "API_SEARCH_READ" },
  "src/app/api/timeline/route.ts": { read: "API_TIMELINE_READ" },
  "src/app/api/users/route.ts": { read: "API_USERS_WRITE", write: "API_USERS_WRITE" },
  "src/app/api/api-keys/route.ts": { read: "API_API_KEYS_WRITE", write: "API_API_KEYS_WRITE" },
  "src/app/api/api-keys/[id]/route.ts": { read: "API_API_KEYS_WRITE", write: "API_API_KEYS_WRITE" },
  "src/app/api/ingest/route.ts": { write: "API_INGEST_WRITE" },
  "src/app/api/ingest/upload/route.ts": { write: "API_INGEST_WRITE" },
  "src/app/api/reply-templates/route.ts": { read: "API_REPLY_TEMPLATES_WRITE", write: "API_REPLY_TEMPLATES_WRITE" },
  "src/app/api/reply-templates/[id]/route.ts": { read: "API_REPLY_TEMPLATES_WRITE", write: "API_REPLY_TEMPLATES_WRITE" },
  "src/app/api/notifications/route.ts": { read: "API_NOTIFICATIONS_WRITE", write: "API_NOTIFICATIONS_WRITE" },
  "src/app/api/onboarding/route.ts": { read: "API_NOTIFICATIONS_WRITE", write: "API_NOTIFICATIONS_WRITE" },
  "src/app/api/translate/route.ts": { write: "API_TRANSLATE_WRITE" },
  "src/app/api/translate/ui/route.ts": { write: "API_TRANSLATE_WRITE" },
  "src/app/api/predict-severity/route.ts": { write: "API_PREDICT_WRITE" },
  "src/app/api/summarize/route.ts": { write: "API_SUMMARIZE_WRITE" },
  "src/app/api/root-cause/route.ts": { write: "API_ROOT_CAUSE_WRITE" },
  "src/app/api/labels/route.ts": { read: "API_LABELS_WRITE", write: "API_LABELS_WRITE" },
};

const GUARD_LINE = (perm: string) =>
  `  const forbidden = await requirePermission(auth, PERMISSIONS.${perm});\n  if (forbidden) return forbidden;`;

function processFile(relPath: string, perms: { read?: string; write?: string }) {
  const fullPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP (not found): ${relPath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, "utf-8");

  if (content.includes("requirePermission")) {
    console.log(`SKIP (already guarded): ${relPath}`);
    return;
  }

  // Add requirePermission to request-auth imports
  content = content.replace(
    /from "@\/lib\/request-auth";?/g,
    (m) => m.replace("}", ", requirePermission }")
  );

  // Add PERMISSIONS import from roles if not present
  if (!content.includes('import { PERMISSIONS }')) {
    content = content.replace(
      /import .*from "@\/lib\/request-auth";?/,
      (m) => `import { PERMISSIONS } from "@/lib/roles";\n${m}`
    );
  }

  const hasGet = content.includes("export async function GET");
  const hasPost = content.includes("export async function POST");
  const hasPatch = content.includes("export async function PATCH");
  const hasDelete = content.includes("export async function DELETE");
  const hasPut = content.includes("export async function PUT");

  const readPerm = perms.read ?? perms.write;
  const writePerm = perms.write ?? perms.read;

  if (!readPerm && !writePerm) {
    console.log(`SKIP (no permissions mapped): ${relPath}`);
    return;
  }

  // For files with only GET (or no write methods), add read guard to all auth checks
  const onlyRead = hasGet && !hasPost && !hasPatch && !hasDelete && !hasPut;
  const onlyWrite = !hasGet && (hasPost || hasPatch || hasDelete || hasPut);

  if (onlyRead && readPerm) {
    const target = `  if (!auth) return unauthorizedResponse();`;
    const replacement = `  if (!auth) return unauthorizedResponse();\n${GUARD_LINE(readPerm)}`;
    content = content.split(target).join(replacement);
  } else if (onlyWrite && writePerm) {
    const target = `  if (!auth) return unauthorizedResponse();`;
    const replacement = `  if (!auth) return unauthorizedResponse();\n${GUARD_LINE(writePerm)}`;
    content = content.split(target).join(replacement);
  } else if (hasGet && (hasPost || hasPatch || hasDelete || hasPut)) {
    // Mixed: we need to add read guard after first auth check (GET)
    // and write guard after subsequent auth checks (POST/PATCH/DELETE)
    let first = true;
    const target = `  if (!auth) return unauthorizedResponse();`;
    content = content.split(target).map((chunk, idx) => {
      if (idx === 0) return chunk; // first chunk is before first match
      if (first) {
        first = false;
        return `  if (!auth) return unauthorizedResponse();\n${GUARD_LINE(readPerm!)}` + chunk;
      }
      return `  if (!auth) return unauthorizedResponse();\n${GUARD_LINE(writePerm!)}` + chunk;
    }).join(target);
  } else {
    // Fallback: add the single available permission to all auth checks
    const perm = readPerm ?? writePerm;
    const target = `  if (!auth) return unauthorizedResponse();`;
    const replacement = `  if (!auth) return unauthorizedResponse();\n${GUARD_LINE(perm!)}`;
    content = content.split(target).join(replacement);
  }

  fs.writeFileSync(fullPath, content);
  console.log(`GUARDED: ${relPath}`);
}

for (const [relPath, perms] of Object.entries(PERMISSION_MAP)) {
  processFile(relPath, perms);
}

console.log("\nDone!");
