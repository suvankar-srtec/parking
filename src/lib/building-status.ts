import type { User } from "@prisma/client";
import { prisma } from "./prisma";

export const BUILDING_DISABLED_MESSAGE = "This building is disabled. Contact your Super Admin.";
export const COMPANY_DISABLED_MESSAGE = "This company is disabled. Contact your Building Admin.";

export async function accountAccessStatus(user: Pick<User, "role" | "buildingId" | "companyId">) {
  if (user.role === "SUPER_ADMIN") return { active: true, message: "" };

  if (user.buildingId) {
    const building = await prisma.building.findUnique({
      where: { id: user.buildingId },
      select: { enabled: true },
    });
    if (building && !building.enabled) return { active: false, message: BUILDING_DISABLED_MESSAGE };
  }

  if (user.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { enabled: true, building: { select: { enabled: true } } },
    });
    if (company) {
      if (!company.building.enabled) return { active: false, message: BUILDING_DISABLED_MESSAGE };
      if (!company.enabled) return { active: false, message: COMPANY_DISABLED_MESSAGE };
    }
  }

  return { active: true, message: "" };
}

export async function hasActiveBuilding(user: Pick<User, "role" | "buildingId" | "companyId">) {
  return (await accountAccessStatus(user)).active;
}
