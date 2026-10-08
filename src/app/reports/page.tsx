import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SignOutButton from "@/components/SignOutButton";
import ReportsDashboard from "@/components/ReportsDashboard";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { roleLabel } from "@/lib/roles";
import { effectivePermissions, hasPermission } from "@/lib/permissions";
import { isPrimarySuperAdmin, isScopedSuperAdmin } from "@/lib/super-admin-scope";

function parkedFor(from: Date, to: Date | null) {
  const milliseconds = Math.max((to ?? new Date()).getTime() - from.getTime(), 0);
  const totalMinutes = Math.floor(milliseconds / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days) return `${days}d ${hours}h ${minutes}m`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const canViewReports = user.role === "SUPER_ADMIN" ||
    (user.role === "BUILDING_ADMIN" && hasPermission(user, "building.viewReports")) ||
    ((user.role === "COMPANY_ADMIN" || user.role === "BUILDING_OWNER") && hasPermission(user, "company.viewReports")) ||
    (user.role === "EMPLOYEE" && hasPermission(user, "supervisor.viewReports"));
  if (!canViewReports) redirect("/dashboard");

  const permissions = effectivePermissions(user);
  const primarySuperAdmin = isPrimarySuperAdmin(user);
  const scopedSuperAdmin = isScopedSuperAdmin(user);
  const companyScoped = user.role === "COMPANY_ADMIN" || user.role === "BUILDING_OWNER";

  const eventWhere = primarySuperAdmin
    ? { action: { in: ["ENTRY", "EXIT"] } }
    : scopedSuperAdmin
      ? { building: { superAdminId: user.id }, action: { in: ["ENTRY", "EXIT"] } }
      : companyScoped && user.companyId
        ? { companyId: user.companyId, action: { in: ["ENTRY", "EXIT"] } }
        : user.buildingId
          ? { buildingId: user.buildingId, action: { in: ["ENTRY", "EXIT"] } }
          : { id: "__no_scope__", action: { in: ["ENTRY", "EXIT"] } };

  const buildingWhere = primarySuperAdmin ? undefined : scopedSuperAdmin ? { superAdminId: user.id } : user.buildingId ? { id: user.buildingId } : { id: "__no_scope__" };

  const [events, buildings] = await Promise.all([
    prisma.rfidEvent.findMany({
      where: eventWhere,
      orderBy: { createdAt: "asc" },
      take: 5000,
      include: {
        building: { select: { id: true, name: true } },
        company: { select: { id: true, name: true, buildingId: true } },
        vehicle: { select: { id: true, plateNumber: true, ownerName: true, department: true, employee: { select: { name: true } } } },
        ownerVehicle: { select: { id: true, plateNumber: true, ownerName: true } },
        visitor: { select: { id: true, name: true, vehicleNumber: true, accessory: true } },
      },
    }),
    prisma.building.findMany({
      where: buildingWhere,
      orderBy: { name: "asc" },
      include: { companies: { where: companyScoped && user.companyId ? { id: user.companyId } : undefined, orderBy: { name: "asc" }, select: { id: true, name: true, buildingId: true } } },
    }),
  ]);

  const openEntries = new Map<string, (typeof events)[number]>();
  const rows: Array<{ id: string; entityKey: string; buildingId: string | null; buildingName: string; companyId: string | null; companyName: string; accessType: "Vehicle" | "Visitor"; vehicleNumber: string; rfidUid: string; rider: string; department: string; accessory: string; inTime: string; outTime: string | null; exitType: string; parkedFor: string; status: "Inside" | "Exited" }> = [];

  function eventKey(event: (typeof events)[number]) {
    if (event.visitorId) return `visitor:${event.visitorId}`;
    if (event.ownerVehicleId) return `owner:${event.ownerVehicleId}`;
    if (event.vehicleId) return `company:${event.vehicleId}`;
    return `card:${event.cardNo}`;
  }

  function reportVehicle(entry: (typeof events)[number], exit?: (typeof events)[number]) {
    const visitor = entry.visitor || exit?.visitor;
    const vehicle = entry.vehicle || exit?.vehicle;
    const ownerVehicle = entry.ownerVehicle || exit?.ownerVehicle;
    if (visitor) return { accessType: "Visitor" as const, vehicleNumber: visitor.vehicleNumber || "-", rider: visitor.name || "-", department: "-", accessory: visitor.accessory || "-" };
    if (ownerVehicle) return { accessType: "Vehicle" as const, vehicleNumber: ownerVehicle.plateNumber || "-", rider: ownerVehicle.ownerName || "-", department: "-", accessory: "-" };
    return { accessType: "Vehicle" as const, vehicleNumber: vehicle?.plateNumber || "-", rider: vehicle?.employee?.name || vehicle?.ownerName || "-", department: vehicle?.department || "-", accessory: "-" };
  }

  for (const event of events) {
    const key = eventKey(event);
    if (event.action === "ENTRY") { openEntries.set(key, event); continue; }
    if (event.action !== "EXIT") continue;
    const entry = openEntries.get(key);
    if (!entry) continue;
    openEntries.delete(key);
    const building = entry.building || event.building;
    const company = entry.company || event.company;
    const report = reportVehicle(entry, event);
    rows.push({ id: `${entry.id}-${event.id}`, entityKey: key, buildingId: entry.buildingId || event.buildingId, buildingName: building?.name || "-", companyId: entry.companyId || event.companyId, companyName: company?.name || (report.accessType === "Visitor" ? "Building visitor" : "Building owner"), accessType: report.accessType, vehicleNumber: report.vehicleNumber, rfidUid: report.accessType === "Visitor" ? "Visitor QR" : entry.cardNo, rider: report.rider, department: report.department, accessory: report.accessory, inTime: entry.createdAt.toISOString(), outTime: event.createdAt.toISOString(), exitType: event.deviceNumber === "MANUAL" ? event.message || "Manual exit" : "Reader exit", parkedFor: parkedFor(entry.createdAt, event.createdAt), status: "Exited" });
  }

  for (const entry of openEntries.values()) {
    const report = reportVehicle(entry);
    rows.push({ id: `${entry.id}-inside`, entityKey: eventKey(entry), buildingId: entry.buildingId, buildingName: entry.building?.name || "-", companyId: entry.companyId, companyName: entry.company?.name || (report.accessType === "Visitor" ? "Building visitor" : "Building owner"), accessType: report.accessType, vehicleNumber: report.vehicleNumber, rfidUid: report.accessType === "Visitor" ? "Visitor QR" : entry.cardNo, rider: report.rider, department: report.department, accessory: report.accessory, inTime: entry.createdAt.toISOString(), outTime: null, exitType: "-", parkedFor: parkedFor(entry.createdAt, null), status: "Inside" });
  }

  rows.sort((a, b) => new Date(b.inTime).getTime() - new Date(a.inTime).getTime());
  const buildingOptions = buildings.map((building) => ({ id: building.id, name: building.name }));
  const companyOptions = buildings.flatMap((building) => building.companies.map((company) => ({ id: company.id, name: company.name, buildingId: company.buildingId })));

  return <main className="dashboard-page">
    <Sidebar role={user.role} permissions={permissions} canCreateSuperAdmins={primarySuperAdmin} />
    <section className="dashboard-main">
      <header className="topbar"><div><div className="section-kicker">{roleLabel(user.role).toUpperCase()}</div><h1>Parking reports</h1></div><div className="topbar-right"><div className="summary-card"><span>User ID</span><strong>{user.userId}</strong></div><SignOutButton /></div></header>
      <ReportsDashboard role={user.role} rows={rows} buildings={buildingOptions} companies={companyOptions} />
    </section>
  </main>;
}
