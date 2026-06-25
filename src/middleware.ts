export { default } from "next-auth/middleware";

// Protect UI routes only. API routes enforce auth themselves via
// `getServerSession` and return a clean 401 JSON, so we exclude /api here
// (otherwise the middleware would redirect API consumers to the HTML signin
// page). Auth pages and static assets are also excluded.
export const config = {
  matcher: [
    "/((?!login|signup|api|_next/static|_next/image|favicon.ico).*)",
  ],
};
