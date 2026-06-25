# Authentication System — Deep Dive

This document explains the authentication subsystem of **FeedbackFlow AI**, centered on two Service-Layer files — `src/lib/auth.ts` (NextAuth configuration) and `src/middleware.ts` (route-protection middleware) — and the supporting nodes that connect to them.

---

## 1. Role in the Architecture

The auth system spans three architectural layers identified in the project's knowledge graph:

| Layer | Nodes | Responsibility |
|---|---|---|
| **Service Layer** | `src/lib/auth.ts`, `src/middleware.ts`, `src/lib/prisma.ts` | NextAuth configuration, request-protection middleware, and the Prisma client singleton used for user lookups. |
| **API Layer** | `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/auth/signup/route.ts` | HTTP entry points that expose login/session endpoints and the registration endpoint. |
| **Shared Utility & Types Layer** | `src/types/next-auth.d.ts` | TypeScript module augmentation that adds a custom `id` field to NextAuth's `Session.user` and `JWT` types. |

`src/lib/auth.ts` is the single source of truth for *how* authentication works: which provider is used, how passwords are verified, how sessions are encoded, and which secret signs the JWT. `src/middleware.ts` is the single source of truth for *where* authentication is enforced at the edge. Everything else — the API routes, the dashboard/feedback/ingest handlers, the app layout — imports `authOptions` from `src/lib/auth.ts` and calls `getServerSession(authOptions)` to read the authenticated user.

The knowledge graph records the fan-out explicitly. `src/lib/auth.ts` is imported by:

- `src/app/api/auth/[...nextauth]/route.ts` (the NextAuth handler)
- `src/app/api/dashboard/route.ts`
- `src/app/api/feedback/route.ts` and `src/app/api/feedback/[id]/route.ts`
- `src/app/api/ingest/route.ts`
- `src/app/api/webhook/slack/route.ts`
- `src/app/(app)/layout.tsx` and `src/app/(app)/dashboard/page.tsx`

…and `src/lib/auth.ts` itself imports `src/lib/prisma.ts`. `src/middleware.ts` is referenced by `config:tsconfig.json` (it must be outside `src`-style module resolution constraints) and documented by `README.md`; `.env.example` configures it via `NEXTAUTH_SECRET`/`NEXTAUTH_URL`.

---

## 2. Internal Structure

### 2.1 `src/lib/auth.ts` — `authOptions`

The file exports a single `authOptions: NextAuthOptions` object. Its sections, in order:

**Session strategy — JWT (lines 9–12)**
```ts
session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 } // 7 days
```
JWT sessions are chosen deliberately: the comment on line 7 notes they "work serverless on Amplify / Lambda," where a shared session store (database sessions) would require a persistent DB connection per cold start. The token lives for 7 days.

**Custom sign-in page (lines 13–15)**
```ts
pages: { signIn: "/login" }
```
Redirects unauthenticated users to the app's own `/login` route instead of NextAuth's default hosted page.

**Credentials provider (lines 16–43)**
```ts
CredentialsProvider({
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials) { … }
})
```
The `authorize` callback is the heart of login:
1. **Normalize input** — `email.trim().toLowerCase()` (line 24) ensures case-insensitive matching against the unique `email` column.
2. **Guard** — return `null` if either field is missing (line 26). NextAuth treats a `null` return as "invalid credentials" and surfaces the generic error.
3. **User lookup** — `prisma.user.findUnique({ where: { email } })` (lines 28–30). No user → `null`.
4. **Password verification** — `bcrypt.compare(password, user.hashedPassword)` (line 33). Mismatch → `null`.
5. **Return a minimal user object** — `{ id, email, name }` (lines 36–40). This object is passed to the `jwt` callback on first sign-in.

Note the deliberate non-disclosure: the same `null` is returned for "no such user" and "wrong password," preventing user-enumeration via timing or distinct error messages.

**Callbacks (lines 44–58)**

- `jwt({ token, user })` — runs on every token creation/refresh. The `user` argument is present only on the *first* sign-in, so the `if (user)` guard (line 46) persists `user.id` and `user.email` onto the token exactly once; subsequent refreshes just forward the existing token.
- `session({ session, token })` — runs whenever `getServerSession` is called. It copies `token.id` and `token.email` onto `session.user`, so server-side code can read `session.user.id` without an extra DB hit.

**Secret (line 60)**
```ts
secret: process.env.NEXTAUTH_SECRET
```
Signs and encrypts the JWT. `.env.example` documents it as `replace-with-a-long-random-string`. Without it, NextAuth throws in production.

### 2.2 `src/middleware.ts` — Edge route protection

```ts
export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/((?!login|signup|api|_next/static|_next/image|favicon.ico).*)"],
};
```

This is the canonical NextAuth middleware pattern: re-export the default from `next-auth/middleware`, which checks for a valid JWT cookie on every matched request and redirects to `pages.signIn` (`/login`) when absent.

