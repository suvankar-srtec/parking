import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rfidUser, rfidApiError, lockRfid, expireEnrollments, RFID_TRANSACTION } from "@/lib/rfid-access";
import { ParkingError } from "@/lib/building-parking";

function canManageCompany(user: { role: string; buildingId: string | null; companyId: string | null }, companyId: string, buildingId: string) {
  if (user.role === "SUPER_ADMIN") return true;
  if (user.role === "BUILDING_ADMIN") return user.buildingId === buildingId;
  return user.role === "COMPANY_ADMIN" && user.companyId === companyId;
}

export async function POST(request: Request) {
  try {
    const user = await rfidUser();
    const body = await request.json().catch(() => null);
    const readerId = String(body?.readerId ?? "");
    const employeeId = String(body?.employeeId ?? "");
    const vehicleId = typeof body?.vehicleId === "string" ? body.vehicleId : null;
    const enrollment = await prisma.$transaction(async (tx) => {
      await lockRfid(tx);
      await expireEnrollments(tx);
      const employee = await tx.employee.findUnique({ where: { id: employeeId }, include: { company: { select: { id: true, buildingId: true } } } });
      if (!employee) throw new ParkingError("Employee or company owner not found.", 404);
      if (!canManageCompany(user, employee.companyId, employee.company.buildingId)) throw new ParkingError("You cannot register cards for this company.", 403);
      const reader = await tx.rfidReader.findUnique({ where: { id: readerId } });
      if (!reader || reader.buildingId !== employee.company.buildingId || !reader.enabled || reader.mode !== "REGISTER") throw new ParkingError("Select an enabled registration reader for this building.");
      if (vehicleId) {
        const vehicle = await tx.vehicle.findFirst({ where: { id: vehicleId, employeeId, companyId: employee.companyId } });
        if (!vehicle) throw new ParkingError("Vehicle not found.", 404);
        if (vehicle.isInside) throw new ParkingError("Record the vehicle's exit before replacing its card.", 409);
      }
      if (await tx.rfidEnrollment.findFirst({ where: { readerId, status: { in: ["WAITING", "CAPTURED"] } } })) throw new ParkingError("This reader is already registering a card. Finish or cancel that registration first.", 409);
      return tx.rfidEnrollment.create({ data: { readerId, employeeId, vehicleId, ownerId: user.id, companyId: employee.companyId, expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
    }, RFID_TRANSACTION);
    return NextResponse.json({ ok: true, enrollment, message: "Reader ready. Present the new card." }, { status: 201 });
  } catch (error) { return rfidApiError(error); }
}
