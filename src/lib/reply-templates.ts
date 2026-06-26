import { prisma } from "@/lib/prisma";

// Input shape accepted by createTemplate.
export interface CreateTemplateInput {
  name: string;
  subject?: string;
  body: string;
  tags?: string[];
}

// Input shape accepted by updateTemplate. All fields optional.
export interface UpdateTemplateInput {
  name?: string;
  subject?: string | null;
  body?: string;
  tags?: string[];
}

// A ReplyTemplate row as returned by Prisma. `tags` is a JSON value and the
// timestamps are Date objects.
export interface TemplateRow {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  tags: unknown;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

// JSON-safe DTO returned by the reply-templates service / API routes.
export interface TemplateDto {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  tags: string[];
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// Context values that may be substituted into a template body via the
// {{customerName}}, {{itemTitle}}, and {{itemSummary}} placeholders.
export interface TemplateContext {
  customerName?: string;
  itemTitle?: string;
  itemSummary?: string;
}

// Normalize the JSON `tags` value stored on a row into a string array.
function normalizeTags(tags: unknown): string[] {
  if (Array.isArray(tags)) {
    return tags.filter((t): t is string => typeof t === "string");
  }
  return [];
}

// Map a Prisma ReplyTemplate row to the JSON-safe DTO.
export function toTemplateDto(row: TemplateRow): TemplateDto {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    body: row.body,
    tags: normalizeTags(row.tags),
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// listTemplates — return all reply templates owned by `userId`, newest first.
export async function listTemplates(userId: string): Promise<TemplateDto[]> {
  const rows = await prisma.replyTemplate.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toTemplateDto);
}

// createTemplate — create a new reply template owned by `userId`.
export async function createTemplate(
  userId: string,
  data: CreateTemplateInput
): Promise<TemplateDto> {
  const created = await prisma.replyTemplate.create({
    data: {
      userId,
      name: data.name,
      subject: data.subject ?? null,
      body: data.body,
      tags: (data.tags ?? []) as object,
    },
  });
  return toTemplateDto(created);
}

// updateTemplate — update an existing template after verifying ownership.
// Throws if the template does not exist or is owned by a different user.
export async function updateTemplate(
  id: string,
  userId: string,
  data: UpdateTemplateInput
): Promise<TemplateDto> {
  const existing = await prisma.replyTemplate.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    throw new Error("Template not found or not owned by user");
  }

  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.subject !== undefined) update.subject = data.subject;
  if (data.body !== undefined) update.body = data.body;
  if (data.tags !== undefined) update.tags = data.tags as object;

  const updated = await prisma.replyTemplate.update({
    where: { id },
    data: update,
  });
  return toTemplateDto(updated);
}

// deleteTemplate — remove a template after verifying ownership. Throws if the
// template does not exist or is owned by a different user.
export async function deleteTemplate(
  id: string,
  userId: string
): Promise<void> {
  const existing = await prisma.replyTemplate.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    throw new Error("Template not found or not owned by user");
  }
  await prisma.replyTemplate.delete({ where: { id } });
}

// searchTemplates — return the user's templates whose name, body, or any tag
// contains `query` as a substring (case-insensitive).
export async function searchTemplates(
  userId: string,
  query: string
): Promise<TemplateDto[]> {
  const trimmed = query.trim();
  if (trimmed === "") {
    return listTemplates(userId);
  }
  // Prisma's mode: "insensitive" is supported on PostgreSQL for string fields.
  // We search name and body with contains; tags (JSON) is filtered in JS after
  // fetching the candidate rows that match name/body, plus all rows are scanned
  // for tag matches because JSON substring filtering isn't portable.
  const rows = await prisma.replyTemplate.findMany({
    where: {
      userId,
      OR: [
        { name: { contains: trimmed, mode: "insensitive" } },
        { body: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  const lower = trimmed.toLowerCase();
  const byTags = await prisma.replyTemplate.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  const tagMatches = byTags.filter((row) =>
    normalizeTags(row.tags).some((t) => t.toLowerCase().includes(lower))
  );

  // Merge dedupe by id, preserving newest-first ordering.
  const seen = new Set<string>();
  const merged = [...rows, ...tagMatches].filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
  return merged.map(toTemplateDto);
}

// applyTemplate — replace {{customerName}}, {{itemTitle}}, and {{itemSummary}}
// placeholders in a template body with the corresponding context values.
// Missing context values are replaced with an empty string. A body with no
// placeholders is returned unchanged.
export function applyTemplate(
  template: { body: string } | string,
  context: TemplateContext
): string {
  const body = typeof template === "string" ? template : template.body;
  const customerName = context.customerName ?? "";
  const itemTitle = context.itemTitle ?? "";
  const itemSummary = context.itemSummary ?? "";
  return body
    .replace(/\{\{customerName\}\}/g, customerName)
    .replace(/\{\{itemTitle\}\}/g, itemTitle)
    .replace(/\{\{itemSummary\}\}/g, itemSummary);
}
