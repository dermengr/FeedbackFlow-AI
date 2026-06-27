import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getUserPermissions, getUserRoles, seedRolesAndPermissions, type PermissionName, type RoleName } from "@/lib/roles";

export function isGoogleAuthEnabled(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
}

async function ensureGoogleUser(email: string, name?: string | null) {
  const normalized = email.trim().toLowerCase();
  return prisma.user.upsert({
    where: { email: normalized },
    create: {
      email: normalized,
      name: name ?? null,
      hashedPassword: null,
    },
    update: {
      ...(name ? { name } : {}),
    },
    select: { id: true, email: true, name: true },
  });
}

async function resolveDbUser(email: string) {
  return prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true, name: true },
  });
}

async function resolveDbUserWithRoles(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true, name: true },
  });
  if (!user) return null;
  const [roles, permissions] = await Promise.all([
    getUserRoles(user.id),
    getUserPermissions(user.id),
  ]);
  return { ...user, roles, permissions };
}

function buildProviders(): NextAuthOptions["providers"] {
  const providers: NextAuthOptions["providers"] = [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
        });
        if (!user?.hashedPassword) return null;

        const valid = await bcrypt.compare(password, user.hashedPassword);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
        };
      },
    }),
  ];

  if (isGoogleAuthEnabled()) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        authorization: {
          params: {
            prompt: "consent",
            access_type: "offline",
            response_type: "code",
          },
        },
      })
    );
  }

  return providers;
}

// NextAuth configuration: Credentials + optional Google OAuth,
// JWT-based sessions (works serverless on Amplify / Lambda).
export const authOptions: NextAuthOptions = {
  // Trust X-Forwarded-Host in Codespaces / reverse-proxy dev environments.
  ...(process.env.NODE_ENV === "development" ? { trustHost: true as never } : {}),
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
  pages: {
    signIn: "/login",
  },
  providers: buildProviders(),
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email?.trim().toLowerCase();
        if (!email) return false;
        const dbUser = await ensureGoogleUser(email, user.name);
        // Seed roles and assign default Viewer role for OAuth users
        await seedRolesAndPermissions();
        const hasRoles = await prisma.userRole.count({ where: { userId: dbUser.id } });
        if (hasRoles === 0) {
          const viewerRole = await prisma.role.findUnique({ where: { name: "Viewer" } });
          if (viewerRole) {
            await prisma.userRole.create({
              data: { userId: dbUser.id, roleId: viewerRole.id },
            });
          }
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      // If token already has roles (even empty array), skip DB lookup on refresh
      if (token.roles !== undefined && Array.isArray(token.roles)) {
        return token;
      }

      // Credentials sign-in: user.id is already our DB id.
      if (user?.id && account?.provider === "credentials") {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        const enriched = await resolveDbUserWithRoles(user.email!);
        if (enriched) {
          token.roles = enriched.roles;
          token.permissions = enriched.permissions;
        }
        return token;
      }

      // Google (or token refresh): resolve DB user by email.
      const email = (user?.email ?? token.email) as string | undefined;
      if (email) {
        const enriched = await resolveDbUserWithRoles(email);
        if (enriched) {
          token.id = enriched.id;
          token.email = enriched.email;
          token.name = enriched.name ?? undefined;
          token.roles = enriched.roles;
          token.permissions = enriched.permissions;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = (token.name as string | undefined) ?? session.user.name;
        (session.user as { roles?: RoleName[] }).roles = (token.roles as RoleName[] | undefined) ?? [];
        (session.user as { permissions?: PermissionName[] }).permissions = (token.permissions as PermissionName[] | undefined) ?? [];
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};