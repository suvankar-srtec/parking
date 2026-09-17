import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { ParkingError } from "@/lib/building-parking";
import { lockRfid, RFID_TRANSACTION } from "@/lib/rfid-access";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; vehicleId: string }> },
) {
  try {
    const { id: buildingId, vehicleId } = await context.params;
    const user = await getCurrentUser();
    if (!user || user.role !== "BUILDING_ADMIN" || user.buildingId !== buildingId) {
      return NextResponse.json({ ok: false, message: "Only this building's Admin can remove Owner Parking allocations." }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await lockRfid(tx);
      const vehicle = await tx.buildingOwnerVehicle.findFirst({
        where: { id: vehicleId, buildingId },
        select: { id: true, plateNumber: true, isInside: true },
      });
      if (!vehicle) throw new ParkingError("Owner Parking allocation not found.", 404);
      if (vehicle.isInside) {
        throw new ParkingError("This vehicle is currently inside. Record its exit before removing the allocation.", 409);
      }

      await tx.rfidEnrollment.updateMany({
        where: { buildingId, ownerParking: true, status: { in: ["WAITING", "CAPTURED"] } },
        data: { status: "CANCELLED" },
      });
      await tx.buildingOwnerVehicle.delete({ where: { id: vehicleId } });
    }, RFID_TRANSACTION);

    revalidatePath("/dashboard");
    return NextResponse.json({ ok: true, message: "Owner Parking allocation removed. The RFID card is available for reuse." });
  } catch (error) {
    if (error instanceof ParkingError) return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    console.error("REMOVE_OWNER_PARKING_ALLOCATION_FAILED", error);
    return NextResponse.json({ ok: false, message: "Unable to remove Owner Parking allocation." }, { status: 500 });
  }
}
