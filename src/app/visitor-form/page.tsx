import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SignOutButton from "@/components/SignOutButton";
import VisitorForm from "@/components/VisitorForm";
import { prisma } from "@/lib/prisma";
import { effectivePermissions } from "@/lib/permissions";
import { roleLabel } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

export default async function VisitorFormPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const isBuildingAdmin = user.role === "BUILDING_ADMIN";
  const isCompanyUser = user.role === "COMPANY_ADMIN" || user.role === "BUILDING_OWNER";
  if (!isBuildingAdmin && !isCompanyUser) redirect("/dashboard");

  const permissions = effectivePermissions(user);
  let scopeLabel = "Building";
  let scopeName = "";

  if (isBuildingAdmin) {
    if (!user.buildingId) redirect("/dashboard");
    const building = await prisma.building.findUnique({
      where: { id: user.buildingId },
      select: { name: true },
    });
    if (!building) redirect("/dashboard");
    scopeName = building.name;
  } else {
    if (!user.companyId) redirect("/dashboard");
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { name: true, enabled: true, building: { select: { name: true } } },
    });
    if (!company || !company.enabled) redirect("/dashboard");
    scopeLabel = "Company";
    scopeName = company.name;
  }

  return <main className="dashboard-page">
    <Sidebar role={user.role} permissions={permissions} />
    <section className="dashboard-main">
      <header className="topbar">
        <div>
          <div className="section-kicker">{roleLabel(user.role).toUpperCase()}</div>
          <h1>Visitor Form</h1>
        </div>
        <div className="topbar-right">
          <div className="summary-card"><span>{scopeLabel}</span><strong>{scopeName}</strong></div>
          <SignOutButton />
        </div>
      </header>

      <section className="portfolio-card building-management">
        <div className="portfolio-header">
          <div>
            <div className="section-kicker">VISITOR ACCESS</div>
            <h2>Visitor details</h2>
            <p>Enter the visitor information below. Vehicle Number is optional; all other fields are required.</p>
          </div>
        </div>
        <div className="portfolio-divider" />
        <VisitorForm />
      </section>
    </section>
  </main>;
}
