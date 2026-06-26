/** Normalize post-login redirects to same-origin relative paths only. */
export function sanitizeCallbackUrl(
  raw: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!raw?.trim()) return fallback;

  const value = raw.trim();

  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      const url = new URL(value);
      const path = `${url.pathname}${url.search}`;
      if (path.startsWith("/") && !path.startsWith("//")) {
        return path === "/" ? fallback : path;
      }
      return fallback;
    }

    if (value.startsWith("/") && !value.startsWith("//")) {
      return value === "/" ? fallback : value;
    }
  } catch {
    // Invalid URL — use fallback.
  }

  return fallback;
}