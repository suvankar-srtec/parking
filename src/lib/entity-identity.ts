export type EntityKind = "building" | "company" | "employee";

export function normalizeEntityName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function userIdCode(kind: EntityKind) {
  if (kind === "building") return "BLD";
  if (kind === "company") return "COMP";
  return "EMP";
}

export function canCreateEntity(
  user: { role: string; buildingId: string | null; companyId: string | null } | null,
  kind: EntityKind,
  scopeId: string,
) {
  if (!user) return false;
  if (kind === "building") return user.role === "SUPER_ADMIN" && scopeId === "";
  if (kind === "company") return user.role === "BUILDING_ADMIN" && !!scopeId && user.buildingId === scopeId;
  return user.role === "COMPANY_ADMIN" && !!scopeId && user.companyId === scopeId;
}
