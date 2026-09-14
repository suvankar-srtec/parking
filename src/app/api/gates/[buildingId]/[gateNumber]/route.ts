import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isPrimarySuperAdmin } from "@/lib/super-admin-scope";

const DIRECTIONS = ["SELECT", "ENTRY", "EXIT", "ENTRY_EXIT"] as const;

type GateDirection = (typeof DIRECTIONS)[number];

async function getAuthorizedBuilding(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>, buildingId: string) {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { id: true, maximumGate: true, superAdminId: true },
  });
  if (!building) return { error: NextResponse.json({ ok: false, message: "Building not found." }, { status: 404 }) };

  const allowed = user.role === "BUILDING_ADMIN"
    ? user.buildingId === buildingId
    : user.role === "SUPER_ADMIN" && (isPrimarySuperAdmin(user) || building.superAdminId === user.id);

  if (!allowed) return { error: NextResponse.json({ ok: false, message: "You do not have permission to update this building gate." }, { status: 403 }) };
  return { building };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ buildingId: string; gateNumber: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !["SUPER_ADMIN", "BUILDING_ADMIN"].includes(user.role)) {
    return NextResponse.json({ ok: false, message: "Super Admin or Building Admin access required." }, { status: 403 });
  }

  const { buildingId, gateNumber: gateNumberText } = await context.params;
  const gateNumber = Number(gateNumberText);
  if (!Number.isInteger(gateNumber) || gateNumber < 1) {
    return NextResponse.json({ ok: false, message: "Invalid gate number." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const direction = String(body?.direction ?? "") as GateDirection;
  if (!DIRECTIONS.includes(direction)) {
    return NextResponse.json({ ok: false, message: "Select Entry, Exit, Entry / Exit, or Select." }, { status: 400 });
  }

  const auth = await getAuthorizedBuilding(user, buildingId);
  if (auth.error) return auth.error;
  const building = auth.building!;

  if (gateNumber > building.maximumGate) {
    return NextResponse.json({ ok: false, message: `This building supports a maximum of ${building.maximumGate} gate${building.maximumGate === 1 ? "" : "s"}.` }, { status: 400 });
  }

  const gate = await prisma.gate.upsert({
    where: { buildingId_gateNumber: { buildingId, gateNumber } },
    create: { buildingId, gateNumber, direction },
    update: { direction },
    select: { id: true, buildingId: true, gateNumber: true, direction: true, updatedAt: true },
  });

  revalidatePath("/access-control/gate-details");
  return NextResponse.json({ ok: true, message: `Gate ${gateNumber} updated successfully.`, gate });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ buildingId: string; gateNumber: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !["SUPER_ADMIN", "BUILDING_ADMIN"].includes(user.role)) {
    return NextResponse.json({ ok: false, message: "Super Admin or Building Admin access required." }, { status: 403 });
  }

  const { buildingId, gateNumber: gateNumberText } = await context.params;
  const gateNumber = Number(gateNumberText);
  if (!Number.isInteger(gateNumber) || gateNumber < 1) {
    return NextResponse.json({ ok: false, message: "Invalid gate number." }, { status: 400 });
  }

  const auth = await getAuthorizedBuilding(user, buildingId);
  if (auth.error) return auth.error;

  const gateCount = await prisma.gate.count({ where: { buildingId } });
  if (gateCount <= 1) {
    return NextResponse.json({ ok: false, message: "At least one gate must remain. The Maximum Gate setting is not changed." }, { status: 409 });
  }

  await prisma.gate.deleteMany({ where: { buildingId, gateNumber } });
  revalidatePath("/access-control/gate-details");
  return NextResponse.json({ ok: true, message: `Gate ${gateNumber} removed. Maximum Gate remains unchanged.` });
}
