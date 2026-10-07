import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SignOutButton from "@/components/SignOutButton";
import SupervisorManager from "@/components/SupervisorManager";
import { prisma } from "@/lib/prisma";
import { effectivePermissions, hasPermission } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";

export default async function SupervisorManagementPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "BUILDING_ADMIN" || !user.buildingId) redirect("/dashboard");
  if (!hasPermission(user, "building.manageSupervisor")) redirect("/dashboard");

  const [building, supervisor] = await Promise.all([
    prisma.building.findUnique({
      where: { id: user.buildingId },
      select: { id: true, name: true },
    }),
    prisma.user.findFirst({
      where: { role: "EMPLOYEE", buildingId: user.buildingId, companyId: null },
      select: { userId: true, permissions: true, permissionsCustomized: true },
    }),
  ]);
  if (!building) redirect("/dashboard");

  const supervisorPermissions = supervisor
    ? effectivePermissions({
        role: "EMPLOYEE",
        permissions: supervisor.permissions,
        permissionsCustomized: supervisor.permissionsCustomized,
      })
    : undefined;

  return <main className="dashboard-page">
    <Sidebar role={user.role} permissions={effectivePermissions(user)} />
    <section className="dashboard-main">
      <header className="topbar">
        <div><h1>Supervisor</h1></div>
        <SignOutButton />
      </header>
      <section className="portfolio-card building-management">
        <div className="portfolio-header">
          <div><h2>Supervisor account</h2></div>
          <SupervisorManager
            buildingId={building.id}
            buildingName={building.name}
            currentUserId={supervisor?.userId}
            currentPermissions={supervisorPermissions}
          />
        </div>
      </section>
    </section>
  </main>;
}
