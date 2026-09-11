import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { rfidUser, rfidApiError, lockRfid, consumeCardEnrollment, RFID_TRANSACTION } from "@/lib/rfid-access";
import { lockBuildingParking, ParkingError } from "@/lib/building-parking";

function canManageCompany(user: { role: string; buildingId: string | null; companyId: string | null }, companyId: string, buildingId: string) {
  if (user.role === "SUPER_ADMIN") return true;
  if (user.role === "BUILDING_ADMIN") return user.buildingId === buildingId;
  return user.role === "COMPANY_ADMIN" && user.companyId === companyId;
}

export async function POST(request: Request) {
  try {
    const user = await rfidUser();
    const body = await request.json().catch(() => null);
    const vehicleId = String(body?.vehicleId ?? "");
    const enrollmentId = String(body?.enrollmentId ?? "");
    await prisma.$transaction(async (tx) => {
      await lockRfid(tx);
      const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId }, include: { company: { select: { id: true, buildingId: true } } } });
      if (!vehicle) throw new ParkingError("Vehicle not found.", 404);
      if (!canManageCompany(user, vehicle.companyId, vehicle.company.buildingId)) throw new ParkingError("You cannot register cards for this company.", 403);
      await lockBuildingParking(tx, vehicle.company.buildingId);
      if (vehicle.isInside) throw new ParkingError("Record the vehicle's exit before replacing its card.", 409);
      const enrollment = await consumeCardEnrollment(tx, { enrollmentId, vehicleId, employeeId: vehicle.employeeId, companyId: vehicle.companyId, ownerId: user.id, buildingId: vehicle.company.buildingId });
      await tx.vehicle.update({ where: { id: vehicleId }, data: { rfidCardNo: enrollment.cardNo } });
      await tx.rfidEvent.create({ data: { readerId: enrollment.readerId, buildingId: vehicle.company.buildingId, companyId: vehicle.companyId, vehicleId, deviceNumber: enrollment.reader.deviceNumber, cardNo: enrollment.cardNo!, action: "REGISTER", code: "0000", message: "Card registered to vehicle." } });
    }, RFID_TRANSACTION);
    revalidatePath("/dashboard");
    revalidatePath("/access-control/register-cards");
    return NextResponse.json({ ok: true, message: "RFID card registered successfully." });
  } catch (error) { return rfidApiError(error); }
}
