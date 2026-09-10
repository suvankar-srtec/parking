import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { READER_MODES } from "@/lib/rfid-reader";
import { rfidUser, rfidApiError, lockRfid, RFID_TRANSACTION } from "@/lib/rfid-access";
import { ParkingError } from "@/lib/building-parking";

export async function GET() {
  try {
    const user = await rfidUser();
    const scope = user.role === "SUPER_ADMIN" ? {} : { buildingId: user.buildingId! };
    const readers = await prisma.rfidReader.findMany({ where: scope, include: { building: { select: { name: true } } }, orderBy: { deviceNumber: "asc" } });
    const buildings = user.role === "SUPER_ADMIN"
      ? await prisma.building.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
      : await prisma.building.findMany({ where: { id: user.buildingId! }, select: { id: true, name: true } });
    return NextResponse.json({ ok: true, readers, buildings, canManage: user.role !== "COMPANY_ADMIN", serverTime: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return rfidApiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await rfidUser();
    if (user.role === "COMPANY_ADMIN") throw new ParkingError("Only building or Super Admin accounts can configure readers.", 403);
    const body = await request.json().catch(() => null);
    const deviceNumber = String(body?.deviceNumber ?? "").trim();
    const name = String(body?.name ?? "").trim();
    const mode = String(body?.mode ?? "");
    const buildingId = user.role === "SUPER_ADMIN" ? String(body?.buildingId ?? "") : user.buildingId!;
    const enabled = body?.enabled === true;
    const heartbeatSeconds = Number(body?.heartbeatSeconds ?? 0);
    if (!Number.isInteger(heartbeatSeconds) || (heartbeatSeconds !== 0 && (heartbeatSeconds < 5 || heartbeatSeconds > 3600))) throw new ParkingError("Heartbeat interval must be 0 (off), or 5 to 3600 seconds.");
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(deviceNumber) || !name || name.length > 120 || !READER_MODES.includes(mode as typeof READER_MODES[number])) {
      throw new ParkingError("Enter a device number, reader name, and valid operating mode.");
    }
    if (enabled && !buildingId) throw new ParkingError("Assign a building before enabling this reader.");
    const result = await prisma.$transaction(async (tx) => {
      await lockRfid(tx);
      const existing = await tx.rfidReader.findUnique({ where: { deviceNumber } });
      if (user.role !== "SUPER_ADMIN" && existing && existing.buildingId !== user.buildingId) throw new ParkingError("This reader belongs to another building or needs Super Admin assignment.", 403);
      if (buildingId && !await tx.building.findUnique({ where: { id: buildingId }, select: { id: true } })) throw new ParkingError("Building not found.", 404);
      const reader = await tx.rfidReader.upsert({
        where: { deviceNumber }, create: { deviceNumber, name, mode, enabled, heartbeatSeconds, buildingId: buildingId || null },
        update: { name, mode, enabled, heartbeatSeconds, buildingId: buildingId || null },
      });
      if (existing && (existing.mode !== mode || existing.buildingId !== reader.buildingId || !enabled)) {
        await tx.rfidEnrollment.updateMany({ where: { readerId: reader.id, status: { in: ["WAITING", "CAPTURED"] } }, data: { status: "CANCELLED" } });
      }
      return reader;
    }, RFID_TRANSACTION);
    return NextResponse.json({ ok: true, reader: result, message: "Reader settings saved." });
  } catch (error) { return rfidApiError(error); }
}
