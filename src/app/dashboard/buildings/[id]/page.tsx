import SignOutButton from "@/components/SignOutButton";
import Link from "@/components/AppLink";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/session";
import { isPrimarySuperAdmin as hasPrimaryAccess } from "@/lib/super-admin-scope";
import Sidebar from "@/components/Sidebar";
import CompanyList from "@/components/CompanyList";
import BuildingParkingEditor from "@/components/BuildingParkingEditor";
import BuildingAdminPanel from "@/components/BuildingAdminPanel";
import BuildingStatusControl from "@/components/BuildingStatusControl";
import SupervisorManager from "@/components/SupervisorManager";
import BuildingCredentialsEditor from "@/components/BuildingCredentialsEditor";

export default async function BuildingPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin();
  if (!admin) redirect("/");
  const { id } = await params;
  const isPrimarySuperAdmin = hasPrimaryAccess(admin);
  const [building, supervisor, buildingAdmin] = await Promise.all([
    prisma.building.findFirst({
      where: isPrimarySuperAdmin ? { id } : { id, superAdminId: admin.id },
      include: {
        companies: {
          orderBy: { createdAt: "asc" },
          include: {
            users: { where: { role: "COMPANY_ADMIN" }, select: { userId: true, username: true, password: true }, take: 1 },
            vehicles: { select: { id: true } },
            employees: { where: { isPlaceholder: false }, select: { id: true, category: true } },
          },
        },
      },
    }),
    prisma.user.findFirst({ where: { role: "EMPLOYEE", buildingId: id, companyId: null }, select: { userId: true } }),
    prisma.user.findFirst({
      where: { role: "BUILDING_ADMIN", buildingId: id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { userId: true, username: true, password: true },
    }),
  ]);
  if (!building) notFound();

  return <main className="dashboard-page">
    <Sidebar role={admin.role} canCreateSuperAdmins={isPrimarySuperAdmin} />
    <section className="dashboard-main">
      <header className="topbar">
        <div><div className="section-kicker">BUILDING PARKING</div><h1>{building.name}</h1></div>
        <div className="topbar-right"><Link className="logout-button link-button" href="/dashboard">← All buildings</Link><SignOutButton /></div>
      </header>
      <section className="portfolio-card building-management">
        <div className="portfolio-header">
          <div><div className="section-kicker">SUPER ADMIN</div><h2>Building management</h2><p>Manage the Admin scope, company parking, Supervisor account and access for this building.</p></div>
          <SupervisorManager buildingId={building.id} currentUserId={supervisor?.userId} />
        </div>
        <div className="portfolio-divider" />
        {buildingAdmin ? <BuildingCredentialsEditor buildingId={building.id} userId={buildingAdmin.userId} buildingName={building.name} initialPassword={buildingAdmin.password} canEditBuildingName /> : null}
        <BuildingStatusControl buildingId={building.id} buildingName={building.name} enabled={building.enabled} />
        <BuildingParkingEditor buildingId={building.id} initialValues={{ totalParking: building.totalParking, ownerParking: building.ownerParking, companyParking: building.companyParking, maximumGate: building.maximumGate }} />
      </section>
      <section className="portfolio-card building-management">
        <div className="portfolio-header"><div><div className="section-kicker">COMPANIES</div><h2>Companies</h2></div><BuildingAdminPanel buildingId={building.id} /></div>
        <div className="portfolio-divider" />
        <CompanyList companies={building.companies} companyParking={building.companyParking} showUserId showPassword />
      </section>
    </section>
  </main>;
}
