import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import {
  predictSeverity,
  batchPredictSeverity,
  type SeverityPrediction,
} from "@/lib/predictive";

// POST /api/predict-severity
// Body: { text: string }  -> single prediction
//    or { texts: string[] } -> batch prediction (failures isolated per item)
//
// Auth required. Input is validated with zod.
const SingleBody = z.object({
  text: z.string().min(1, "text is required").max(8000),
});

const BatchBody = z.object({
  texts: z.array(z.string().min(1).max(8000)).min(1).max(100),
});

export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_PREDICT_WRITE);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Try the single-text schema first, then the batch schema.
  const single = SingleBody.safeParse(body);
  if (single.success) {
    try {
      const prediction = await predictSeverity(single.data.text);
      return NextResponse.json({ prediction });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to predict severity";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const batch = BatchBody.safeParse(body);
  if (batch.success) {
    const results = await batchPredictSeverity(batch.data.texts);
    const predictions = results
      .filter(
        (r): r is { ok: true; prediction: SeverityPrediction } => r.ok
      )
      .map((r) => r.prediction);
    const failures = results
      .filter((r) => !r.ok)
      .map((r) => (r as { ok: false; error: string }).error);
    return NextResponse.json({ predictions, failures });
  }

  // Combine both schema errors for a helpful message.
  const issue =
    single.error.issues[0]?.message ??
    batch.error.issues[0]?.message ??
    "Invalid body: expected { text: string } or { texts: string[] }";
  return NextResponse.json({ error: issue }, { status: 400 });
}
