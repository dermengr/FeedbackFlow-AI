import { NextResponse } from "next/server";
import { isGoogleAuthEnabled } from "@/lib/auth";

// GET /api/auth/config — public auth feature flags (no secrets).
export async function GET() {
  return NextResponse.json({
    google: isGoogleAuthEnabled(),
    credentials: true,
  });
}