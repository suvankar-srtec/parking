import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SignOutButton from "@/components/SignOutButton";
import CompanyParkingSplitEditor from "@/components/CompanyParkingSplitEditor";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { effectivePermissions, hasPermission } from "@/lib/permissions";

export default async function CompanyParkingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const companyScopedRole = user.role === "COMPANY_ADMIN" || user.role === "BUILDING_OWNER";
  if (!companyScopedRole || !user.companyId) redirect("/dashboard");
  if (!hasPermission(user, "company.allocateEmployeeParking")) redirect("/dashboard");

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: {
      id: true,
      name: true,
      enabled: true,
      parkingAllocation: true,
      ownerParkingAllocation: true,
      employeeParkingAllocation: true,
      building: { select: { name: true } },
      employees: { where: { isPlaceholder: false }, select: { category: true } },
    },
  });
  if (!company || !company.enabled) redirect("/dashboard");

  const ownerAssigned = company.employees.filter((person) => person.category === "OWNER").length;
  const employeeAssigned = company.employees.filter((person) => person.category !== "OWNER").length;
  const permissions = effectivePermissions(user);

  return <main className="dashboard-page">
    <Sidebar role={user.role} permissions={permissions} />
    <section className="dashboard-main">
      <header className="topbar"><div><div className="section-kicker">COMPANY / USER</div><h1>Parking allocation</h1></div><div className="topbar-right"><div className="summary-card"><span>Company</span><strong>{company.name}</strong></div><SignOutButton /></div></header>
      <section className="portfolio-card building-management">
        <div className="portfolio-header"><div><div className="section-kicker">COMPANY PARKING</div><h2>Separate parking allocation</h2><p>Admin assigned the company total. Divide it between Company Owners and Employees.</p></div></div>
        <div className="portfolio-divider" />
        <div className="account-parking-grid account-company-parking-grid">
          <div className="large-stat"><span>Total People</span><strong>{company.employees.length}</strong></div>
          <div className="large-stat"><span>Total Company Parking</span><strong>{company.parkingAllocation}</strong></div>
          <div className="large-stat"><span>Owners Assigned</span><strong>{ownerAssigned}</strong></div>
          <div className="large-stat"><span>Employees Assigned</span><strong>{employeeAssigned}</strong></div>
        </div>
        <CompanyParkingSplitEditor companyId={company.id} parkingAllocation={company.parkingAllocation} initialOwnerParking={company.ownerParkingAllocation} initialEmployeeParking={company.employeeParkingAllocation} />
      </section>
    </section>
  </main>;
}
