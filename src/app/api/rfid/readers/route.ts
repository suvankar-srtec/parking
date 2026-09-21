import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { READER_MODES } from "@/lib/rfid-reader";
import { rfidUser, rfidApiError, lockRfid, RFID_TRANSACTION } from "@/lib/rfid-access";
import { ParkingError } from "@/lib/building-parking";
import { hasPermission } from "@/lib/permissions";
import { isPrimarySuperAdmin } from "@/lib/super-admin-scope";
import { parseGateConfig, serializeGateConfig } from "@/lib/gate-config";

const MAX_QR_DATA_LENGTH = 1_600_000;
const ADMIN_READER_MODES = new Set(["REGISTER", "ENTRY_EXIT"]);

function validateQrData(value: unknown, label: string) {
  const data = String(value ?? "").trim();
  if (!data) throw new ParkingError(`${label} QR is required.`);
  if (data.length > MAX_QR_DATA_LENGTH) throw new ParkingError(`${label} QR image is too large. Please upload a smaller QR image.`);
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,[a-zA-Z0-9+/=\r\n]+$/.test(data)) throw new ParkingError(`${label} QR must be a PNG, JPG, or WEBP image.`);
  return data;
}

function readerSummary<T extends { registrationQrData?: string | null; entryExitQrData?: string | null }>(reader: T) {
  const { registrationQrData, entryExitQrData, ...rest } = reader;
  return { ...rest, hasRegistrationQr: Boolean(registrationQrData), hasEntryExitQr: Boolean(entryExitQrData) };
}

function assertReaderPageAccess(user: Awaited<ReturnType<typeof rfidUser>>) {
  if (user.role === "COMPANY_ADMIN") throw new ParkingError("Reader management is not available to Company/User accounts.", 403);
  if (user.role === "BUILDING_ADMIN" && !hasPermission(user, "building.configureReaders")) {
    throw new ParkingError("Reader configuration is not assigned to this Admin account.", 403);
  }
}

async function assertSuperAdminBuilding(user: Awaited<ReturnType<typeof rfidUser>>, buildingId: string) {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { id: true, superAdminId: true },
  });
  if (!building) throw new ParkingError("Building not found.", 404);
  if (!isPrimarySuperAdmin(user) && building.superAdminId !== user.id) {
    throw new ParkingError("This building belongs to another Super Admin.", 403);
  }
  return building;
}

