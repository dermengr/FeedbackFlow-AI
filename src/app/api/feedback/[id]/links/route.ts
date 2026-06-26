import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import { prisma } from "@/lib/prisma";
import {
  RELATION_TYPES,
  createLink,
  removeLink,
  getLinks,
} from "@/lib/feedback-links";

// GET /api/feedback/:id/links - list links (both directions) for an item
export async function GET(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const item = await prisma.feedbackItem.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const links = await getLinks(params.id);
  return NextResponse.json(links);
}

const CreateLinkSchema = z.object({
  toItemId: z.string().min(1),
  relationType: z.enum(RELATION_TYPES as unknown as [string, ...string[]]),
});

// POST /api/feedback/:id/links - create a link from this item to another
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const userId = auth.userId;
  if (!userId) {
    return NextResponse.json(
      { error: "No user id in session" },
      { status: 401 }
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateLinkSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { toItemId, relationType } = parsed.data;

  // Prevent self-linking.
  if (toItemId === params.id) {
    return NextResponse.json(
      { error: "Cannot link an item to itself" },
      { status: 400 }
    );
  }

  // Ensure the source item exists.
  const fromItem = await prisma.feedbackItem.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!fromItem) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Ensure the target item exists.
  const toItem = await prisma.feedbackItem.findUnique({
    where: { id: toItemId },
    select: { id: true },
  });
  if (!toItem) {
    return NextResponse.json(
      { error: "Target item not found" },
      { status: 404 }
    );
  }

  try {
    const link = await createLink(params.id, toItemId, relationType, userId);
    return NextResponse.json(link, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create link";
    // Unique constraint violation (already linked) -> 409
    if (
      err instanceof Error &&
      /unique/i.test(err.message)
    ) {
      return NextResponse.json(
        { error: "Link already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// DELETE /api/feedback/:id/links?linkId=... - remove a link
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const userId = auth.userId;
  if (!userId) {
    return NextResponse.json(
      { error: "No user id in session" },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const linkId = url.searchParams.get("linkId");
  if (!linkId) {
    return NextResponse.json(
      { error: "Missing linkId query parameter" },
      { status: 400 }
    );
  }

  // Ensure the link belongs to this feedback item (either direction).
  const existing = await prisma.feedbackLink.findUnique({
    where: { id: linkId },
    select: { fromItemId: true, toItemId: true },
  });
  if (!existing || (existing.fromItemId !== params.id && existing.toItemId !== params.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const removed = await removeLink(linkId, userId);
  if (!removed) {
    return NextResponse.json(
      { error: "Link could not be removed" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
