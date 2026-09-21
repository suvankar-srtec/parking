import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { lockBuildingParking, ParkingError } from "@/lib/building-parking";
import { normalizeCard, SCAN_DEBOUNCE_MS, type ParsedRfidReaderMessage } from "@/lib/rfid-reader";
import { parseGateConfig } from "@/lib/gate-config";

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
  console.error("RFID_OPERATION_FAILED", error);
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

    async function record(
      code: string,
      message: string,
      action = "DENIED",
      vehicleId?: string,
      companyId?: string,
      ownerVehicleId?: string,
    ) {
      const readerCode = code === READER_SUCCESS_CODE ? READER_SUCCESS_CODE : READER_NO_SUCCESS_CODE;
      await tx.rfidEvent.create({ data: {
        readerId: reader.id,
        buildingId: reader.buildingId,
        deviceNumber: reader.deviceNumber,
        cardNo,
        action,
        code: readerCode,
        message,
        vehicleId,
        companyId,
        ownerVehicleId,
      } });
      return { code: readerCode, message };
    }

    if (!reader.enabled || !reader.buildingId) return record("1004", "Reader must be assigned to a building and enabled.");
    await lockBuildingParking(tx, reader.buildingId);

    const buildingStatus = await tx.building.findUniqueOrThrow({
      where: { id: reader.buildingId },
      select: { enabled: true },
    });
    if (reader.mode === "REGISTER" && !buildingStatus.enabled) {
      return record(READER_NO_SUCCESS_CODE, "Building is disabled. Card registration is unavailable.");
    }

    if (reader.mode === "REGISTER") {
      await expireEnrollments(tx);
      const enrollment = await tx.rfidEnrollment.findFirst({
        where: { readerId: reader.id, status: { in: ["WAITING", "CAPTURED"] } },
      });
      if (!enrollment) return record("1005", "Start card registration from a vehicle form.");

      if (enrollment.ownerParking) {
        if (enrollment.buildingId !== reader.buildingId) return record("1004", "Registration belongs to another building.");
      } else {
        if (!enrollment.companyId) return record("1004", "Registration is missing company information.");
        const company = await tx.company.findUnique({ where: { id: enrollment.companyId }, select: { buildingId: true } });
        if (company?.buildingId !== reader.buildingId) return record("1004", "Registration belongs to another building.");
      }

      if (enrollment.status === "CAPTURED") {
        return record(
          READER_NO_SUCCESS_CODE,
          enrollment.cardNo === cardNo ? "Card already captured; waiting for registration to be saved." : "A card is already captured. Finish or cancel registration.",
          "IGNORED",
          enrollment.vehicleId || undefined,
          enrollment.companyId || undefined,
        );
      }

      const [assignedVehicle, assignedOwnerVehicle] = await Promise.all([
        tx.vehicle.findUnique({ where: { rfidCardNo: cardNo }, select: { id: true } }),
        tx.buildingOwnerVehicle.findUnique({ where: { rfidCardNo: cardNo }, select: { id: true } }),
      ]);
      if ((assignedVehicle && assignedVehicle.id !== enrollment.vehicleId) || assignedOwnerVehicle) {
        await tx.rfidEnrollment.update({
          where: { id: enrollment.id },
          data: { cardNo, status: "DUPLICATE" },
        });
        return record(
          "1006",
          "This RFID card is already assigned to another vehicle.",
          "DENIED",
          assignedVehicle?.id,
          enrollment.companyId || undefined,
          assignedOwnerVehicle?.id,
        );
      }

      await tx.rfidEnrollment.update({
        where: { id: enrollment.id },
        data: {
          cardNo,
          status: "CAPTURED",
          expiresAt: new Date(Date.now() + CAPTURED_SAVE_WINDOW_MS),
        },
      });
      return record(
        READER_NO_SUCCESS_CODE,
        "Card captured. Save the vehicle to complete registration.",
        "CAPTURE",
        enrollment.vehicleId || undefined,
        enrollment.companyId || undefined,
      );
    }

    const [vehicle, ownerVehicle] = await Promise.all([
      tx.vehicle.findUnique({
        where: { rfidCardNo: cardNo },
        include: {
          company: true,
          employee: { select: { category: true } },
        },
      }),
      tx.buildingOwnerVehicle.findUnique({ where: { rfidCardNo: cardNo } }),
    ]);

    if (!vehicle && !ownerVehicle) return record(READER_NO_SUCCESS_CODE, "RFID card is not registered");
    if (vehicle && vehicle.company.buildingId !== reader.buildingId) return record("1004", "Card belongs to another building.");
    if (ownerVehicle && ownerVehicle.buildingId !== reader.buildingId) return record("1004", "Card belongs to another building.");

    const buildingGates = await tx.gate.findMany({
      where: { buildingId: reader.buildingId },
      select: { gateNumber: true, direction: true },
      orderBy: { gateNumber: "asc" },
    });
    const allottedGate = buildingGates
      .map((gate) => ({ gate, config: parseGateConfig(gate.direction) }))
      .find(({ config }) => config.entryReaderId === reader.id || config.exitReaderId === reader.id);
    if (!allottedGate) {
      return record(
        READER_NO_SUCCESS_CODE,
        "Reader is not allotted to a gate.",
        "DENIED",
        vehicle?.id,
        vehicle?.companyId,
        ownerVehicle?.id,
      );
    }

    let effectiveMode = allottedGate.config.direction;
    if (allottedGate.config.direction === "ENTRY_EXIT") {
      if (allottedGate.config.entryReaderId === reader.id && allottedGate.config.exitReaderId === reader.id) {
        effectiveMode = "ENTRY_EXIT";
      } else if (allottedGate.config.entryReaderId === reader.id) {
        effectiveMode = "ENTRY";
      } else if (allottedGate.config.exitReaderId === reader.id) {
        effectiveMode = "EXIT";
      }
    }
    if (!["ENTRY_EXIT", "ENTRY", "EXIT"].includes(effectiveMode)) {
      return record(
        READER_NO_SUCCESS_CODE,
        "Gate direction must be configured before scanning.",
        "DENIED",
        vehicle?.id,
        vehicle?.companyId,
        ownerVehicle?.id,
      );
    }

    const currentInside = ownerVehicle ? ownerVehicle.isInside : vehicle!.isInside;
    const lastAccessAt = ownerVehicle ? ownerVehicle.lastAccessAt : vehicle!.lastAccessAt;
    if (lastAccessAt && receivedAt - lastAccessAt.getTime() < SCAN_DEBOUNCE_MS) {
      return record(READER_NO_SUCCESS_CODE, "Duplicate scan ignored", "IGNORED", vehicle?.id, vehicle?.companyId, ownerVehicle?.id);
    }

    let enter: boolean;
    if (effectiveMode === "ENTRY_EXIT") {
      enter = !currentInside;
    } else if (effectiveMode === "ENTRY") {
      if (currentInside) return record(READER_NO_SUCCESS_CODE, "Exit before Entry.", "DENIED", vehicle?.id, vehicle?.companyId, ownerVehicle?.id);
      enter = true;
    } else {
      if (!currentInside) return record(READER_NO_SUCCESS_CODE, "Vehicle is already outside.", "IGNORED", vehicle?.id, vehicle?.companyId, ownerVehicle?.id);
      enter = false;
    }

    if (enter && !buildingStatus.enabled) {
      return record(READER_NO_SUCCESS_CODE, "Building is disabled. Entry is not allowed.", "DENIED", vehicle?.id, vehicle?.companyId, ownerVehicle?.id);
    }

    if (enter) {
      const [companyInsideTotal, ownerInside, building] = await Promise.all([
        tx.vehicle.count({ where: { isInside: true, company: { buildingId: reader.buildingId } } }),
        tx.buildingOwnerVehicle.count({ where: { buildingId: reader.buildingId, isInside: true } }),
        tx.building.findUniqueOrThrow({
          where: { id: reader.buildingId },
          select: { companyParking: true, ownerParking: true, totalParking: true },
        }),
      ]);
      const totalInside = companyInsideTotal + ownerInside;

      if (ownerVehicle) {
        if (ownerInside >= building.ownerParking || totalInside >= building.totalParking) {
          return record(READER_NO_SUCCESS_CODE, "Owner Parking allocation is full", "DENIED", undefined, undefined, ownerVehicle.id);
        }
      } else {
        const isCompanyOwner = vehicle!.employee.category === "OWNER";
        const categoryInside = await tx.vehicle.count({
          where: {
            companyId: vehicle!.companyId,
            isInside: true,
            employee: { category: isCompanyOwner ? "OWNER" : { not: "OWNER" } },
          },
        });
        const categoryLimit = isCompanyOwner
          ? vehicle!.company.ownerParkingAllocation
          : vehicle!.company.employeeParkingAllocation;

        if (
          categoryInside >= categoryLimit ||
          companyInsideTotal >= building.companyParking ||
          totalInside >= building.totalParking
        ) {
          return record(
            READER_NO_SUCCESS_CODE,
            isCompanyOwner ? "Company Owner parking allocation is full" : "Employee parking allocation is full",
            "DENIED",
            vehicle!.id,
            vehicle!.companyId,
          );
        }
      }
    }

    if (ownerVehicle) {
      await tx.buildingOwnerVehicle.update({
        where: { id: ownerVehicle.id },
        data: { isInside: enter, lastAccessAt: new Date(), lastAccessDevice: reader.deviceNumber },
      });
      return record(
        READER_SUCCESS_CODE,
        enter ? "Owner Parking allowed" : "Owner vehicle checked out",
        enter ? "ENTRY" : "EXIT",
        undefined,
        undefined,
        ownerVehicle.id,
      );
    }

    await tx.vehicle.update({
      where: { id: vehicle!.id },
      data: { isInside: enter, lastAccessAt: new Date(), lastAccessDevice: reader.deviceNumber },
    });
    return record(
      READER_SUCCESS_CODE,
      enter ? "Parking allowed" : "Vehicle checked out",
      enter ? "ENTRY" : "EXIT",
      vehicle!.id,
      vehicle!.companyId,
    );
  }, RFID_TRANSACTION);
}

