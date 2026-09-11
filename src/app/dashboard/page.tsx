import SignOutButton from "@/components/SignOutButton";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { roleLabel } from "@/lib/roles";
import Sidebar from "@/components/Sidebar";
import BuildingPortfolio from "@/components/BuildingPortfolio";
import BuildingAdminPanel from "@/components/BuildingAdminPanel";
import CompanyList from "@/components/CompanyList";
import CreateEntityModal from "@/components/CreateEntityModal";
import EmployeeList from "@/components/EmployeeList";
import SupervisorHeadcount from "@/components/SupervisorHeadcount";

function AssignmentRequired({ title, message }: { title: string; message: string }) {
  return <section className="portfolio-card building-management">
    <div className="portfolio-header">
      <div><div className="section-kicker">ACCOUNT SETUP</div><h2>{title}</h2><p>{message}</p></div>
    </div>
  </section>;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  if (user.role === "SUPER_ADMIN") {
    const buildings = await prisma.building.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { companies: true } },
        users: {
          where: { role: "BUILDING_ADMIN" },
          select: { userId: true, username: true },
          take: 1,
        },
      },
    });

    return <main className="dashboard-page">
      <Sidebar role={user.role} />
      <section className="dashboard-main">
        <header className="topbar">
          <div><div className="section-kicker">BUILDING PARKING</div><h1>Buildings</h1></div>
          <div className="topbar-right">
            <div className="summary-card"><span>{roleLabel(user.role)}</span><strong>{user.username}</strong></div>
            <SignOutButton />
          </div>
        </header>
        <BuildingPortfolio buildings={buildings} />
      </section>
    </main>;
  }

  if (user.role === "BUILDING_ADMIN") {
    if (!user.buildingId) {
      return <main className="dashboard-page"><Sidebar role={user.role} /><section className="dashboard-main">
        <header className="topbar"><div><div className="section-kicker">ADMIN</div><h1>Dashboard</h1></div><SignOutButton /></header>
        <AssignmentRequired title="Building not assigned" message="This Admin account must be assigned to a building by a Super Admin before company management is available." />
      </section></main>;
    }

    const building = await prisma.building.findUnique({
      where: { id: user.buildingId },
      include: {
        companies: {
          orderBy: { createdAt: "asc" },
          include: {
            users: { where: { role: "COMPANY_ADMIN" }, select: { userId: true, username: true }, take: 1 },
            vehicles: { select: { id: true } },
          },
        },
      },
    });
    if (!building) redirect("/");
    const allocated = building.companies.reduce((total, company) => total + company.parkingAllocation, 0);

    return <main className="dashboard-page">
      <Sidebar role={user.role} />
      <section className="dashboard-main">
        <header className="topbar">
          <div><div className="section-kicker">ADMIN</div><h1>{building.name}</h1></div>
          <div className="topbar-right"><div className="summary-card"><span>User ID</span><strong>{user.userId}</strong></div><SignOutButton /></div>
        </header>
        <section className="portfolio-card building-management">
          <div className="portfolio-header"><div><div className="section-kicker">ADMIN DASHBOARD</div><h2>Parking allocation</h2><p>Create companies, set company parking limits, register cards and review reports for this building.</p></div></div>
          <div className="portfolio-divider" />
          <div className="account-parking-grid account-company-parking-grid">
            <div className="large-stat"><span>Company parking</span><strong>{building.companyParking}</strong></div>
            <div className="large-stat"><span>Allocated</span><strong>{allocated}</strong></div>
            <div className="large-stat"><span>Available</span><strong>{Math.max(building.companyParking - allocated, 0)}</strong></div>
          </div>
        </section>
        <section className="portfolio-card building-management">
          <div className="portfolio-header"><div><div className="section-kicker">COMPANIES</div><h2>Companies</h2></div><BuildingAdminPanel buildingId={building.id} /></div>
          <div className="portfolio-divider" />
          <CompanyList companies={building.companies} companyParking={building.companyParking} />
        </section>
      </section>
    </main>;
  }

  if (user.role === "COMPANY_ADMIN" || user.role === "BUILDING_OWNER") {
    if (!user.companyId) {
      return <main className="dashboard-page"><Sidebar role={user.role} /><section className="dashboard-main">
        <header className="topbar"><div><div className="section-kicker">{roleLabel(user.role).toUpperCase()}</div><h1>Dashboard</h1></div><SignOutButton /></header>
        <AssignmentRequired title="Company not assigned" message="This account must be linked to a company before employee parking allocation is available." />
      </section></main>;
    }

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      include: {
        building: { select: { name: true } },
        employees: { orderBy: { createdAt: "asc" }, include: { vehicles: true } },
      },
    });
    if (!company) redirect("/");
    const allotted = company.employees.reduce((total, employee) => total + employee.vehicles.length, 0);
    const available = Math.max(company.parkingAllocation - allotted, 0);

    return <main className="dashboard-page">
      <Sidebar role={user.role} />
      <section className="dashboard-main">
        <header className="topbar">
          <div><div className="section-kicker">{roleLabel(user.role).toUpperCase()}</div><h1>{company.name}</h1></div>
          <div className="topbar-right"><div className="summary-card"><span>Building</span><strong>{company.building.name}</strong></div><SignOutButton /></div>
        </header>
        <section className="portfolio-card building-management">
          <div className="portfolio-header"><div><div className="section-kicker">COMPANY PARKING</div><h2>Parking allocation</h2><p>Assign the company parking allowance to employees and company owners, then review usage in Reports.</p></div></div>
          <div className="portfolio-divider" />
          <div className="account-parking-grid account-company-parking-grid">
            <div className="large-stat"><span>Company limit</span><strong>{company.parkingAllocation}</strong></div>
            <div className="large-stat"><span>Assigned</span><strong>{allotted}</strong></div>
            <div className="large-stat"><span>Available</span><strong>{available}</strong></div>
          </div>
        </section>
        <section className="portfolio-card building-management">
          <div className="employee-section-header"><div><div className="section-kicker">TEAM</div><h2>Employees</h2></div><CreateEntityModal kind="employee" companyId={company.id} /></div>
          <div className="portfolio-divider" />
          <EmployeeList companyId={company.id} employees={company.employees} />
        </section>
      </section>
    </main>;
  }

  return <main className="dashboard-page">
    <Sidebar role={user.role} />
    <section className="dashboard-main">
      <header className="topbar">
        <div><div className="section-kicker">SUPERVISOR</div><h1>Realtime Head Count</h1></div>
        <div className="topbar-right"><div className="summary-card"><span>User ID</span><strong>{user.userId}</strong></div><SignOutButton /></div>
      </header>
      {!user.buildingId ? <AssignmentRequired title="Building not assigned" message="This Supervisor account must be assigned to a building before realtime head count is available." /> : <SupervisorHeadcount />}
    </section>
  </main>;
}
