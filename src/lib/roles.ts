import type { UserRole } from "@prisma/client";

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  BUILDING_OWNER: "Company Owner",
  BUILDING_ADMIN: "Admin",
  COMPANY_ADMIN: "Company / User",
  EMPLOYEE: "Supervisor",
};

export function roleLabel(role: UserRole) {
  return ROLE_LABELS[role] ?? role.replaceAll("_", " ");
}

export function dashboardLabel(role: UserRole) {
  if (role === "SUPER_ADMIN") return "Buildings";
  if (role === "BUILDING_ADMIN") return "My building";
  if (role === "COMPANY_ADMIN" || role === "BUILDING_OWNER") return "My company";
  return "Live Dashboard";
}

export function canConfigureReaders(role: UserRole) {
  return role === "SUPER_ADMIN" || role === "BUILDING_ADMIN";
}
