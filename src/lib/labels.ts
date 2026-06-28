import { prisma } from "@/lib/prisma";

export const LABEL_COLORS = [
  "slate",
  "red",
  "orange",
  "amber",
  "green",
  "emerald",
  "teal",
  "blue",
  "indigo",
  "violet",
  "purple",
  "pink",
] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

export interface LabelDto {
  id: string;
  name: string;
  color: string;
}

function isLabelColor(value: string): value is LabelColor {
  return (LABEL_COLORS as readonly string[]).includes(value);
}

function toDto(label: {
  id: string;
  name: string;
  color: string;
}): LabelDto {
  return { id: label.id, name: label.name, color: label.color };
}

// listLabels — return all labels sorted by name ascending.
export async function listLabels(): Promise<LabelDto[]> {
  const labels = await prisma.label.findMany({
    orderBy: { name: "asc" },
  });
  return labels.map(toDto);
}

// createLabel — create a new label after validating the color.
export async function createLabel(
  name: string,
  color: string
): Promise<LabelDto> {
  if (!isLabelColor(color)) {
    throw new Error(`Invalid color: ${color}`);
  }
  const label = await prisma.label.create({
    data: { name, color },
  });
  return toDto(label);
}

// updateLabel — update an existing label's name and/or color.
export async function updateLabel(
  id: string,
  data: { name?: string; color?: string }
): Promise<LabelDto> {
  if (data.color !== undefined && !isLabelColor(data.color)) {
    throw new Error(`Invalid color: ${data.color}`);
  }
  const label = await prisma.label.update({
    where: { id },
    data,
  });
  return toDto(label);
}

// deleteLabel — remove a label by id.
export async function deleteLabel(id: string): Promise<void> {
  await prisma.label.delete({ where: { id } });
}
