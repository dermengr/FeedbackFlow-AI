import { prisma } from "@/lib/prisma";

// A single column definition stored in an export template. `field` is the
// feedback property to export and `label` is the human-readable header.
export interface ExportColumn {
  field: string;
  label: string;
}

// The set of columns used when a caller does not specify any. These mirror the
// most commonly exported feedback attributes.
export const DEFAULT_COLUMNS: ExportColumn[] = [
  { field: "title", label: "Title" },
  { field: "source", label: "Source" },
  { field: "sentiment", label: "Sentiment" },
  { field: "severityScore", label: "Severity" },
  { field: "summary", label: "Summary" },
  { field: "status", label: "Status" },
  { field: "topics", label: "Topics" },
  { field: "createdAt", label: "Created" },
];

// The full catalogue of fields a user can choose from when building a custom
// export template. It is a superset of DEFAULT_COLUMNS so the defaults are
// always selectable.
export const AVAILABLE_FIELDS: ExportColumn[] = [
  { field: "externalId", label: "External ID" },
  { field: "title", label: "Title" },
  { field: "source", label: "Source" },
  { field: "author", label: "Author" },
  { field: "sentiment", label: "Sentiment" },
  { field: "severityScore", label: "Severity" },
  { field: "summary", label: "Summary" },
  { field: "status", label: "Status" },
  { field: "topics", label: "Topics" },
  { field: "language", label: "Language" },
  { field: "emotion", label: "Emotion" },
  { field: "url", label: "URL" },
  { field: "createdAt", label: "Created" },
  { field: "rawContent", label: "Raw Content" },
];

export type ExportFormat = "csv" | "json" | "tsv";

export const EXPORT_FORMATS: readonly ExportFormat[] = [
  "csv",
  "json",
  "tsv",
] as const;

// DTO returned by the export-templates service. Dates are serialized to ISO
// strings so they can be safely returned from API routes as JSON.
export interface ExportTemplateDto {
  id: string;
  name: string;
  columns: ExportColumn[];
  format: ExportFormat;
  filterQuery: string | null;
  userId: string | null;
  createdAt: string;
}

// Map a Prisma ExportTemplate row (with a Date `createdAt` and Json `columns`)
// to the JSON-safe DTO. Columns are coerced to ExportColumn[] defensively.
function toDto(row: {
  id: string;
  name: string;
  columns: unknown;
  format: string;
  filterQuery: string | null;
  userId: string | null;
  createdAt: Date;
}): ExportTemplateDto {
  return {
    id: row.id,
    name: row.name,
    columns: normalizeColumns(row.columns),
    format: normalizeFormat(row.format),
    filterQuery: row.filterQuery,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
  };
}

// Coerce a stored Json column value into a typed ExportColumn[]. Unknown
// shapes fall back to an empty array so callers never receive bad data.
function normalizeColumns(columns: unknown): ExportColumn[] {
  if (!Array.isArray(columns)) return [];
  return columns
    .filter(
      (c): c is ExportColumn =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as ExportColumn).field === "string" &&
        typeof (c as ExportColumn).label === "string"
    )
    .map((c) => ({ field: c.field, label: c.label }));
}

function normalizeFormat(format: string): ExportFormat {
  return (EXPORT_FORMATS as readonly string[]).includes(format)
    ? (format as ExportFormat)
    : "csv";
}

// listTemplates — return export templates, optionally filtered by owner.
// When `userId` is omitted, all templates are returned (newest first).
export async function listTemplates(
  userId?: string
): Promise<ExportTemplateDto[]> {
  const rows = await prisma.exportTemplate.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDto);
}

// createTemplate — create a new export template owned by `userId`. `format`
// defaults to "csv" and `filterQuery` defaults to null when not provided.
export async function createTemplate(
  userId: string,
  data: {
    name: string;
    columns: ExportColumn[];
    format?: ExportFormat;
    filterQuery?: string | null;
  }
): Promise<ExportTemplateDto> {
  const created = await prisma.exportTemplate.create({
    data: {
      userId,
      name: data.name,
      columns: data.columns as unknown as object,
      format: data.format ?? "csv",
      filterQuery: data.filterQuery ?? null,
    },
  });
  return toDto(created);
}

// updateTemplate — update an existing template after verifying ownership.
// Throws if the template does not exist or is owned by a different user;
// callers should map this to a 404.
export async function updateTemplate(
  id: string,
  userId: string,
  data: {
    name?: string;
    columns?: ExportColumn[];
    format?: ExportFormat;
    filterQuery?: string | null;
  }
): Promise<ExportTemplateDto> {
  const existing = await prisma.exportTemplate.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    throw new Error("Template not found or not owned by user");
  }
  const updated = await prisma.exportTemplate.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.columns !== undefined && {
        columns: data.columns as unknown as object,
      }),
      ...(data.format !== undefined && { format: data.format }),
      ...(data.filterQuery !== undefined && {
        filterQuery: data.filterQuery,
      }),
    },
  });
  return toDto(updated);
}

// deleteTemplate — remove a template after verifying ownership. Throws if the
// template does not exist or is owned by a different user.
export async function deleteTemplate(id: string, userId: string): Promise<void> {
  const existing = await prisma.exportTemplate.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    throw new Error("Template not found or not owned by user");
  }
  await prisma.exportTemplate.delete({ where: { id } });
}
