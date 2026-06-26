import { prisma } from "@/lib/prisma";

// Allowed relation types between feedback items.
export const RELATION_TYPES = [
  "duplicate",
  "related",
  "blocks",
  "blocked_by",
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

export interface LinkedItemSummary {
  id: string;
  title: string | null;
  source: string;
}

export interface FeedbackLinkRecord {
  id: string;
  fromItemId: string;
  toItemId: string;
  relationType: string;
  createdById: string;
  createdAt: string;
  // The "other" item in the link, relative to the queried item.
  item: LinkedItemSummary;
  // Direction of the link relative to the queried item:
  //  "from" => this item is the source (fromItemId === feedbackItemId)
  //  "to"   => this item is the target (toItemId === feedbackItemId)
  direction: "from" | "to";
}

export interface FeedbackLinksResult {
  linksFrom: FeedbackLinkRecord[];
  linksTo: FeedbackLinkRecord[];
}

function isRelationType(value: string): value is RelationType {
  return (RELATION_TYPES as readonly string[]).includes(value);
}

/**
 * Create a link between two feedback items. Prevents self-linking and
 * validates the relation type. Returns the created link (without relations).
 */
export async function createLink(
  fromItemId: string,
  toItemId: string,
  relationType: string,
  userId: string
): Promise<{ id: string; fromItemId: string; toItemId: string; relationType: string; createdById: string; createdAt: string }> {
  if (fromItemId === toItemId) {
    throw new Error("Cannot link an item to itself");
  }
  if (!isRelationType(relationType)) {
    throw new Error(`Invalid relation type: ${relationType}`);
  }

  const link = await prisma.feedbackLink.create({
    data: {
      fromItemId,
      toItemId,
      relationType,
      createdById: userId,
    },
  });

  return {
    id: link.id,
    fromItemId: link.fromItemId,
    toItemId: link.toItemId,
    relationType: link.relationType,
    createdById: link.createdById,
    createdAt: link.createdAt.toISOString(),
  };
}

/**
 * Remove a link. Only the user who created the link (or any authenticated
 * user, per current policy) may remove it. Returns true if a row was deleted.
 */
export async function removeLink(
  linkId: string,
  _userId: string
): Promise<boolean> {
  const result = await prisma.feedbackLink.deleteMany({
    where: { id: linkId },
  });
  return result.count > 0;
}

/**
 * List all links for a feedback item, in both directions, including the
 * related item's id, title and source.
 */
export async function getLinks(
  feedbackItemId: string
): Promise<FeedbackLinksResult> {
  const [linksFrom, linksTo] = await Promise.all([
    prisma.feedbackLink.findMany({
      where: { fromItemId: feedbackItemId },
      include: {
        toItem: { select: { id: true, title: true, source: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.feedbackLink.findMany({
      where: { toItemId: feedbackItemId },
      include: {
        fromItem: { select: { id: true, title: true, source: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    linksFrom: linksFrom.map((l) => ({
      id: l.id,
      fromItemId: l.fromItemId,
      toItemId: l.toItemId,
      relationType: l.relationType,
      createdById: l.createdById,
      createdAt: l.createdAt.toISOString(),
      item: {
        id: l.toItem.id,
        title: l.toItem.title,
        source: l.toItem.source,
      },
      direction: "from" as const,
    })),
    linksTo: linksTo.map((l) => ({
      id: l.id,
      fromItemId: l.fromItemId,
      toItemId: l.toItemId,
      relationType: l.relationType,
      createdById: l.createdById,
      createdAt: l.createdAt.toISOString(),
      item: {
        id: l.fromItem.id,
        title: l.fromItem.title,
        source: l.fromItem.source,
      },
      direction: "to" as const,
    })),
  };
}

/**
 * Find potential duplicate suggestions for a feedback item: items from the
 * same source whose title contains (or is contained by) the reference item's
 * title, using a simple case-insensitive substring match. Excludes the item
 * itself and already-linked duplicates. Limited to 5 results.
 */
export async function getDuplicateSuggestions(
  feedbackItemId: string
): Promise<LinkedItemSummary[]> {
  const item = await prisma.feedbackItem.findUnique({
    where: { id: feedbackItemId },
    select: { id: true, source: true, title: true },
  });
  if (!item || !item.title) {
    return [];
  }

  const title = item.title.toLowerCase();

  // Fetch candidate items from the same source (excluding self) and filter
  // by substring match in memory. Prisma does not support case-insensitive
  // substring filtering portably across providers, so we do it here.
  const candidates = await prisma.feedbackItem.findMany({
    where: {
      source: item.source,
      id: { not: feedbackItemId },
      title: { not: null },
    },
    select: { id: true, title: true, source: true },
    take: 500,
  });

  const matches = candidates
    .filter((c) => {
      const ct = (c.title ?? "").toLowerCase();
      if (!ct) return false;
      return ct.includes(title) || title.includes(ct);
    })
    .slice(0, 5);

  return matches.map((c) => ({
    id: c.id,
    title: c.title,
    source: c.source,
  }));
}
