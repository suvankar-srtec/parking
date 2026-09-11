import type { UserRole } from "@prisma/client";

const DEFAULT_PRIMARY_SUPER_ADMIN_USER_ID = "sa01";

export function primarySuperAdminUserId() {
  return String(process.env.PRIMARY_SUPER_ADMIN_USER_ID || DEFAULT_PRIMARY_SUPER_ADMIN_USER_ID).trim();
}

export function isPrimarySuperAdmin(user: { role: UserRole; userId: string }) {
  return user.role === "SUPER_ADMIN" && user.userId === primarySuperAdminUserId();
}

export function isScopedSuperAdmin(user: { role: UserRole; userId: string }) {
  return user.role === "SUPER_ADMIN" && !isPrimarySuperAdmin(user);
}
