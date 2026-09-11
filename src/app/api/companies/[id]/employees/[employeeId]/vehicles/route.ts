import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { lockBuildingParking, ParkingError } from "@/lib/building-parking";
import { consumeCardEnrollment, lockRfid, RFID_TRANSACTION } from "@/lib/rfid-access";

const departments = ["Admin", "Finance", "HR", "IT", "Operations", "Security", "Other"];
const vehicleTypes = ["Two wheeler", "Four wheeler"];

export async function POST(request: Request, context: { params: Promise<{ id: string; employeeId: string }> }) {
  try {
    const { id: companyId, employeeId } = await context.params;
    const user = await getCurrentUser();
    if (!user || user.role !== "COMPANY_ADMIN" || user.companyId !== companyId) {
      return NextResponse.json({ ok: false, message: "Only this company's user can register vehicles." }, { status: 403 });
    }
    const body = await request.json().catch(() => null);
    const ownerName = String(body?.ownerName ?? "").trim();
    const plateNumber = String(body?.plateNumber ?? "").trim().toUpperCase();
    const vehicleType = String(body?.vehicleType ?? "").trim();
    const department = String(body?.department ?? "").trim();
    const enrollmentId = String(body?.enrollmentId ?? "").trim();
    if (body?.rfidCardNo) throw new ParkingError("Scan the card using a registration reader before saving.");
    const workerType = String(body?.workerType ?? "").trim();
    const isStaff = workerType === "Staff";
    if (!ownerName || !plateNumber || !vehicleTypes.includes(vehicleType) || !["Staff", "Employee"].includes(workerType) || !departments.includes(department)) {
      return NextResponse.json({ ok: false, message: "Complete all vehicle registration fields." }, { status: 400 });
    }
    const result = await prisma.$transaction(async (tx) => {
      await lockRfid(tx);
      const employee = await tx.employee.findFirst({ where: { id: employeeId, companyId }, select: { id: true, parkingLimit: true } });
      if (!employee) throw new ParkingError("Employee or company owner was not found in this company.", 404);
      const company = await tx.company.findUnique({ where: { id: companyId }, select: { buildingId: true, parkingAllocation: true } });
      if (!company) throw new ParkingError("Company was not found.", 404);
      await lockBuildingParking(tx, company.buildingId);

      const employeeUsed = await tx.vehicle.count({ where: { employeeId } });
      if (employeeUsed >= employee.parkingLimit) {
        throw new ParkingError(`This person has reached the assigned parking limit of ${employee.parkingLimit}.`, 400);
      }
      const companyUsed = await tx.vehicle.count({ where: { companyId } });
      if (companyUsed >= company.parkingAllocation) {
        throw new ParkingError("No unallotted parking spaces remain for this company.", 400);
      }

      const enrollment = enrollmentId ? await consumeCardEnrollment(tx, { enrollmentId, ownerId: user.id, companyId, employeeId, buildingId: company.buildingId }) : null;
      const vehicle = await tx.vehicle.create({ data: { ownerName, plateNumber, vehicleType, isStaff, department, rfidCardNo: enrollment?.cardNo || null, companyId, employeeId } });
      if (enrollment) await tx.rfidEvent.create({ data: { readerId: enrollment.readerId, buildingId: company.buildingId, companyId, vehicleId: vehicle.id, deviceNumber: enrollment.reader.deviceNumber, cardNo: enrollment.cardNo!, action: "REGISTER", code: "0000", message: "Card registered to vehicle." } });
      return { vehicle, available: company.parkingAllocation - companyUsed - 1 };
    }, RFID_TRANSACTION);
    revalidatePath("/dashboard");
    return NextResponse.json({ ok: true, message: `Vehicle registered successfully. ${result.available} company parking spaces remain.`, vehicle: result.vehicle }, { status: 201 });
  } catch (error) {
    if (error instanceof ParkingError) return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: false, message: "This plate number or RFID card is already registered." }, { status: 409 });
    }
    console.error("CREATE_VEHICLE_FAILED", error);
    return NextResponse.json({ ok: false, message: "Unable to register vehicle." }, { status: 500 });
  }
}
