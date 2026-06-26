import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import { comparePeriods, compareSources } from "@/lib/comparison";

// GET /api/comparison?type=period&p1Start=...&p1End=...&p2Start=...&p2End=...
// GET /api/comparison?type=source&source1=...&source2=...&days=30
//
// Returns a side-by-side comparison of feedback metrics. Auth required.
// Date params are ISO 8601 strings parsed via new Date().
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "period";

  if (type === "period") {
    const p1Start = searchParams.get("p1Start");
    const p1End = searchParams.get("p1End");
    const p2Start = searchParams.get("p2Start");
    const p2End = searchParams.get("p2End");

    if (!p1Start || !p1End || !p2Start || !p2End) {
      return NextResponse.json(
        {
          error:
            "Missing required params: p1Start, p1End, p2Start, p2End (ISO 8601)",
        },
        { status: 400 }
      );
    }

    const start1 = new Date(p1Start);
    const end1 = new Date(p1End);
    const start2 = new Date(p2Start);
    const end2 = new Date(p2End);

    if (
      !Number.isFinite(start1.getTime()) ||
      !Number.isFinite(end1.getTime()) ||
      !Number.isFinite(start2.getTime()) ||
      !Number.isFinite(end2.getTime())
    ) {
      return NextResponse.json(
        { error: "Invalid date params (expected ISO 8601)" },
        { status: 400 }
      );
    }

    const result = await comparePeriods(start1, end1, start2, end2);
    return NextResponse.json({ type: "period", ...result });
  }

  if (type === "source") {
    const source1 = searchParams.get("source1");
    const source2 = searchParams.get("source2");
    const rawDays = searchParams.get("days");
    let days = 30;
    if (rawDays !== null) {
      const parsed = Number(rawDays);
      if (Number.isFinite(parsed) && parsed > 0) {
        days = Math.floor(parsed);
      }
    }

    if (!source1 || !source2) {
      return NextResponse.json(
        { error: "Missing required params: source1, source2" },
        { status: 400 }
      );
    }

    const result = await compareSources(source1, source2, days);
    return NextResponse.json({ type: "source", ...result });
  }

  return NextResponse.json(
    { error: "Invalid type param (expected 'period' or 'source')" },
    { status: 400 }
  );
}
