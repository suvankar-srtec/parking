import { prisma } from "@/lib/prisma";
import type { ParkingValues } from "@/lib/parking";
import { claimUserId } from "@/lib/user-id-reservations";

export async function createBuildingWithAccount(
  input: ParkingValues & { name: string; username: string; password: string; ownerId: string; reservationId: string },
) {
  const { username, password, ownerId, reservationId, ...buildingValues } = input;
  return prisma.$transaction(async (tx) => {
    const userId = await claimUserId(tx, { ownerId, reservationId, kind: "building", scopeId: "", name: input.name });
    const building = await tx.building.create({ data: buildingValues });
    const account = await tx.user.create({
      data: { userId, username, password, role: "BUILDING_ADMIN", buildingId: building.id },
      select: { userId: true, username: true },
    });
    await tx.entityIdentity.create({ data: { entityType: "building", entityId: building.id, userId } });
    return { building, account };
  }, { maxWait: 10000, timeout: 15000 });
}
