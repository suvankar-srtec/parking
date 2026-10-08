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
      visitorParkingAllocation: true,
      employeeParkingAllocation: true,
      building: { select: { name: true } },
      employees: { where: { isPlaceholder: false }, select: { category: true } },
    },
  });
  if (!company || !company.enabled) redirect("/dashboard");

  const permissions = effectivePermissions(user);

  return <main className="dashboard-page">
    <Sidebar role={user.role} permissions={permissions} />
    <section className="dashboard-main">
      <header className="topbar"><div><div className="section-kicker">COMPANY / USER</div><h1>Parking allocation</h1></div><div className="topbar-right"><div className="summary-card"><span>Company</span><strong>{company.name}</strong></div><SignOutButton /></div></header>
      <section className="portfolio-card building-management">
        <CompanyParkingSplitEditor companyId={company.id} parkingAllocation={company.parkingAllocation} initialOwnerParking={company.ownerParkingAllocation} initialVisitorParking={company.visitorParkingAllocation} initialEmployeeParking={company.employeeParkingAllocation} />
      </section>
    </section>
  </main>;
}
