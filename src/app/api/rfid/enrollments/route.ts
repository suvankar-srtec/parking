import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rfidUser, rfidApiError, lockRfid, expireEnrollments, RFID_TRANSACTION } from "@/lib/rfid-access";
import { ParkingError } from "@/lib/building-parking";
export async function POST(request: Request) {
  try {
    const user = await rfidUser();
    if (user.role !== "COMPANY_ADMIN" || !user.companyId) throw new ParkingError("Only the company administrator can register cards.", 403);
    const body = await request.json().catch(() => null);
    const readerId = String(body?.readerId ?? "");
    const employeeId = String(body?.employeeId ?? "");
    const vehicleId = typeof body?.vehicleId === "string" ? body.vehicleId : null;
    const enrollment = await prisma.$transaction(async (tx) => {
      await lockRfid(tx);
      await expireEnrollments(tx);
      const employee = await tx.employee.findFirst({ where: { id: employeeId, companyId: user.companyId! }, include: { company: { select: { buildingId: true } } } });
      if (!employee) throw new ParkingError("Employee not found in this company.", 404);
      const reader = await tx.rfidReader.findUnique({ where: { id: readerId } });
      if (!reader || reader.buildingId !== employee.company.buildingId || !reader.enabled || reader.mode !== "REGISTER") throw new ParkingError("Select an enabled registration reader for this building.");
      if (vehicleId) {
        const vehicle = await tx.vehicle.findFirst({ where: { id: vehicleId, employeeId, companyId: user.companyId! } });
        if (!vehicle) throw new ParkingError("Vehicle not found.", 404);
        if (vehicle.isInside) throw new ParkingError("Record the vehicle's exit before replacing its card.", 409);
      }
      if (await tx.rfidEnrollment.findFirst({ where: { readerId, status: { in: ["WAITING", "CAPTURED"] } } })) throw new ParkingError("This reader is already registering a card. Finish or cancel that registration first.", 409);
      return tx.rfidEnrollment.create({ data: { readerId, employeeId, vehicleId, ownerId: user.id, companyId: user.companyId!, expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
    }, RFID_TRANSACTION);
    return NextResponse.json({ ok: true, enrollment, message: "Reader ready. Present the new card." }, { status: 201 });
  } catch (error) { return rfidApiError(error); }
}
