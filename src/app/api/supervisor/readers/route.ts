import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, message: "Sign in required." }, { status: 401 });
  if (user.role !== "EMPLOYEE") {
    return NextResponse.json({ ok: false, message: "Supervisor access required." }, { status: 403 });
  }
  if (!user.buildingId) {
    return NextResponse.json({ ok: true, readers: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const readers = await prisma.rfidReader.findMany({
    where: { enabled: true, buildingId: user.buildingId },
    select: {
      id: true,
      name: true,
      deviceNumber: true,
      connectionType: true,
      tcpConnected: true,
      lastGatewaySeenAt: true,
      lastSeenAt: true,
      heartbeatSeconds: true,
      enabled: true,
      buildingId: true,
    },
    orderBy: { deviceNumber: "asc" },
  });

  return NextResponse.json({ ok: true, readers }, { headers: { "Cache-Control": "no-store" } });
}
