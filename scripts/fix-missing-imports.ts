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
  const content = fs.readFileSync(file, "utf-8");

  // Skip files that don't use requirePermission
  if (!content.includes("requirePermission(")) continue;

  let updated = content;

  // Add requirePermission to request-auth import if missing
  if (!content.match(/import\s*\{[^}]*\brequirePermission\b[^}]*\}\s*from\s*"@\/lib\/request-auth"/)) {
    const reqAuthMatch = content.match(
      /import\s*\{([^}]*)\}\s*from\s*"@\/lib\/request-auth";?/
    );
    if (reqAuthMatch) {
      const existing = reqAuthMatch[1];
      const newImport = existing.trim().endsWith(",")
        ? ` ${existing} requirePermission,`
        : ` ${existing}, requirePermission,`;
      updated = updated.replace(reqAuthMatch[0], `import {${newImport} } from "@/lib/request-auth";`);
    }
  }

  // Add PERMISSIONS import if the file uses PERMISSIONS. but doesn't import it
  const usesPermissions = updated.match(/\bPERMISSIONS\.[A-Z_]+/);
  const hasPermissionsImport = updated.match(/import\s*\{[^}]*\bPERMISSIONS\b[^}]*\}\s*from\s*"@\/lib\/roles"/);
  if (usesPermissions && !hasPermissionsImport) {
    const rolesMatch = updated.match(
      /import\s*\{([^}]*)\}\s*from\s*"@\/lib\/roles";?/
    );
    if (rolesMatch) {
      const existing = rolesMatch[1];
      const newImport = existing.trim().endsWith(",")
        ? ` ${existing} PERMISSIONS,`
        : ` ${existing}, PERMISSIONS,`;
      updated = updated.replace(rolesMatch[0], `import {${newImport} } from "@/lib/roles";`);
    } else {
      // No existing roles import; add one after the first import line
      const firstImport = updated.match(/import\s+.*from\s+"[^"]+";?\n/);
      if (firstImport) {
        updated = updated.replace(
          firstImport[0],
          `${firstImport[0]}import { PERMISSIONS } from "@/lib/roles";\n`
        );
      }
    }
  }

  if (updated !== content) {
    fs.writeFileSync(file, updated, "utf-8");
    console.log("Fixed imports in", path.relative(process.cwd(), file));
  }
}

console.log("Done fixing imports.");
