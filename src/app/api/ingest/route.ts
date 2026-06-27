import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { runIngest } from "@/lib/ingest";
import { fetchAllSources, ensureDefaultSourceConfig } from "@/lib/sources/registry";

// POST /api/ingest - manually trigger an ingest run (protected).
// Query param ?multi=1 runs all enabled SourceConfigs; otherwise runs the
// legacy default GitHub source for backward compatibility.
export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_INGEST_WRITE);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const multi = url.searchParams.get("multi") === "1";

  try {
    if (multi) {
      await ensureDefaultSourceConfig();
      const { items, summary } = await fetchAllSources();
      const result = await runIngest({
        fetcher: async () => items,
        source: "MultiSource",
      });
      const status =
        result.status === "FAILURE" ? 500 : result.status === "PARTIAL" ? 207 : 200;
      return NextResponse.json({ ...result, sourceSummary: summary }, { status });
    }

    const result = await runIngest();
    const status =
      result.status === "FAILURE" ? 500 : result.status === "PARTIAL" ? 207 : 200;
    return NextResponse.json(result, { status });
  } catch (err) {
    return NextResponse.json(
      { error: "Ingest failed", message: (err as Error).message },
      { status: 500 }
    );
  }
}
