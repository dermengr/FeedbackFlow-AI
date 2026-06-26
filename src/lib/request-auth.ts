import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { validateApiKey } from "@/lib/api-keys";
import type { ApiScope } from "@/lib/api-key-constants";

export type RequestAuth = {
  userId: string;
  scopes: string[];
  via: "session" | "api-key";
};

/** Resolve the caller from a NextAuth session or `Authorization: Bearer ffk_…` API key. */
export async function getRequestAuth(req?: Request): Promise<RequestAuth | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    return { userId: session.user.id, scopes: [], via: "session" };
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

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbiddenResponse(message = "Insufficient scope") {
  return NextResponse.json({ error: message }, { status: 403 });
}