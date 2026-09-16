import SignOutButton from "@/components/SignOutButton";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { roleLabel } from "@/lib/roles";
import { isPrimarySuperAdmin } from "@/lib/super-admin-scope";
import Sidebar from "@/components/Sidebar";
import BuildingPortfolio from "@/components/BuildingPortfolio";
import BuildingAdminPanel from "@/components/BuildingAdminPanel";
import CompanyList from "@/components/CompanyList";
import CreateEntityModal from "@/components/CreateEntityModal";
import EmployeeList from "@/components/EmployeeList";
import SupervisorManager from "@/components/SupervisorManager";
import SupervisorHeadcount from "@/components/SupervisorHeadcount";
import BuildingCredentialsEditor from "@/components/BuildingCredentialsEditor";
import CompanyCredentialsEditor from "@/components/CompanyCredentialsEditor";

function AssignmentRequired({ title, message }: { title: string; message: string }) {
  return <section className="portfolio-card building-management">
    <div className="portfolio-header"><div><div className="section-kicker">ACCOUNT SETUP</div><h2>{title}</h2><p>{message}</p></div></div>
  </section>;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  if (user.role === "SUPER_ADMIN") {
    const primary = isPrimarySuperAdmin(user);
    const buildings = await prisma.building.findMany({
      where: primary ? undefined : { superAdminId: user.id },
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { companies: true } },
        users: { where: { role: "BUILDING_ADMIN" }, select: { userId: true, username: true }, take: 1 },
      },
    });
    return <main className="dashboard-page"><Sidebar role={user.role} canCreateSuperAdmins={primary} /><section className="dashboard-main">
      <header className="topbar"><div><div className="section-kicker">BUILDING PARKING</div><h1>{primary ? "Building portfolio" : "My buildings"}</h1></div><div className="topbar-right"><div className="summary-card"><span>{roleLabel(user.role)}</span><strong>{user.userId}</strong></div><SignOutButton /></div></header>
      {!primary && buildings.length === 0 ? <section className="portfolio-card building-management"><div className="portfolio-header"><div><div className="section-kicker">GET STARTED</div><h2>Create your first building</h2><p>This Super Admin account is isolated from other Super Admins. Create a building to start managing its Admin, companies, Supervisor, RFID access and reports.</p></div></div></section> : null}
      <BuildingPortfolio buildings={buildings} />
    </section></main>;
  }

  if (user.role === "BUILDING_ADMIN") {
    if (!user.buildingId) return <main className="dashboard-page"><Sidebar role={user.role} /><section className="dashboard-main"><header className="topbar"><div><div className="section-kicker">ADMIN</div><h1>Dashboard</h1></div><SignOutButton /></header><AssignmentRequired title="Building not assigned" message="This Admin account must be assigned to a building by a Super Admin before company management is available." /></section></main>;

    const [building, supervisor] = await Promise.all([
      prisma.building.findUnique({
        where: { id: user.buildingId },
        include: {
          companies: {
            orderBy: { createdAt: "asc" },
            include: {
              users: { where: { role: "COMPANY_ADMIN" }, select: { userId: true, username: true, password: true }, take: 1 },
              vehicles: { select: { id: true } },
              employees: { select: { id: true, category: true } },
            },
          },
        },
      }),
      prisma.user.findFirst({ where: { role: "EMPLOYEE", buildingId: user.buildingId, companyId: null }, select: { userId: true } }),
    ]);
    if (!building) redirect("/");
    const allocated = building.companies.reduce((total, company) => total + company.parkingAllocation, 0);
    const available = Math.max(building.companyParking - allocated, 0);

    return <main className="dashboard-page"><Sidebar role={user.role} /><section className="dashboard-main">
      <header className="topbar"><div><div className="section-kicker">ADMIN</div><h1>{building.name}</h1></div><div className="topbar-right"><div className="summary-card"><span>User ID</span><strong>{user.userId}</strong></div><SignOutButton /></div></header>
      <section className="portfolio-card building-management">
        <div className="portfolio-header"><div><div className="section-kicker">ADMIN DASHBOARD</div><h2>Parking allocation</h2><p>Create companies, create the building Supervisor, set company parking limits, configure gate directions, register cards and review reports.</p></div><SupervisorManager buildingId={building.id} currentUserId={supervisor?.userId} /></div>
        <div className="portfolio-divider" />
        <BuildingCredentialsEditor buildingId={building.id} userId={user.userId} buildingName={building.name} initialPassword={user.password} />
        <div className="building-parking-summary">
          <div className="building-parking-row building-parking-row-primary">
            <div className="large-stat"><span>Owner parking</span><strong>{building.ownerParking}</strong></div>
            <div className="large-stat"><span>Maximum Gates</span><strong>{building.maximumGate}</strong></div>
          </div>
          <div className="building-parking-row building-parking-row-secondary">
            <div className="large-stat"><span>Company parking</span><strong>{building.companyParking}</strong></div>
            <div className="large-stat"><span>Allotted</span><strong>{allocated}</strong></div>
            <div className="large-stat"><span>Available</span><strong>{available}</strong></div>
          </div>
        </div>
        <style>{`
          .building-parking-summary{display:grid;gap:10px;margin-top:10px}
          .building-parking-row{display:grid;gap:10px}
          .building-parking-row-primary{grid-template-columns:repeat(2,minmax(0,1fr))}
          .building-parking-row-secondary{grid-template-columns:repeat(3,minmax(0,1fr))}
          .building-parking-summary .large-stat{min-width:0}
          @media(max-width:760px){
            .building-parking-row-primary,.building-parking-row-secondary{grid-template-columns:1fr}
          }
        `}</style>
      </section>
      <section className="portfolio-card building-management"><div className="portfolio-header"><div><div className="section-kicker">COMPANIES</div><h2>Companies</h2></div><BuildingAdminPanel buildingId={building.id} /></div><div className="portfolio-divider" /><CompanyList companies={building.companies} companyParking={building.companyParking} showUserId showPassword /></section>
    </section></main>;
  }

  if (user.role === "COMPANY_ADMIN" || user.role === "BUILDING_OWNER") {
    if (!user.companyId) return <main className="dashboard-page"><Sidebar role={user.role} /><section className="dashboard-main"><header className="topbar"><div><div className="section-kicker">{roleLabel(user.role).toUpperCase()}</div><h1>Dashboard</h1></div><SignOutButton /></header><AssignmentRequired title="Company not assigned" message="This account must be linked to a company before parking allocation is available." /></section></main>;

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      include: {
        building: { select: { name: true } },
        departments: { orderBy: { name: "asc" } },
        employees: { orderBy: { createdAt: "asc" }, include: { vehicles: true } },
      },
    });
    if (!company) redirect("/");
    const allotted = company.employees.reduce((total, employee) => total + employee.parkingLimit, 0);
    const used = company.employees.reduce((total, employee) => total + employee.vehicles.length, 0);
    const available = Math.max(company.parkingAllocation - allotted, 0);

    return <main className="dashboard-page"><Sidebar role={user.role} /><section className="dashboard-main">
      <header className="topbar"><div><div className="section-kicker">{roleLabel(user.role).toUpperCase()}</div><h1>{company.name}</h1></div><div className="topbar-right"><div className="summary-card"><span>Building</span><strong>{company.building.name}</strong></div><SignOutButton /></div></header>
      <section className="portfolio-card building-management"><div className="portfolio-header"><div><div className="section-kicker">COMPANY PARKING</div><h2>Parking allocation</h2><p>Assign parking limits to employees and company owners. Total assignments cannot exceed the company limit.</p></div></div><div className="portfolio-divider" /><CompanyCredentialsEditor userId={user.userId} companyName={company.name} initialPassword={user.password} /><div className="account-parking-grid account-company-parking-grid"><div className="large-stat"><span>Company limit</span><strong>{company.parkingAllocation}</strong></div><div className="large-stat"><span>Assigned limits</span><strong>{allotted}</strong></div><div className="large-stat"><span>Registered vehicles</span><strong>{used}</strong></div><div className="large-stat"><span>Unassigned</span><strong>{available}</strong></div></div></section>
      <section className="portfolio-card building-management"><div className="employee-section-header"><div><div className="section-kicker">PEOPLE</div><h2>Employees & Company Owners</h2></div><CreateEntityModal kind="employee" companyId={company.id} departments={company.departments} maximumDepartments={company.maximumDepartments} /></div><div className="portfolio-divider" /><EmployeeList companyId={company.id} employees={company.employees} departments={company.departments} /></section>
    </section></main>;
  }

  return <main className="dashboard-page"><Sidebar role={user.role} /><section className="dashboard-main">
    <header className="topbar"><div><div className="section-kicker">SUPERVISOR</div><h1>Real Time Monitor</h1></div><div className="topbar-right"><div className="summary-card"><span>User ID</span><strong>{user.userId}</strong></div><SignOutButton /></div></header>
    {user.buildingId ? <SupervisorHeadcount /> : <AssignmentRequired title="Building not assigned" message="This Supervisor must be assigned to a building before the Real Time Monitor and reports are available." />}
  </section></main>;
}
