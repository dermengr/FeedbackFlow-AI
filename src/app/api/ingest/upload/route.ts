import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import { parseCsvUpload } from "@/lib/sources/csv";
import { runIngest } from "@/lib/ingest";

// POST /api/ingest/upload — accept a CSV file upload and run it through the
// standard ingest pipeline (dedupe + LLM analysis + persist).
// Accepts multipart/form-data with a "file" field, or raw CSV body.
export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const contentType = req.headers.get("content-type") ?? "";
  let csvText = "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No 'file' field in form data" },
        { status: 400 }
      );
    }
    csvText = await file.text();
  } else {
    csvText = await req.text();
  }

  if (!csvText.trim()) {
    return NextResponse.json({ error: "Empty CSV" }, { status: 400 });
  }

  const { items, errors } = parseCsvUpload(csvText);
  if (items.length === 0) {
    return NextResponse.json(
      { error: "No valid rows parsed", parseErrors: errors },
      { status: 400 }
    );
  }

  const result = await runIngest({
    fetcher: async () => items,
    source: "CSVUpload",
  });

  return NextResponse.json({
    ...result,
    parseErrors: errors,
  });
}
