import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { READER_MODES } from "@/lib/rfid-reader";
import { rfidUser, rfidApiError, lockRfid, RFID_TRANSACTION } from "@/lib/rfid-access";
import { ParkingError } from "@/lib/building-parking";
import { isPrimarySuperAdmin } from "@/lib/super-admin-scope";

const MAX_QR_DATA_LENGTH = 1_600_000;

function validateQrData(value: unknown, label: string) {
  const data = String(value ?? "").trim();
  if (!data) throw new ParkingError(`${label} QR is required.`);
  if (data.length > MAX_QR_DATA_LENGTH) throw new ParkingError(`${label} QR image is too large. Please upload a smaller QR image.`);
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,[a-zA-Z0-9+/=\r\n]+$/.test(data)) {
    throw new ParkingError(`${label} QR must be a PNG, JPG, or WEBP image.`);
  }
  return data;
}

function readerSummary<T extends { registrationQrData?: string | null; entryExitQrData?: string | null }>(reader: T) {
  const { registrationQrData, entryExitQrData, ...rest } = reader;
  return {
    ...rest,
    hasRegistrationQr: Boolean(registrationQrData),
    hasEntryExitQr: Boolean(entryExitQrData),
  };
}

export async function GET() {
  try {
    const user = await rfidUser();
    const primarySuperAdmin = user.role === "SUPER_ADMIN" && isPrimarySuperAdmin(user);

    const readerWhere = user.role === "SUPER_ADMIN"
      ? (primarySuperAdmin
          ? { buildingId: { not: null } }
          : { building: { superAdminId: user.id } })
      : { buildingId: user.buildingId! };

    const buildingWhere = user.role === "SUPER_ADMIN"
      ? (primarySuperAdmin ? undefined : { superAdminId: user.id })
      : { id: user.buildingId! };

    const [readers, availableReaders, buildings] = await Promise.all([
      prisma.rfidReader.findMany({
        where: readerWhere,
        include: { building: { select: { name: true } } },
        orderBy: { deviceNumber: "asc" },
      }),
      user.role === "SUPER_ADMIN"
        ? prisma.rfidReader.findMany({
            where: { buildingId: null, lastSeenAt: { not: null } },
            orderBy: [{ lastSeenAt: "desc" }, { deviceNumber: "asc" }],
          })
        : Promise.resolve([]),
      prisma.building.findMany({
        where: buildingWhere,
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      readers: readers.map(readerSummary),
      availableReaders: availableReaders.map(readerSummary),
      buildings,
      canManage: user.role !== "COMPANY_ADMIN",
      canAddReaders: user.role === "SUPER_ADMIN",
      serverTime: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return rfidApiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await rfidUser();
    if (user.role === "COMPANY_ADMIN") throw new ParkingError("Only building or Super Admin accounts can configure readers.", 403);
    const body = await request.json().catch(() => null);

    if (body?.action === "reset") {
      if (user.role !== "SUPER_ADMIN") throw new ParkingError("Only Super Admin can remove a reader.", 403);
      const deviceNumber = String(body?.deviceNumber ?? "").trim();
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(deviceNumber)) throw new ParkingError("Invalid reader device number.");

      await prisma.$transaction(async (tx) => {
        await lockRfid(tx);
        const existing = await tx.rfidReader.findUnique({ where: { deviceNumber } });
        if (!existing) throw new ParkingError("Reader not found.", 404);

        if (!isPrimarySuperAdmin(user) && existing.buildingId) {
          const building = await tx.building.findUnique({ where: { id: existing.buildingId }, select: { superAdminId: true } });
          if (building?.superAdminId !== user.id) throw new ParkingError("This reader belongs to another Super Admin.", 403);
        }

        await tx.rfidEnrollment.updateMany({
          where: { readerId: existing.id, status: { in: ["WAITING", "CAPTURED"] } },
          data: { status: "CANCELLED" },
        });
        await tx.rfidReader.update({
          where: { id: existing.id },
          data: {
            enabled: false,
            buildingId: null,
            mode: "ENTRY_EXIT",
            registrationQrData: null,
            entryExitQrData: null,
          },
        });
      }, RFID_TRANSACTION);

      return NextResponse.json({ ok: true, message: "Reader removed. It is now available to add again." });
    }

    const deviceNumber = String(body?.deviceNumber ?? "").trim();
    const name = String(body?.name ?? "").trim();
    const mode = String(body?.mode ?? "");
    const buildingId = user.role === "SUPER_ADMIN" ? String(body?.buildingId ?? "") : user.buildingId!;
    const enabled = body?.enabled === true;
    const heartbeatSeconds = Number(body?.heartbeatSeconds ?? 0);
    const registrationQrData = body?.registrationQrData === undefined ? undefined : validateQrData(body.registrationQrData, "Registration");
    const entryExitQrData = body?.entryExitQrData === undefined ? undefined : validateQrData(body.entryExitQrData, "Entry / Exit");

    if (!Number.isInteger(heartbeatSeconds) || (heartbeatSeconds !== 0 && (heartbeatSeconds < 5 || heartbeatSeconds > 3600))) throw new ParkingError("Heartbeat interval must be 0 (off), or 5 to 3600 seconds.");
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(deviceNumber) || !name || name.length > 120 || !READER_MODES.includes(mode as typeof READER_MODES[number])) {
      throw new ParkingError("Enter a device number, reader name, and valid operating mode.");
    }
    if (enabled && !buildingId) throw new ParkingError("Assign a building before enabling this reader.");

    const result = await prisma.$transaction(async (tx) => {
      await lockRfid(tx);
      const existing = await tx.rfidReader.findUnique({ where: { deviceNumber } });

      if (user.role !== "SUPER_ADMIN" && existing && existing.buildingId !== user.buildingId) {
        throw new ParkingError("This reader belongs to another building or needs Super Admin assignment.", 403);
      }

      if (user.role === "SUPER_ADMIN" && !isPrimarySuperAdmin(user) && existing?.buildingId) {
        const existingBuilding = await tx.building.findUnique({
          where: { id: existing.buildingId },
          select: { superAdminId: true },
        });
        if (existingBuilding?.superAdminId !== user.id) {
          throw new ParkingError("This reader has already been assigned to another Super Admin.", 403);
        }
      }

      if (buildingId) {
        const building = await tx.building.findUnique({ where: { id: buildingId }, select: { id: true, superAdminId: true } });
        if (!building) throw new ParkingError("Building not found.", 404);
        if (user.role === "SUPER_ADMIN" && !isPrimarySuperAdmin(user) && building.superAdminId !== user.id) {
          throw new ParkingError("This building belongs to another Super Admin.", 403);
        }
      }

      const reader = await tx.rfidReader.upsert({
        where: { deviceNumber },
        create: {
          deviceNumber,
          name,
          mode,
          enabled,
          heartbeatSeconds,
          buildingId: buildingId || null,
          registrationQrData: registrationQrData ?? null,
          entryExitQrData: entryExitQrData ?? null,
        },
        update: {
          name,
          mode,
          enabled,
          heartbeatSeconds,
          buildingId: buildingId || null,
          ...(registrationQrData !== undefined ? { registrationQrData } : {}),
          ...(entryExitQrData !== undefined ? { entryExitQrData } : {}),
        },
      });

      if (existing && (existing.mode !== mode || existing.buildingId !== reader.buildingId || !enabled)) {
        await tx.rfidEnrollment.updateMany({
          where: { readerId: reader.id, status: { in: ["WAITING", "CAPTURED"] } },
          data: { status: "CANCELLED" },
        });
      }
      return reader;
    }, RFID_TRANSACTION);

    return NextResponse.json({ ok: true, reader: readerSummary(result), message: result.enabled ? "Reader allowed and assigned successfully." : "Reader settings saved." });
  } catch (error) { return rfidApiError(error); }
}
