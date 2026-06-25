import { prisma } from "@/lib/prisma";

// DTO returned by the saved-views service. Dates are serialized to ISO strings
// so they can be safely returned from API routes as JSON.
export interface SavedViewDto {
  id: string;
  name: string;
  query: string;
  createdAt: string;
}

// Map a Prisma SavedView row (with a Date `createdAt`) to the JSON-safe DTO.
function toDto(row: {
  id: string;
  name: string;
  query: string;
  createdAt: Date;
}): SavedViewDto {
  return {
    id: row.id,
    name: row.name,
    query: row.query,
    createdAt: row.createdAt.toISOString(),
  };
}

// List all saved views owned by `ownerId`, newest first.
export async function listViews(ownerId: string): Promise<SavedViewDto[]> {
  const rows = await prisma.savedView.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDto);
}

// Create a new saved view owned by `ownerId`.
export async function createView(
  ownerId: string,
  name: string,
  query: string
): Promise<SavedViewDto> {
  const created = await prisma.savedView.create({
    data: { ownerId, name, query },
  });
  return toDto(created);
}

// Delete a saved view after verifying ownership. Throws if the view does not
// exist or is owned by a different user — callers should map this to a 404.
export async function deleteView(id: string, ownerId: string): Promise<void> {
  const existing = await prisma.savedView.findUnique({ where: { id } });
  if (!existing || existing.ownerId !== ownerId) {
    throw new Error("View not found or not owned by user");
  }
  await prisma.savedView.delete({ where: { id } });
}
