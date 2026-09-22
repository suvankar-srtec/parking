import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { lockBuildingParking, ParkingError } from "@/lib/building-parking";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getCurrentUser();

  if (!user || user.role !== "BUILDING_ADMIN" || !user.buildingId) {
    return NextResponse.json(
      { ok: false, message: "Only the Building Admin can change company status." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ ok: false, message: "Choose Enable or Disable." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.findFirst({
        where: { id, buildingId: user.buildingId },
        select: {
          id: true,
          name: true,
          enabled: true,
          buildingId: true,
          parkingAllocation: true,
          ownerParkingAllocation: true,
          employeeParkingAllocation: true,
          _count: { select: { vehicles: true } },
        },
      });

      if (!company) throw new ParkingError("Company not found in your building.", 404);
      if (company.enabled === body.enabled) {
        return {
          companyName: company.name,
          enabled: company.enabled,
          released: 0,
          allocated: company.parkingAllocation,
        };
      }

      const building = await lockBuildingParking(tx, company.buildingId);

      if (!body.enabled) {
        const vehiclesInside = await tx.vehicle.count({
          where: { companyId: company.id, isInside: true },
        });
        if (vehiclesInside > 0) {
          throw new ParkingError("Vehicle already in parking. Wait until exit.");
        }

        const released = company.parkingAllocation;

        await tx.building.update({
          where: { id: company.buildingId },
          data: {
            ownerParking: { increment: released },
            companyParking: { decrement: released },
          },
        });

        await tx.company.update({
          where: { id: company.id },
          data: {
            enabled: false,
            parkingAllocation: 0,
            ownerParkingAllocation: 0,
            employeeParkingAllocation: 0,
          },
        });

        return {
          companyName: company.name,
          enabled: false,
          released,
          allocated: 0,
        };
      }

      const name = String(body?.name ?? "").trim();
      const parkingAllocation = Number(body?.parkingAllocation);

      if (!name) throw new ParkingError("Company name is required to enable this company.");
      if (!Number.isInteger(parkingAllocation) || parkingAllocation < 1) {
        throw new ParkingError("Enter a parking allocation of at least 1 space.");
      }

      const liveBuilding = await tx.building.findUnique({
        where: { id: company.buildingId },
        select: {
          ownerParking: true,
          ownerVehicles: { select: { id: true } },
        },
      });
      if (!liveBuilding) throw new ParkingError("Building not found.", 404);

      const reservedOwnerSpaces = liveBuilding.ownerVehicles.length;
      const transferableOwnerSpaces = Math.max(liveBuilding.ownerParking - reservedOwnerSpaces, 0);

      if (parkingAllocation > transferableOwnerSpaces) {
        throw new ParkingError(
          `Only ${transferableOwnerSpaces} Owner Parking space${transferableOwnerSpaces === 1 ? "" : "s"} can be reassigned to this company.`,
        );
      }

      if (parkingAllocation < company._count.vehicles) {
        throw new ParkingError(
          `This company already has ${company._count.vehicles} registered vehicle${company._count.vehicles === 1 ? "" : "s"}. Allocate at least ${company._count.vehicles} parking space${company._count.vehicles === 1 ? "" : "s"}.`,
        );
      }

      const duplicate = await tx.company.findFirst({
        where: {
          buildingId: company.buildingId,
          name: { equals: name, mode: "insensitive" },
          NOT: { id: company.id },
        },
        select: { id: true },
      });
      if (duplicate) throw new ParkingError("A company with this name already exists in this building.");

      await tx.building.update({
        where: { id: company.buildingId },
        data: {
          ownerParking: { decrement: parkingAllocation },
          companyParking: { increment: parkingAllocation },
        },
      });

      await tx.company.update({
        where: { id: company.id },
        data: {
          name,
          enabled: true,
          parkingAllocation,
          ownerParkingAllocation: 0,
          employeeParkingAllocation: parkingAllocation,
        },
      });

      return {
        companyName: name,
        enabled: true,
        released: 0,
        allocated: parkingAllocation,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 10000,
      timeout: 15000,
    });

    revalidatePath("/dashboard");
    revalidatePath("/access-control/register-cards", "layout");

    return NextResponse.json({
      ok: true,
      message: result.enabled
        ? `${result.companyName} enabled with ${result.allocated} parking space${result.allocated === 1 ? "" : "s"}.`
        : `${result.companyName} disabled. ${result.released} parking space${result.released === 1 ? "" : "s"} moved to Owner Parking.`,
    });
  } catch (error) {
    console.error("UPDATE_COMPANY_STATUS_FAILED", error);

    if (error instanceof ParkingError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { ok: false, message: "A company with this name already exists in this building." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { ok: false, message: "Unable to update company status." },
      { status: 500 },
    );
  }
}
