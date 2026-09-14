import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { lockBuildingParking, ParkingError } from "@/lib/building-parking";
import { normalizeCard, SCAN_DEBOUNCE_MS, type ParsedRfidReaderMessage } from "@/lib/rfid-reader";

export const RFID_TRANSACTION = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10000, timeout: 20000 };
const CAPTURED_SAVE_WINDOW_MS = 5 * 60 * 1000;
const READER_SUCCESS_CODE = "0000";
const READER_NO_SUCCESS_CODE = "0001";

export async function lockRfid(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(72015002)::text`;
}
export async function rfidUser() {
  const user = await getCurrentUser();
  if (!user || !["SUPER_ADMIN", "BUILDING_ADMIN", "COMPANY_ADMIN"].includes(user.role)) throw new ParkingError("Sign in to manage RFID access.", 403);
  if (user.role !== "SUPER_ADMIN" && !user.buildingId) throw new ParkingError("No building is assigned to this account.", 403);
  if (user.role === "COMPANY_ADMIN" && !user.companyId) throw new ParkingError("No company is assigned to this account.", 403);
  return user;
}
export function rfidApiError(error: unknown) {
  if (error instanceof ParkingError) return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ ok: false, message: "This reader or card is already registered, or the reader is busy." }, { status: 409 });
  }
  console.error("RFID_OPERATION_FAILED");
  return NextResponse.json({ ok: false, message: "Unable to complete the RFID request. Please try again." }, { status: 500 });
}
export async function expireEnrollments(tx: Prisma.TransactionClient) {
  await tx.rfidEnrollment.updateMany({
    where: { status: { in: ["WAITING", "CAPTURED"] }, expiresAt: { lte: new Date() } },
    data: { status: "EXPIRED" },
  });
}

export async function processReaderScan(input: ParsedRfidReaderMessage) {
  const cardNo = normalizeCard(input.decodedResult);
  const receivedAt = Date.now();
  return prisma.$transaction(async (tx) => {
    await lockRfid(tx);
    const now = new Date();
    const reader = await tx.rfidReader.upsert({
      where: { deviceNumber: input.deviceNumber },
      create: {
        deviceNumber: input.deviceNumber,
        name: "Reader " + input.deviceNumber,
        lastSeenAt: now,
        connectionType: "HTTP",
        tcpConnected: false,
      },
      update: {
        lastSeenAt: now,
        connectionType: "HTTP",
        tcpConnected: false,
      },
    });
    async function record(code: string, message: string, action = "DENIED", vehicleId?: string, companyId?: string) {
      const readerCode = code === READER_SUCCESS_CODE ? READER_SUCCESS_CODE : READER_NO_SUCCESS_CODE;
      await tx.rfidEvent.create({ data: {
        readerId: reader.id, buildingId: reader.buildingId, deviceNumber: reader.deviceNumber,
        cardNo, action, code: readerCode, message, vehicleId, companyId,
      } });
      return { code: readerCode, message };
    }
    if (!reader.enabled || !reader.buildingId) return record("1004", "Reader must be assigned to a building and enabled.");
    await lockBuildingParking(tx, reader.buildingId);

    if (reader.mode === "REGISTER") {
      await expireEnrollments(tx);
      const enrollment = await tx.rfidEnrollment.findFirst({ where: { readerId: reader.id, status: { in: ["WAITING", "CAPTURED"] } } });
      if (!enrollment) return record("1005", "Start card registration from a vehicle form.");
      const company = await tx.company.findUnique({ where: { id: enrollment.companyId }, select: { buildingId: true } });
      if (company?.buildingId !== reader.buildingId) return record("1004", "Registration belongs to another building.");
      if (enrollment.status === "CAPTURED") {
        return record(READER_NO_SUCCESS_CODE,
          enrollment.cardNo === cardNo ? "Card already captured; waiting for registration to be saved." : "A card is already captured. Finish or cancel registration.",
          "IGNORED", enrollment.vehicleId || undefined, enrollment.companyId);
      }
      const assigned = await tx.vehicle.findUnique({ where: { rfidCardNo: cardNo }, select: { id: true } });
      if (assigned && assigned.id !== enrollment.vehicleId) {
        await tx.rfidEnrollment.update({
          where: { id: enrollment.id },
          data: { cardNo, status: "DUPLICATE" },
        });
        return record("1006", "This RFID card is already assigned to another vehicle.", "DENIED", assigned.id, enrollment.companyId);
      }
      await tx.rfidEnrollment.update({
        where: { id: enrollment.id },
        data: {
          cardNo,
          status: "CAPTURED",
          expiresAt: new Date(Date.now() + CAPTURED_SAVE_WINDOW_MS),
        },
      });
      return record(READER_NO_SUCCESS_CODE, "Card captured. Save the vehicle to complete registration.", "CAPTURE", enrollment.vehicleId || undefined, enrollment.companyId);
    }

    const vehicle = await tx.vehicle.findUnique({ where: { rfidCardNo: cardNo }, include: { company: true } });
    if (!vehicle) return record(READER_NO_SUCCESS_CODE, "RFID card is not registered");
    if (vehicle.company.buildingId !== reader.buildingId) return record("1004", "Card belongs to another building.");
    const context = [vehicle.id, vehicle.companyId] as const;

    if (!["ENTRY_EXIT", "ENTRY", "EXIT"].includes(reader.mode)) {
      return record(READER_NO_SUCCESS_CODE, "Reader must be configured as Entry/Exit or Registration.", "DENIED", ...context);
    }

    if (vehicle.lastAccessAt && receivedAt - vehicle.lastAccessAt.getTime() < SCAN_DEBOUNCE_MS) {
      return record(READER_NO_SUCCESS_CODE, "Duplicate scan ignored", "IGNORED", ...context);
    }

    let enter: boolean;
    if (reader.mode === "ENTRY_EXIT") {
      // Combined reader automatically treats the next valid scan as ENTRY when outside
      // and EXIT when already inside.
      enter = !vehicle.isInside;
    } else if (reader.mode === "ENTRY") {
      if (vehicle.isInside) return record(READER_NO_SUCCESS_CODE, "Exit before Entry.", "DENIED", ...context);
      enter = true;
    } else {
      if (!vehicle.isInside) return record(READER_NO_SUCCESS_CODE, "Vehicle is already outside.", "IGNORED", ...context);
      enter = false;
    }

    if (enter) {
      const companyInside = await tx.vehicle.count({ where: { companyId: vehicle.companyId, isInside: true } });
      const buildingInside = await tx.vehicle.count({ where: { isInside: true, company: { buildingId: reader.buildingId } } });
      const building = await tx.building.findUniqueOrThrow({ where: { id: reader.buildingId }, select: { companyParking: true, totalParking: true } });
      if (companyInside >= vehicle.company.parkingAllocation || buildingInside >= Math.min(building.companyParking, building.totalParking)) {
        return record(READER_NO_SUCCESS_CODE, "Parking allocation is full", "DENIED", ...context);
      }
    }

    await tx.vehicle.update({ where: { id: vehicle.id }, data: { isInside: enter, lastAccessAt: new Date(), lastAccessDevice: reader.deviceNumber } });

    // Valid ENTRY and valid EXIT both return 0000 so the configured red LED can blink.
    // Registration and all denied/duplicate scans return 0001.
    return record(READER_SUCCESS_CODE, enter ? "Parking allowed" : "Vehicle checked out", enter ? "ENTRY" : "EXIT", ...context);
  }, RFID_TRANSACTION);
}

export async function consumeCardEnrollment(tx: Prisma.TransactionClient, input: {
  enrollmentId: string; ownerId: string; companyId: string; employeeId: string; buildingId: string; vehicleId?: string;
}) {
  const enrollment = await tx.rfidEnrollment.findUnique({ where: { id: input.enrollmentId }, include: { reader: true } });
  if (!enrollment || enrollment.ownerId !== input.ownerId || enrollment.companyId !== input.companyId ||
    enrollment.employeeId !== input.employeeId || enrollment.vehicleId !== (input.vehicleId || null)) {
    throw new ParkingError("This card registration does not belong to this vehicle form.", 403);
  }
  if (enrollment.status !== "CAPTURED" || !enrollment.cardNo || enrollment.expiresAt <= new Date()) {
    throw new ParkingError("Scan a card again before saving this registration.", 409);
  }
  if (!enrollment.reader.enabled || enrollment.reader.mode !== "REGISTER" || enrollment.reader.buildingId !== input.buildingId) {
    throw new ParkingError("The registration reader is no longer available.", 409);
  }
  const assigned = await tx.vehicle.findUnique({ where: { rfidCardNo: enrollment.cardNo }, select: { id: true } });
  if (assigned && assigned.id !== input.vehicleId) throw new ParkingError("This RFID card is already assigned to another vehicle.", 409);
  await tx.rfidEnrollment.update({ where: { id: enrollment.id }, data: { status: "COMPLETED" } });
  return enrollment;
}
