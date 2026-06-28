import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { deleteLabel } from "@/lib/labels";

// DELETE /api/labels/:id — remove a label by id.
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_LABELS_WRITE);
  if (forbidden) return forbidden;

  try {
    await deleteLabel(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to delete label", detail: (err as Error).message },
      { status: 500 }
    );
  }
}