export async function GET() {
  try {
    const user = await rfidUser();
    assertReaderPageAccess(user);

    const primarySuperAdmin = user.role === "SUPER_ADMIN" && isPrimarySuperAdmin(user);
    const canAssignReaders = user.role === "SUPER_ADMIN";
    const canConfigureReaders = user.role === "BUILDING_ADMIN" && hasPermission(user, "building.configureReaders");

    const configuredReaderWhere = user.role === "SUPER_ADMIN"
      ? (primarySuperAdmin
          ? { enabled: true, buildingId: { not: null } }
          : { enabled: true, building: { superAdminId: user.id } })
      : { enabled: true, buildingId: user.buildingId!, mode: { not: "UNASSIGNED" } };

    const availableReaderWhere = user.role === "SUPER_ADMIN"
      ? { enabled: false, buildingId: null, lastSeenAt: { not: null } }
      : { enabled: true, buildingId: user.buildingId!, mode: "UNASSIGNED" };

    const buildingWhere = user.role === "SUPER_ADMIN"
      ? (primarySuperAdmin ? undefined : { superAdminId: user.id })
      : { id: user.buildingId! };

    const [readers, availableReaders, buildings] = await Promise.all([
      prisma.rfidReader.findMany({
        where: configuredReaderWhere,
        include: { building: { select: { name: true } } },
        orderBy: { deviceNumber: "asc" },
      }),
      (canAssignReaders || canConfigureReaders)
        ? prisma.rfidReader.findMany({
            where: availableReaderWhere,
            include: { building: { select: { name: true } } },
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
      canManage: canConfigureReaders,
      canAddReaders: canAssignReaders || canConfigureReaders,
      canAssignReaders,
      canConfigureReaders,
      canRemoveReaders: user.role === "SUPER_ADMIN" || canConfigureReaders,
      serverTime: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return rfidApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await rfidUser();
    assertReaderPageAccess(user);
    const body = await request.json().catch(() => null);

    if (body?.action === "reset") {
      if (!["SUPER_ADMIN", "BUILDING_ADMIN"].includes(user.role)) {
        throw new ParkingError("Only Super Admin or Building Admin can remove a reader allocation.", 403);
      }

      const deviceNumber = String(body?.deviceNumber ?? "").trim();
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(deviceNumber)) {
        throw new ParkingError("Invalid reader device number.");
      }

      const existing = await prisma.rfidReader.findUnique({ where: { deviceNumber } });
      if (!existing) throw new ParkingError("Reader not found.", 404);

      if (user.role === "BUILDING_ADMIN") {
        if (!user.buildingId || existing.buildingId !== user.buildingId) {
          throw new ParkingError("You can remove only readers allotted to your own building.", 403);
        }
      } else if (!isPrimarySuperAdmin(user) && existing.buildingId) {
        const building = await prisma.building.findUnique({
          where: { id: existing.buildingId },
          select: { superAdminId: true },
        });
        if (building?.superAdminId !== user.id) {
          throw new ParkingError("This reader belongs to another Super Admin.", 403);
        }
      }

      const previousBuildingId = existing.buildingId;

      // Detach/deactivate first so a live scan cannot continue using this reader
      // while administrative cleanup is being performed.
      await prisma.rfidReader.update({
        where: { id: existing.id },
        data: user.role === "BUILDING_ADMIN"
          ? {
              enabled: true,
              mode: "UNASSIGNED",
            }
          : {
              enabled: false,
              buildingId: null,
              mode: "UNASSIGNED",
              registrationQrData: null,
              entryExitQrData: null,
            },
      });

      await prisma.rfidEnrollment.updateMany({
        where: { readerId: existing.id, status: { in: ["WAITING", "CAPTURED"] } },
        data: { status: "CANCELLED" },
      });

      if (previousBuildingId) {
        const gates = await prisma.gate.findMany({
          where: { buildingId: previousBuildingId },
          select: { id: true, direction: true },
        });

        for (const gate of gates) {
          const config = parseGateConfig(gate.direction);
          const entryReaderId = config.entryReaderId === existing.id ? null : config.entryReaderId;
          const exitReaderId = config.exitReaderId === existing.id ? null : config.exitReaderId;

          if (entryReaderId !== config.entryReaderId || exitReaderId !== config.exitReaderId) {
            await prisma.gate.update({
              where: { id: gate.id },
              data: { direction: serializeGateConfig(config.direction, entryReaderId, exitReaderId) },
            });
          }
        }
      }

      return NextResponse.json({
        ok: true,
        message: user.role === "BUILDING_ADMIN"
          ? "Reader removed from active configuration. It remains allotted to your building and can be added again."
          : "Reader removed from the building. It is now available for Super Admin allotment.",
      });
    }

    if (body?.action === "assign") {
      if (user.role !== "SUPER_ADMIN") throw new ParkingError("Only Super Admin can allot a reader to a building.", 403);

      const deviceNumber = String(body?.deviceNumber ?? "").trim();
      const name = String(body?.name ?? "").trim();
      const buildingId = String(body?.buildingId ?? "").trim();

      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(deviceNumber) || !name || name.length > 120 || !buildingId) {
        throw new ParkingError("Select a detected reader, enter its name, and choose a building.");
      }
      await assertSuperAdminBuilding(user, buildingId);

      const result = await prisma.$transaction(async (tx) => {
        await lockRfid(tx);
        const existing = await tx.rfidReader.findUnique({ where: { deviceNumber } });
        if (!existing) throw new ParkingError("This physical reader has not contacted the system yet.", 404);
        if (existing.buildingId && existing.buildingId !== buildingId) {
          throw new ParkingError("This reader is already allotted to another building.", 409);
        }

        await tx.rfidEnrollment.updateMany({
          where: { readerId: existing.id, status: { in: ["WAITING", "CAPTURED"] } },
          data: { status: "CANCELLED" },
        });

        return tx.rfidReader.update({
          where: { id: existing.id },
          data: {
            name,
            buildingId,
            enabled: true,
            mode: "UNASSIGNED",
          },
        });
      }, RFID_TRANSACTION);

      return NextResponse.json({
        ok: true,
        reader: readerSummary(result),
        message: "Reader allotted to the building. The Building Admin can now configure its purpose.",
      });
    }

    if (user.role !== "BUILDING_ADMIN") {
      throw new ParkingError("Only the Building Admin can configure reader purpose.", 403);
    }
    if (!hasPermission(user, "building.configureReaders")) {
      throw new ParkingError("Reader configuration is not assigned to this Admin account.", 403);
    }

    const deviceNumber = String(body?.deviceNumber ?? "").trim();
    const mode = String(body?.mode ?? "");
    const registrationQrData = body?.registrationQrData === undefined ? undefined : validateQrData(body.registrationQrData, "Registration");
    const entryExitQrData = body?.entryExitQrData === undefined ? undefined : validateQrData(body.entryExitQrData, "Entry / Exit");

    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(deviceNumber)) {
      throw new ParkingError("Invalid reader device number.");
    }
    if (!READER_MODES.includes(mode as typeof READER_MODES[number]) || !ADMIN_READER_MODES.has(mode)) {
      throw new ParkingError("Select Registration or Entry / Exit.");
    }

    const result = await prisma.$transaction(async (tx) => {
      await lockRfid(tx);
      const existing = await tx.rfidReader.findUnique({ where: { deviceNumber } });
      if (!existing) throw new ParkingError("Reader not found.", 404);
      if (!user.buildingId || existing.buildingId !== user.buildingId) {
        throw new ParkingError("This reader is not allotted to your building.", 403);
      }

      if (existing.mode !== mode) {
        await tx.rfidEnrollment.updateMany({
          where: { readerId: existing.id, status: { in: ["WAITING", "CAPTURED"] } },
          data: { status: "CANCELLED" },
        });
      }

      return tx.rfidReader.update({
        where: { id: existing.id },
        data: {
          mode,
          enabled: true,
          ...(registrationQrData !== undefined ? { registrationQrData } : {}),
          ...(entryExitQrData !== undefined ? { entryExitQrData } : {}),
        },
      });
    }, RFID_TRANSACTION);

    return NextResponse.json({
      ok: true,
      reader: readerSummary(result),
      message: "Reader purpose configured successfully.",
    });
  } catch (error) {
    return rfidApiError(error);
  }
}
