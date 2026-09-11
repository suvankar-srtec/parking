import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

async function requireRootSuperAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN" || user.createdBySuperAdminId) return null;
  return user;
}

export async function GET() {
  const user = await requireRootSuperAdmin();
  if (!user) return NextResponse.json({ ok: false, message: "Root Super Admin access required." }, { status: 403 });

  const admins = await prisma.user.findMany({
    where: { role: "SUPER_ADMIN", createdBySuperAdminId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, userId: true, username: true, createdAt: true, _count: { select: { ownedBuildings: true } } },
  });
  return NextResponse.json({ ok: true, admins });
}

export async function POST(request: Request) {
  const creator = await requireRootSuperAdmin();
  if (!creator) return NextResponse.json({ ok: false, message: "Only the primary Super Admin can create another Super Admin." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");
  if (!username || !password.trim()) {
    return NextResponse.json({ ok: false, message: "Name and password are required." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(72015002)::text`;
    const rows = await tx.$queryRaw<Array<{ userId: string }>>`
      SELECT 'SA' || lpad(n::text, 2, '0') AS "userId"
      FROM generate_series(1, 9999) n
      WHERE NOT EXISTS (
        SELECT 1 FROM users u WHERE upper(u."userId") = 'SA' || lpad(n::text, 2, '0')
      )
      ORDER BY n
      LIMIT 1
    `;
    const userId = rows[0]?.userId;
    if (!userId) throw new Error("NO_SUPER_ADMIN_ID");
    return tx.user.create({
      data: {
        userId,
        username,
        password,
        role: "SUPER_ADMIN",
        createdBySuperAdminId: creator.id,
      },
      select: { id: true, userId: true, username: true, createdAt: true },
    });
  }, { maxWait: 10000, timeout: 15000 });

  return NextResponse.json({ ok: true, message: `Super Admin created successfully. User ID: ${result.userId}.`, admin: result }, { status: 201 });
}
