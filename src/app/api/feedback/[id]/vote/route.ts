import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import { prisma } from "@/lib/prisma";
import {
  castVote,
  removeVote,
  getVoteSummary,
  VOTE_TYPES,
  type VoteType,
} from "@/lib/voting";

const VoteTypeSchema = z.enum(VOTE_TYPES as [VoteType, ...VoteType[]]);

const CastVoteSchema = z.object({
  type: VoteTypeSchema,
});

// GET /api/feedback/:id/vote - vote summary for this item (current user's votes included)
export async function GET(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const userId = auth.userId;
  if (!userId) {
    return NextResponse.json({ error: "No user id in session" }, { status: 401 });
  }

  const item = await prisma.feedbackItem.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const summary = await getVoteSummary(params.id, userId);
  return NextResponse.json(summary);
}

// POST /api/feedback/:id/vote - cast a vote { type: "up" | "down" | "heart" }
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const userId = auth.userId;
  if (!userId) {
    return NextResponse.json({ error: "No user id in session" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CastVoteSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const item = await prisma.feedbackItem.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await castVote(params.id, userId, parsed.data.type);
  const summary = await getVoteSummary(params.id, userId);
  return NextResponse.json(summary, { status: 201 });
}

// DELETE /api/feedback/:id/vote?type=up - remove a vote of the given type
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const userId = auth.userId;
  if (!userId) {
    return NextResponse.json({ error: "No user id in session" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const typeParam = searchParams.get("type");
  const parsed = VoteTypeSchema.safeParse(typeParam);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid vote type", details: { type: typeParam } },
      { status: 400 }
    );
  }

  const item = await prisma.feedbackItem.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await removeVote(params.id, userId, parsed.data);
  const summary = await getVoteSummary(params.id, userId);
  return NextResponse.json(summary);
}
