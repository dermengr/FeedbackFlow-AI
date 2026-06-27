import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { validateApiKey } from "@/lib/api-keys";
import type { ApiScope } from "@/lib/api-key-constants";
import type { PermissionName, RoleName } from "@/lib/roles";

export type RequestAuth = {
  userId: string;
  scopes: string[];
  via: "session" | "api-key";
  permissions?: PermissionName[];
  roles?: RoleName[];
};

/** Resolve the caller from a NextAuth session or `Authorization: Bearer ffk_…` API key. */
export async function getRequestAuth(req?: Request): Promise<RequestAuth | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    const user = session.user as {
      id: string;
      permissions?: PermissionName[];
      roles?: RoleName[];
    };
    return {
      userId: user.id,
      scopes: [],
      via: "session",
      permissions: user.permissions ?? [],
      roles: user.roles ?? [],
    };
  }

  if (!req) return null;

  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const rawKey = header.slice(7).trim();
  if (!rawKey) return null;

  const validated = await validateApiKey(rawKey);
  if (!validated) return null;

  return {
    userId: validated.userId,
    scopes: validated.scopes,
    via: "api-key",
  };
}

/** Session users have full access; API keys must include the required scope. */
export function hasScope(auth: RequestAuth, scope: ApiScope): boolean {
  if (auth.via === "session") return true;
  return auth.scopes.includes(scope);
}

/** Check if the authenticated user has a specific permission.
 *  API keys bypass RBAC and use scopes instead.
 */
export function hasPermission(
  auth: RequestAuth,
  permission: PermissionName
): boolean {
  if (auth.via === "api-key") return true;
  return auth.permissions?.includes(permission) ?? false;
}

/** Require a specific permission for an API route. Returns a 403 response if missing. */
export function requirePermission(
  auth: RequestAuth,
  permission: PermissionName
): NextResponse | null {
  const ok = hasPermission(auth, permission);
  if (!ok) return forbiddenResponse(`Missing permission: ${permission}`);
  return null;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbiddenResponse(message = "Insufficient scope") {
  return NextResponse.json({ error: message }, { status: 403 });
}