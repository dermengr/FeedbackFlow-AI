import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { seedRolesAndPermissions } from "@/lib/roles";

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(80).optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, password, name } = parsed.data;
  const normalized = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  // Ensure roles/permissions are seeded in the database
  await seedRolesAndPermissions();

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email: normalized, hashedPassword, name },
    select: { id: true, email: true, name: true },
  });

  // Assign default "Viewer" role to new users
  const viewerRole = await prisma.role.findUnique({ where: { name: "Viewer" } });
  if (viewerRole) {
    await prisma.userRole.create({
      data: { userId: user.id, roleId: viewerRole.id },
    });
  }

  return NextResponse.json({ id: user.id, email: user.email, name: user.name }, { status: 201 });
}
