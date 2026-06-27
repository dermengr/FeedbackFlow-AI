import fs from "fs";
import path from "path";

function findRouteFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findRouteFiles(full));
    } else if (entry.name === "route.ts") {
      results.push(full);
    }
  }
  return results;
}

const apiDir = path.resolve("src/app/api");
const files = findRouteFiles(apiDir);

for (const file of files) {
  let content = fs.readFileSync(file, "utf-8");
  let updated = content;

  // 1. Fix duplicate unauthorizedResponse lines
  // Pattern: `if (!auth) return unauthorizedResponse();  if (!auth) return unauthorizedResponse();`
  updated = updated.replace(
    /if \(!auth\) return unauthorizedResponse\(\);\s+if \(!auth\) return unauthorizedResponse\(\);/g,
    "if (!auth) return unauthorizedResponse();"
  );

  // 2. Fix bad import formatting from the script
  // `{  getRequestAuth, unauthorizedResponse , requirePermission, }` → `{ getRequestAuth, unauthorizedResponse, requirePermission }`
  updated = updated.replace(
    /\{\s+getRequestAuth,\s+unauthorizedResponse\s+,\s+requirePermission,\s+\}/g,
    "{ getRequestAuth, unauthorizedResponse, requirePermission }"
  );

  // 3. Fix `await requirePermission` → `requirePermission` (since we're making it sync)
  updated = updated.replace(/await requirePermission\(/g, "requirePermission(");

  // 4. Fix GET handlers that incorrectly use _WRITE
  // For labels/route.ts GET: API_LABELS_WRITE → API_LABELS_READ
  if (file.endsWith("labels/route.ts")) {
    updated = updated.replace(
      /requirePermission\(auth, PERMISSIONS\.API_LABELS_WRITE\)/g,
      (match, offset) => {
        // Only replace in the GET function (before POST)
        const postIndex = updated.indexOf("// POST", offset - 500);
        if (postIndex === -1 || offset < postIndex) {
          return "requirePermission(auth, PERMISSIONS.API_LABELS_READ)";
        }
        return match;
      }
    );
  }

  // For reply-templates/route.ts GET: API_REPLY_TEMPLATES_WRITE → API_REPLY_TEMPLATES_READ
  if (file.endsWith("reply-templates/route.ts")) {
    updated = updated.replace(
      /requirePermission\(auth, PERMISSIONS\.API_REPLY_TEMPLATES_WRITE\)/g,
      (match, offset) => {
        const postIndex = updated.indexOf("// POST", offset - 500);
        if (postIndex === -1 || offset < postIndex) {
          return "requirePermission(auth, PERMISSIONS.API_REPLY_TEMPLATES_READ)";
        }
        return match;
      }
    );
  }

  if (updated !== content) {
    fs.writeFileSync(file, updated, "utf-8");
    console.log("Fixed", path.relative(process.cwd(), file));
  }
}

console.log("Done fixing permission guard issues.");
