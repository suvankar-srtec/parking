import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isPrimarySuperAdmin } from "@/lib/super-admin-scope";

const DIRECTIONS = ["ENTRY", "EXIT", "ENTRY_EXIT"] as const;

type GateDirection = (typeof DIRECTIONS)[number];

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
    return NextResponse.json({ ok: false, message: "Select Entry, Exit, or Entry / Exit." }, { status: 400 });
  }

  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { id: true, maximumGate: true, superAdminId: true },
  });
  if (!building) {
    return NextResponse.json({ ok: false, message: "Building not found." }, { status: 404 });
  }

  const allowed = user.role === "BUILDING_ADMIN"
    ? user.buildingId === buildingId
    : isPrimarySuperAdmin(user) || building.superAdminId === user.id;

  if (!allowed) {
    return NextResponse.json({ ok: false, message: "You do not have permission to update this building gate." }, { status: 403 });
  }

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
