import { prisma } from "@/lib/prisma";

export interface CommentWithAuthor {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string | null; email: string };
}

/**
 * List all comments (notes) for a feedback item, oldest first, with author info.
 */
export async function listComments(
  feedbackItemId: string
): Promise<CommentWithAuthor[]> {
  const comments = await prisma.feedbackComment.findMany({
    where: { feedbackItemId },
    include: { author: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return comments.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    author: {
      id: c.author.id,
      name: c.author.name,
      email: c.author.email,
    },
  }));
}

/**
 * Create a new comment (note) on a feedback item authored by the given user.
 */
export async function createComment(
  feedbackItemId: string,
  authorId: string,
  body: string
): Promise<CommentWithAuthor> {
  const comment = await prisma.feedbackComment.create({
    data: { feedbackItemId, authorId, body },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    author: {
      id: comment.author.id,
      name: comment.author.name,
      email: comment.author.email,
    },
  };
}
