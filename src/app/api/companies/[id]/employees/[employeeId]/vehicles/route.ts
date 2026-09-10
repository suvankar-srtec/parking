import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { lockBuildingParking, ParkingError } from "@/lib/building-parking";

const departments = ["Admin", "Finance", "HR", "IT", "Operations", "Security", "Other"];
const vehicleTypes = ["Two wheeler", "Four wheeler"];

export async function POST(request: Request, context: { params: Promise<{ id: string; employeeId: string }> }) {
  try {
    const { id: companyId, employeeId } = await context.params;
    const user = await getCurrentUser();
    if (!user || user.role !== "COMPANY_ADMIN" || user.companyId !== companyId) {
      return NextResponse.json({ ok: false, message: "Only this company's administrator can register vehicles." }, { status: 403 });
    }
    const body = await request.json();
    const ownerName = String(body?.ownerName ?? "").trim();
    const plateNumber = String(body?.plateNumber ?? "").trim().toUpperCase();
    const vehicleType = String(body?.vehicleType ?? "").trim();
    const department = String(body?.department ?? "").trim();
    const rfidCardNo = String(body?.rfidCardNo ?? "").trim() || null;
    const workerType = String(body?.workerType ?? "").trim();
    const isStaff = workerType === "Staff";
    if (!ownerName || !plateNumber || !vehicleTypes.includes(vehicleType) || !["Staff", "Employee"].includes(workerType) || !departments.includes(department)) {
      return NextResponse.json({ ok: false, message: "Complete all vehicle registration fields." }, { status: 400 });
    }
    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({ where: { id: employeeId, companyId }, select: { id: true } });
      if (!employee) throw new ParkingError("Employee was not found in this company.", 404);
      const company = await tx.company.findUnique({ where: { id: companyId }, select: { buildingId: true, parkingAllocation: true } });
      if (!company) throw new ParkingError("Company was not found.", 404);
      await lockBuildingParking(tx, company.buildingId);
      const used = await tx.vehicle.count({ where: { companyId } });
      if (used >= company.parkingAllocation) {
        throw new ParkingError(`No unallotted parking spaces remain for this company.`, 400);
      }
      const vehicle = await tx.vehicle.create({ data: { ownerName, plateNumber, vehicleType, isStaff, department, rfidCardNo, companyId, employeeId } });
      return { vehicle, used: used + 1, available: company.parkingAllocation - used - 1 };
    });
    revalidatePath("/account");
    return NextResponse.json({ ok: true, message: `Vehicle registered successfully. ${result.available} company parking spaces remain.`, vehicle: result.vehicle }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: false, message: "This plate number is already registered for the company." }, { status: 409 });
    }
    console.error("CREATE_VEHICLE_FAILED");
    return NextResponse.json({ ok: false, message: "Unable to register vehicle." }, { status: 500 });
  }
}
