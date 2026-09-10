import SignOutButton from "@/components/SignOutButton";
import Sidebar from "@/components/Sidebar";
import BuildingAdminPanel from "@/components/BuildingAdminPanel";
import CompanyList from "@/components/CompanyList";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import CreateEntityModal from "@/components/CreateEntityModal";
import EmployeeList from "@/components/EmployeeList";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role === "SUPER_ADMIN") redirect("/dashboard");

  if (user.role === "BUILDING_ADMIN" && user.buildingId) {
    const building = await prisma.building.findUnique({
      where: { id: user.buildingId },
      include: {
        companies: {
          orderBy: { createdAt: "asc" },
          include: { users: { where: { role: "COMPANY_ADMIN" }, select: { userId: true, username: true }, take: 1 }, vehicles: { select: { id: true } } },
        },
      },
    });
    if (!building) redirect("/");
    return <main className="dashboard-page">
      <Sidebar roleLabel="Building Admin" dashboardHref="/account" dashboardLabel="My building" />
      <section className="dashboard-main">
        <header className="topbar">
          <div><div className="section-kicker">BUILDING PARKING</div><h1>{building.name}</h1></div>
          <div className="topbar-right">
            <div className="summary-card"><span>User ID</span><strong>{user.userId}</strong></div>
            <SignOutButton />
          </div>
        </header>
        <section className="portfolio-card building-management">
          <div className="portfolio-header">
            <div><div className="section-kicker">BUILDING ADMIN</div><h2>Welcome, {user.username}</h2><p>Manage company accounts and parking allocations for your building.</p></div>
          </div>
          <div className="portfolio-divider" />
          <div className="account-parking-grid account-company-parking-grid">
            <div className="large-stat"><span>Company parking</span><strong>{building.companyParking}</strong></div>
            <div className="large-stat"><span>Unallotted company parking</span><strong>{Math.max(building.companyParking - building.companies.reduce((total, company) => total + company.parkingAllocation, 0), 0)}</strong></div>
          </div>
        </section>
        <section className="portfolio-card building-management">
          <div className="portfolio-header">
            <div><div className="section-kicker">COMPANIES</div><h2>Companies</h2></div>
            <BuildingAdminPanel buildingId={building.id} />
          </div>
          <div className="portfolio-divider" />
          <CompanyList companies={building.companies} companyParking={building.companyParking} />
        </section>
      </section>
    </main>;
  }

  const building = user.buildingId
    ? await prisma.building.findUnique({ where: { id: user.buildingId }, select: { name: true } })
    : null;
  const company = user.companyId
    ? await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { name: true, parkingAllocation: true },
    })
    : null;
  const employees = user.role === "COMPANY_ADMIN" && user.companyId
    ? await prisma.employee.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "asc" },
      include: { vehicles: true },
    })
    : [];
  const allottedEmployeeParking = employees.reduce((total, employee) => total + employee.vehicles.length, 0);
  const unallottedEmployeeParking = Math.max((company?.parkingAllocation ?? 0) - allottedEmployeeParking, 0);

  return <main className="login-page">
    <section className="login-card account-card">
      <div className="brand-badge">ParkControl</div>
      <div className="login-heading">
        <span>{user.role.replaceAll("_", " ")}</span>
        <h1>Welcome, {user.username}</h1>
        <p>Your account is active and linked to the parking system.</p>
      </div>
      <div className="account-info">
        <div><span>User ID</span><strong>{user.userId}</strong></div>
        {building ? <div><span>Building</span><strong>{building.name}</strong></div> : null}
        {company ? <div><span>Company</span><strong>{company.name}</strong></div> : null}
      </div>
      {user.role === "COMPANY_ADMIN" && user.companyId && company ? <section className="employee-section">
        <div className="employee-section-header"><div><span className="section-kicker">TEAM</span><h2>Employees</h2><p className="employee-parking-summary">Parking allotted to employees: {allottedEmployeeParking} · Unallotted: {unallottedEmployeeParking}</p></div><CreateEntityModal kind="employee" companyId={user.companyId} /></div>
        <EmployeeList companyId={user.companyId} employees={employees} />
      </section> : null}
      <SignOutButton className="login-submit account-logout" />
    </section>
  </main>;
}
