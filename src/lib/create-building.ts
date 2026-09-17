import { prisma } from "@/lib/prisma";
import type { ParkingValues } from "@/lib/parking";
import { sanitizePermissions, type PermissionKey } from "@/lib/permissions";
import { claimUserId } from "@/lib/user-id-reservations";

export async function createBuildingWithAccount(
  input: ParkingValues & {
    name: string;
    username: string;
    password: string;
    maximumGate: number;
    ownerId: string;
    reservationId: string;
    permissions?: PermissionKey[];
  },
) {
  const { username, password, ownerId, reservationId, permissions, ...buildingValues } = input;
  return prisma.$transaction(async (tx) => {
    const userId = await claimUserId(tx, { ownerId, reservationId, kind: "building", scopeId: "", name: input.name });
    const building = await tx.building.create({ data: { ...buildingValues, superAdminId: ownerId } });
    await tx.gate.create({ data: { buildingId: building.id, gateNumber: 1, direction: "SELECT" } });
    const account = await tx.user.create({
      data: {
        userId,
        username,
        password,
        role: "BUILDING_ADMIN",
        buildingId: building.id,
        permissions: sanitizePermissions("BUILDING_ADMIN", permissions),
        permissionsCustomized: true,
      },
      select: { userId: true, username: true },
    });
    await tx.entityIdentity.create({ data: { entityType: "building", entityId: building.id, userId } });
    return { building, account };
  }, { maxWait: 10000, timeout: 15000 });
}