The `matcher` regex is a negative lookahead that **excludes**:

| Excluded path | Reason |
|---|---|
| `/login`, `/signup` | Auth pages must be reachable while logged out. |
| `/api/*` | API routes enforce auth themselves via `getServerSession` and return a clean `401` JSON; redirecting API consumers to an HTML page would break clients. |
| `/_next/static`, `/_next/image`, `/favicon.ico` | Static assets — no auth needed, and middleware would add latency. |

The inline comment (lines 3–6) documents this split explicitly. The result is a two-tier enforcement model: **middleware protects UI, `getServerSession` protects API**.

### 2.3 `src/types/next-auth.d.ts` — Type augmentation

```ts
declare module "next-auth" {
  interface Session { user: { id?: string } & DefaultSession["user"]; }
}
declare module "next-auth/jwt" {
  interface JWT { id?: string; }
}
```

NextAuth's built-in `Session.user` has no `id`. This augmentation adds an optional `id` to both `Session.user` and `JWT`, which is what lets `auth.ts` line 54 (`(session.user as { id?: string }).id = token.id as string`) compile and lets downstream code read `session.user.id` type-safely.

---

## 3. External Connections

### 3.1 `src/lib/prisma.ts` — the user store

`auth.ts` imports `prisma` from `@/lib/prisma`. That file is a singleton:

```ts
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ … });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

The `globalThis` cache prevents a new `PrismaClient` (and thus a new connection pool) from being instantiated on every Next.js hot-reload in dev and on every Lambda cold start in production. Both `auth.ts` (login path) and `signup/route.ts` (registration path) share this one client.

### 3.2 `src/app/api/auth/[...nextauth]/route.ts` — the handler

```ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

A six-line catch-all route that wires `authOptions` into the App Router. NextAuth exposes all its endpoints (`/api/auth/signin`, `/api/auth/callback`, `/api/auth/session`, `/api/auth/signout`, …) under this single handler. The knowledge graph tags it `entry-point`, `api-handler`, `authentication`, `middleware` with `complexity: simple`.

### 3.3 `src/app/api/auth/signup/route.ts` — registration

This is the *write* side of auth. It does **not** use NextAuth directly; it creates the user row that NextAuth's `authorize` later reads. Its flow (complexity: moderate):

1. **Parse JSON body** (lines 13–18) — `400` on invalid JSON.
2. **Zod validation** (lines 6–10, 20–26):
   ```ts
   const SignupSchema = z.object({
     email: z.string().email(),
     password: z.string().min(8).max(128),
     name: z.string().min(1).max(80).optional(),
   });
   ```
   Enforces a valid email, an 8–128 char password, and an optional 1–80 char name. Failures return `400` with `parsed.error.flatten()` details.
3. **Normalize email** (line 29) — `email.trim().toLowerCase()`, matching the normalization in `authorize`.
4. **Uniqueness check** (lines 31–34) — `prisma.user.findUnique`; `409` if the email already exists.
5. **Hash password** (line 36) — `bcrypt.hash(password, 12)`. Cost factor 12 is the OWASP-recommended baseline (≈250ms per hash). The hashed value is stored in `hashedPassword`.
6. **Create user** (lines 37–40) — `prisma.user.create` with `select` returning only `{ id, email, name }`, never the hash.
7. **Respond** (line 42) — `201` with the public user shape.

After signup, the client calls `signIn("credentials", …)` (NextAuth client) which hits `/api/auth/[...nextauth]` and runs `authorize`.

### 3.4 Downstream consumers

Every protected API route (`dashboard`, `feedback`, `feedback/[id]`, `ingest`, `webhook/slack`) imports `authOptions` and calls `getServerSession(authOptions)`. When the session is absent they return `401` JSON — this is the API-tier counterpart to the middleware's UI-tier redirect. The authenticated app layout (`src/app/(app)/layout.tsx`) and dashboard page do the same on the server-component side to gate rendering.

---

## 4. Data Flow

### 4.1 Registration flow

```
Client POST /api/auth/signup {email,password,name?}
   │
   ▼
signup/route.ts
   ├─ req.json()                       → 400 if not JSON
   ├─ SignupSchema.safeParse(body)     → 400 with Zod details if invalid
   ├─ email.trim().toLowerCase()
   ├─ prisma.user.findUnique           → 409 if exists
   ├─ bcrypt.hash(password, 12)        → hashedPassword
   ├─ prisma.user.create               → {id,email,name}
   └─ 201 JSON
   │
   ▼  (client then calls signIn("credentials"))
NextAuth /api/auth/[...nextauth]
   └─ authorize() → prisma lookup → bcrypt.compare → JWT issued
```

### 4.2 Login flow

