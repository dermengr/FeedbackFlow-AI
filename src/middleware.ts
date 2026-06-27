import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequestWithAuth } from "next-auth/middleware";
import { getPagePermission, PAGE_PERMISSIONS } from "@/lib/roles";
import type { PermissionName, RoleName } from "@/lib/roles";

// Protect UI routes. API routes enforce auth themselves via `getRequestAuth`.
// Auth pages and static assets are excluded.
export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Check if the route requires a specific permission
    const requiredPermission = getPagePermission(pathname);
    if (requiredPermission) {
      const permissions = (token?.permissions as PermissionName[] | undefined) ?? [];
      const roles = (token?.roles as RoleName[] | undefined) ?? [];

      // Admin always has access
      if (roles.includes("Admin")) {
        return NextResponse.next();
      }

      if (!permissions.includes(requiredPermission)) {
        // Redirect to dashboard if user lacks permission
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: ({ token }) => Boolean(token),
    },
  }
);

export const config = {
  matcher: [
    "/((?!login|signup|api|_next/static|_next/image|favicon.ico).*)",
  ],
};
