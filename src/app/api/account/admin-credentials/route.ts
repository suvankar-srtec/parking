import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "BUILDING_ADMIN" || !user.buildingId) {
    return NextResponse.json({ ok: false, message: "Building Admin access required." }, { status: 403 });
  }

  const building = await prisma.building.findUnique({
    where: { id: user.buildingId },
    select: { id: true, name: true },
  });
  if (!building) {
    return NextResponse.json({ ok: false, message: "Assigned building was not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    credentials: {
      buildingId: building.id,
      userId: user.userId,
      buildingName: building.name,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
