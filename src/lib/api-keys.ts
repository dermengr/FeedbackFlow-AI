import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ALLOWED_SCOPES, type ApiScope } from "@/lib/api-key-constants";

// Re-export for backward compatibility (server-side consumers).
export { ALLOWED_SCOPES, type ApiScope };

// Result of generateApiKey — the raw key is returned to the caller exactly
// once so it can be shown to the user; only the hash is persisted.
export interface GeneratedKey {
  rawKey: string;
  hashedKey: string;
  prefix: string;
}

// DTO returned by listApiKeys / createApiKey. The hashedKey is intentionally
// excluded so it can never leak through the API.
export interface ApiKeyDto {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

// What createApiKey returns: the persisted DTO plus the raw key (only once).
export interface CreatedApiKey extends ApiKeyDto {
  rawKey: string;
}

// Generate a new random API key. The raw key has the form "ffk_" + 32 hex
// characters (40 chars total). It is hashed with sha256 for storage, and a
// 12-character prefix is derived for display in the UI.
export function generateApiKey(): GeneratedKey {
  const hex = crypto.randomBytes(16).toString("hex"); // 32 hex chars
  const rawKey = `ffk_${hex}`;
  const hashedKey = hashApiKey(rawKey);
  const prefix = rawKey.slice(0, 12);
  return { rawKey, hashedKey, prefix };
}

// Hash a raw API key with sha256 (hex digest). Used both when creating a key
// and when validating one, so lookups are by hash rather than raw key.
export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

// Map a Prisma ApiKey row to the JSON-safe DTO, stripping the hashedKey and
// converting Dates to ISO strings.
function toDto(row: {
  id: string;
  name: string;
  prefix: string;
  scopes: unknown;
  lastUsedAt: Date | null;
  createdAt: Date;
}): ApiKeyDto {
  const scopes = Array.isArray(row.scopes) ? (row.scopes as string[]) : [];
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scopes,
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

// Create a new API key for `userId`. The raw key is returned exactly once;
// only the hash is persisted. `scopes` is filtered to ALLOWED_SCOPES.
export async function createApiKey(
  userId: string,
  data: { name: string; scopes: string[] }
): Promise<CreatedApiKey> {
  const { rawKey, hashedKey, prefix } = generateApiKey();
  const scopes = data.scopes.filter((s): s is ApiScope =>
    (ALLOWED_SCOPES as readonly string[]).includes(s)
  );
  const created = await prisma.apiKey.create({
    data: {
      name: data.name,
      hashedKey,
      prefix,
      userId,
      scopes,
    },
  });
  return { ...toDto(created), rawKey };
}

// List all API keys owned by `userId`, newest first. The hashedKey is never
// selected or returned.
export async function listApiKeys(userId: string): Promise<ApiKeyDto[]> {
  const rows = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });
  return rows.map(toDto);
}

// Delete an API key after verifying ownership. Returns true if a key was
// deleted, false if the key does not exist or is owned by another user.
export async function deleteApiKey(
  id: string,
  userId: string
): Promise<boolean> {
  const existing = await prisma.apiKey.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return false;
  }
  await prisma.apiKey.delete({ where: { id } });
  return true;
}

// Update the lastUsedAt timestamp for a key. Best-effort: errors are swallowed
// so a failing timestamp update never blocks an authenticated request.
export async function updateLastUsed(id: string): Promise<void> {
  try {
    await prisma.apiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  } catch {
    // Best-effort — do not let a failed timestamp update break validation.
  }
}

// Validate a raw API key: hash it, look up the matching row, update
// lastUsedAt, and return the owner's userId + scopes. Returns null when no
// key matches.
export async function validateApiKey(
  rawKey: string
): Promise<{ userId: string; scopes: string[] } | null> {
  if (!rawKey.startsWith("ffk_")) {
    return null;
  }
  const hashedKey = hashApiKey(rawKey);
  const row = await prisma.apiKey.findUnique({ where: { hashedKey } });
  if (!row) {
    return null;
  }
  await updateLastUsed(row.id);
  const scopes = Array.isArray(row.scopes) ? (row.scopes as string[]) : [];
  return { userId: row.userId, scopes };
}
