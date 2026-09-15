import type { User } from "@prisma/client";
import { prisma } from "./prisma";

export const BUILDING_DISABLED_MESSAGE = "This building is disabled. Contact your Super Admin.";

export async function hasActiveBuilding(user: Pick<User, "role" | "buildingId" | "companyId">) {
  if (user.role === "SUPER_ADMIN") return true;
  const scopes = [
    ...(user.buildingId ? [{ id: user.buildingId }] : []),
    ...(user.companyId ? [{ companies: { some: { id: user.companyId } } }] : []),
  ];
  if (scopes.length === 0) return true;
  const disabled = await prisma.building.findFirst({ where: { enabled: false, OR: scopes }, select: { id: true } });
  return !disabled;
}