export async function consumeCardEnrollment(tx: Prisma.TransactionClient, input: {
  enrollmentId: string; ownerId: string; companyId: string; employeeId: string; buildingId: string; vehicleId?: string;
}) {
  const building = await tx.building.findUnique({ where: { id: input.buildingId }, select: { enabled: true } });
  if (!building?.enabled) throw new ParkingError("Building is disabled. Card registration is unavailable.", 403);
  const enrollment = await tx.rfidEnrollment.findUnique({ where: { id: input.enrollmentId }, include: { reader: true } });
  if (!enrollment || enrollment.ownerParking || enrollment.ownerId !== input.ownerId || enrollment.companyId !== input.companyId ||
    enrollment.employeeId !== input.employeeId || enrollment.vehicleId !== (input.vehicleId || null)) {
    throw new ParkingError("This card registration does not belong to this vehicle form.", 403);
  }
  if (enrollment.status !== "CAPTURED" || !enrollment.cardNo || enrollment.expiresAt <= new Date()) {
    throw new ParkingError("Scan a card again before saving this registration.", 409);
  }
  if (!enrollment.reader.enabled || enrollment.reader.mode !== "REGISTER" || enrollment.reader.buildingId !== input.buildingId) {
    throw new ParkingError("The registration reader is no longer available.", 409);
  }
  const [assigned, assignedOwner] = await Promise.all([
    tx.vehicle.findUnique({ where: { rfidCardNo: enrollment.cardNo }, select: { id: true } }),
    tx.buildingOwnerVehicle.findUnique({ where: { rfidCardNo: enrollment.cardNo }, select: { id: true } }),
  ]);
  if ((assigned && assigned.id !== input.vehicleId) || assignedOwner) {
    throw new ParkingError("This RFID card is already assigned to another vehicle.", 409);
  }
  await tx.rfidEnrollment.update({ where: { id: enrollment.id }, data: { status: "COMPLETED" } });
  return enrollment;
}