```
Client signIn("credentials", {email,password})
   │
   ▼  POST /api/auth/callback/credentials
NextAuth handler (route.ts) → authOptions.providers[0].authorize
   ├─ email = credentials.email.trim().toLowerCase()
   ├─ guard: missing field → null
   ├─ prisma.user.findUnique({where:{email}}) → null if no user
   ├─ bcrypt.compare(password, user.hashedPassword) → null if mismatch
   └─ return {id,email,name}
   │
   ▼  (user returned)
jwt callback (first time, user present)
   └─ token.id = user.id; token.email = user.email
   │
   ▼
Set-Cookie: next-auth.session-token = signed JWT (7-day maxAge)
   │
   ▼  (later, any getServerSession call)
session callback
   └─ session.user.id = token.id; session.user.email = token.email
```

### 4.3 Protected-request flow (UI)

```
Any GET /dashboard, /inbox, …  (matched by middleware)
   │
   ▼
next-auth/middleware
   ├─ valid JWT cookie?  → proceed
   └─ no/invalid         → 307 redirect to /login
```

### 4.4 Protected-request flow (API)

```
Any /api/dashboard, /api/feedback, …  (excluded from middleware)
   │
   ▼
route handler
   ├─ const session = await getServerSession(authOptions)
   ├─ session?  → proceed with session.user.id
   └─ no session → 401 JSON {error: "Unauthorized"}
```

The two flows are intentionally complementary: humans get redirected to a login page; machines get a structured `401`.

---

## 5. Key Patterns

1. **NextAuth Credentials provider** — email/password auth without an external IdP. The `authorize` callback is the only place password verification happens.
2. **JWT session strategy** — chosen for serverless compatibility (Amplify/Lambda). No session table, no DB hit per request; the signed cookie *is* the session.
3. **bcrypt password hashing** — cost factor 12 at signup (`bcrypt.hash`), constant-time comparison at login (`bcrypt.compare`). The plaintext password is never logged, never returned, and never stored.
4. **Email normalization** — `trim().toLowerCase()` is applied identically in `authorize` (auth.ts:24) and `signup` (route.ts:29), guaranteeing the lookup key matches the stored key.
5. **Zod validation at the boundary** — the signup route validates input before touching the DB, returning structured error details on failure.
6. **Middleware-based route protection with a split matcher** — UI routes are protected by `next-auth/middleware`; API routes are protected in-handler so they can return JSON `401`s instead of HTML redirects.
7. **Type augmentation for session user** — `next-auth.d.ts` extends `Session.user` and `JWT` with `id`, enabling type-safe access to the user id downstream.
8. **Singleton Prisma client** — `globalThis` caching avoids connection exhaustion under hot-reload/cold-start.
9. **Environment-driven secrets** — `NEXTAUTH_SECRET` signs the JWT; `NEXTAUTH_URL` anchors callback URLs. Both are documented in `.env.example`.
10. **Non-disclosing error handling** — `authorize` returns `null` for both "no such user" and "wrong password," defeating enumeration attacks.

---

## 6. Satisfaction of the Project Brief's Auth Requirement

The brief requires **secure signup/login** and **protected routes that redirect logged-out users**, with **secrets sourced from environment variables**. This implementation satisfies each clause:

| Requirement | How it is met | Evidence |
|---|---|---|
| Secure signup | Zod-validated input, duplicate-email check, bcrypt hashing (cost 12), no plaintext persisted, minimal `select` on create. | `signup/route.ts` lines 6–42 |
| Secure login | Credentials provider with `authorize`, bcrypt.compare, non-disclosing `null` returns, normalized email. | `auth.ts` lines 17–41 |
| Session management | JWT strategy, 7-day expiry, signed with `NEXTAUTH_SECRET`. | `auth.ts` lines 9–12, 60 |
| Protected UI routes | `next-auth/middleware` re-exported with a matcher excluding auth/api/static paths; unauthenticated requests redirect to `/login`. | `middleware.ts` lines 1–11 |
| Protected API routes | Each handler calls `getServerSession(authOptions)` and returns `401` JSON when absent. | imports of `auth.ts` across `api/*` routes |
| Type-safe user identity | `next-auth.d.ts` augments `Session.user` and `JWT` with `id`; `session` callback populates it. | `next-auth.d.ts`, `auth.ts` lines 52–57 |
| Secrets from env | `NEXTAUTH_SECRET` and `NEXTAUTH_URL` read from `process.env`; documented in `.env.example`. | `auth.ts` line 60; `.env.example` |
| Serverless-friendly | JWT (not database) sessions + Prisma singleton survive Lambda cold starts. | `auth.ts` line 7 comment; `prisma.ts` |

In short, the auth system is a compact, convention-driven NextAuth setup: one config object, one middleware re-export, one type-augmentation file, and two API routes — yet it provides the full signup → login → session → route-protection loop required by the brief, with hashing, validation, and secret management handled to production baseline.
