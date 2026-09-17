import type { UserRole } from "@prisma/client";

export const PERMISSION_KEYS = [
  "building.createCompanies",
  "building.allocateCompanyParking",
  "building.manageOwnerParking",
  "building.registerOwnerParking",
  "building.configureReaders",
  "building.manageSupervisor",
  "building.viewReports",
  "company.managePeople",
  "company.allocateEmployeeParking",
  "company.manageVehicles",
  "company.registerRfid",
  "company.viewUsage",
  "company.viewReports",
  "supervisor.totalOnSite",
  "supervisor.totalIn",
  "supervisor.totalOut",
  "supervisor.liveDashboard",
  "supervisor.activity",
  "supervisor.employeeParking",
  "supervisor.readerStatus",
  "supervisor.viewReports",
] as const;

export type PermissionKey = typeof PERMISSION_KEYS[number];

export type PermissionOption = {
  key: PermissionKey;
  label: string;
  description: string;
};

const BUILDING_ADMIN_PERMISSIONS: PermissionOption[] = [
  { key: "building.createCompanies", label: "Create companies", description: "Create companies inside this building only." },
  { key: "building.allocateCompanyParking", label: "Allocate company parking", description: "Set parking allocation while creating companies." },
  { key: "building.manageOwnerParking", label: "Manage Owner Parking", description: "View and remove Owner Parking allocations." },
  { key: "building.registerOwnerParking", label: "Register Owner Parking", description: "Add Owner Parking vehicles and register RFID cards." },
  { key: "building.configureReaders", label: "Add / configure readers", description: "Add and configure readers for this building only." },
  { key: "building.manageSupervisor", label: "Manage Supervisor", description: "Create or update the building Supervisor account." },
  { key: "building.viewReports", label: "Building reports", description: "View parking reports for this building." },
];

const COMPANY_PERMISSIONS: PermissionOption[] = [
  { key: "company.managePeople", label: "Manage people", description: "Add and edit Employees and Company Owners." },
  { key: "company.allocateEmployeeParking", label: "Allocate employee parking", description: "Assign parking limits within the company allocation." },
  { key: "company.manageVehicles", label: "Add / remove vehicles", description: "Register and remove vehicles for company people." },
  { key: "company.registerRfid", label: "Register RFID cards", description: "Use a registration reader to assign RFID cards to vehicles." },
  { key: "company.viewUsage", label: "Company parking usage", description: "View company limits, assignments and registered vehicle usage." },
  { key: "company.viewReports", label: "Company reports", description: "View reports for this company only." },
];

const SUPERVISOR_PERMISSIONS: PermissionOption[] = [
  { key: "supervisor.totalOnSite", label: "Total On Site", description: "See the current number of vehicles inside." },
  { key: "supervisor.totalIn", label: "Total IN", description: "See today's successful entry count." },
  { key: "supervisor.totalOut", label: "Total OUT", description: "See today's successful exit count." },
  { key: "supervisor.liveDashboard", label: "Live Dashboard", description: "Open the live RFID monitoring dashboard." },
  { key: "supervisor.activity", label: "ENTRY / EXIT / IGNORED activity", description: "See live and historical RFID activity rows." },
  { key: "supervisor.employeeParking", label: "Employee Parking Allocation", description: "See employee parking spaces allotted by companies and vehicles inside." },
  { key: "supervisor.readerStatus", label: "Allotted Reader status", description: "See readers allotted to the building and their status." },
  { key: "supervisor.viewReports", label: "Building reports", description: "View reports for the assigned building." },
];

export function permissionOptionsForRole(role: UserRole): PermissionOption[] {
  if (role === "BUILDING_ADMIN") return BUILDING_ADMIN_PERMISSIONS;
  if (role === "COMPANY_ADMIN" || role === "BUILDING_OWNER") return COMPANY_PERMISSIONS;
  if (role === "EMPLOYEE") return SUPERVISOR_PERMISSIONS;
  return [];
}

export function defaultPermissionsForRole(role: UserRole): PermissionKey[] {
  return permissionOptionsForRole(role).map((option) => option.key);
}

export function sanitizePermissions(role: UserRole, value: unknown): PermissionKey[] {
  const allowed = new Set(permissionOptionsForRole(role).map((option) => option.key));
  if (!Array.isArray(value)) return defaultPermissionsForRole(role);
  return Array.from(new Set(value.map(String).filter((item): item is PermissionKey => allowed.has(item as PermissionKey))));
}

type PermissionUser = {
  role: UserRole;
  permissions?: string[] | null;
  permissionsCustomized?: boolean | null;
};

export function effectivePermissions(user: PermissionUser): PermissionKey[] {
  if (user.role === "SUPER_ADMIN") return [...PERMISSION_KEYS];
  if (!user.permissionsCustomized) return defaultPermissionsForRole(user.role);
  return sanitizePermissions(user.role, user.permissions ?? []);
}

export function hasPermission(user: PermissionUser, permission: PermissionKey) {
  if (user.role === "SUPER_ADMIN") return true;
  return effectivePermissions(user).includes(permission);
}
