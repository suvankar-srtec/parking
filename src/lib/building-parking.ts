import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ParkingValues } from "@/lib/parking";

export class ParkingError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// Both parking edits and company creation take this lock before checking allocations.
export async function lockBuildingParking(tx: Prisma.TransactionClient, buildingId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string; companyParking: number }>>`
    SELECT "id", "companyParking" FROM "buildings" WHERE "id" = ${buildingId} FOR UPDATE
  `;
  if (!rows[0]) throw new ParkingError("Building not found.", 404);
  return rows[0];
}

export async function updateBuildingParking(buildingId: string, values: ParkingValues) {
  return prisma.$transaction(async (tx) => {
    await lockBuildingParking(tx, buildingId);
    const allocation = await tx.company.aggregate({
      where: { buildingId },
      _sum: { parkingAllocation: true },
    });
    const assigned = allocation._sum.parkingAllocation ?? 0;
    if (values.companyParking < assigned) {
      throw new ParkingError(`${assigned} spaces are already allocated to companies. Company parking cannot be lower than ${assigned}.`);
    }
    return tx.building.update({
      where: { id: buildingId },
      data: values,
      select: { id: true, totalParking: true, ownerParking: true, companyParking: true },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10000, timeout: 15000 });
}
