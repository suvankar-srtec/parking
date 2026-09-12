import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SignOutButton from "@/components/SignOutButton";
import ReportsDashboard from "@/components/ReportsDashboard";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { roleLabel } from "@/lib/roles";
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

  const buildingWhere = primarySuperAdmin
    ? undefined
    : scopedSuperAdmin
      ? { superAdminId: user.id }
      : user.buildingId
        ? { id: user.buildingId }
        : { id: "__no_scope__" };

  const [events, buildings] = await Promise.all([
    prisma.rfidEvent.findMany({
      where: eventWhere,
      orderBy: { createdAt: "asc" },
      take: 5000,
      include: {
        building: { select: { id: true, name: true } },
        company: { select: { id: true, name: true, buildingId: true } },
        vehicle: {
          select: {
            id: true,
            plateNumber: true,
            ownerName: true,
            department: true,
            employee: { select: { name: true } },
          },
        },
      },
    }),
    prisma.building.findMany({
      where: buildingWhere,
      orderBy: { name: "asc" },
      include: {
        companies: {
          where: companyScoped && user.companyId ? { id: user.companyId } : undefined,
          orderBy: { name: "asc" },
          select: { id: true, name: true, buildingId: true },
        },
      },
    }),
  ]);

  const openEntries = new Map<string, (typeof events)[number]>();
  const rows: Array<{
    id: string;
    buildingId: string | null;
    buildingName: string;
    companyId: string | null;
    companyName: string;
    vehicleNumber: string;
    rfidUid: string;
    driver: string;
    department: string;
    inTime: string;
    outTime: string | null;
    parkedFor: string;
    status: "Inside" | "Exited";
  }> = [];

  for (const event of events) {
    const key = event.vehicleId || event.cardNo;
    if (event.action === "ENTRY") {
      openEntries.set(key, event);
      continue;
    }
    if (event.action !== "EXIT") continue;
    const entry = openEntries.get(key);
    if (!entry) continue;
    openEntries.delete(key);
    const vehicle = entry.vehicle || event.vehicle;
    const building = entry.building || event.building;
    const company = entry.company || event.company;
    rows.push({
      id: `${entry.id}-${event.id}`,
      buildingId: entry.buildingId || event.buildingId,
      buildingName: building?.name || "-",
      companyId: entry.companyId || event.companyId,
      companyName: company?.name || "Building owner",
      vehicleNumber: vehicle?.plateNumber || "-",
      rfidUid: entry.cardNo,
      driver: vehicle?.employee?.name || vehicle?.ownerName || "-",
      department: vehicle?.department || "-",
      inTime: entry.createdAt.toISOString(),
      outTime: event.createdAt.toISOString(),
      parkedFor: parkedFor(entry.createdAt, event.createdAt),
      status: "Exited",
    });
  }

  for (const entry of openEntries.values()) {
    const vehicle = entry.vehicle;
    rows.push({
      id: `${entry.id}-inside`,
      buildingId: entry.buildingId,
      buildingName: entry.building?.name || "-",
      companyId: entry.companyId,
      companyName: entry.company?.name || "Building owner",
      vehicleNumber: vehicle?.plateNumber || "-",
      rfidUid: entry.cardNo,
      driver: vehicle?.employee?.name || vehicle?.ownerName || "-",
      department: vehicle?.department || "-",
      inTime: entry.createdAt.toISOString(),
      outTime: null,
      parkedFor: parkedFor(entry.createdAt, null),
      status: "Inside",
    });
  }

  rows.sort((a, b) => new Date(b.inTime).getTime() - new Date(a.inTime).getTime());

  const buildingOptions = buildings.map((building) => ({ id: building.id, name: building.name }));
  const companyOptions = buildings.flatMap((building) => building.companies.map((company) => ({
    id: company.id,
    name: company.name,
    buildingId: company.buildingId,
  })));

  return <main className="dashboard-page">
    <Sidebar role={user.role} canCreateSuperAdmins={primarySuperAdmin} />
    <section className="dashboard-main">
      <header className="topbar">
        <div><div className="section-kicker">{roleLabel(user.role).toUpperCase()}</div><h1>Parking reports</h1></div>
        <div className="topbar-right">
          <div className="summary-card"><span>User ID</span><strong>{user.userId}</strong></div>
          <SignOutButton />
        </div>
      </header>
      <ReportsDashboard role={user.role} rows={rows} buildings={buildingOptions} companies={companyOptions} />
    </section>
  </main>;
}
