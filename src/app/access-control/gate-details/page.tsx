import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SignOutButton from "@/components/SignOutButton";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isPrimarySuperAdmin } from "@/lib/super-admin-scope";

export default async function GateDetailsPage() {
  const user = await getCurrentUser();
  if (!user || !["SUPER_ADMIN", "BUILDING_ADMIN"].includes(user.role)) redirect("/dashboard");

  const primary = user.role === "SUPER_ADMIN" && isPrimarySuperAdmin(user);
  const where = user.role === "SUPER_ADMIN"
    ? (primary ? undefined : { superAdminId: user.id })
    : { id: user.buildingId || "__none__" };

  const buildings = await prisma.building.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      _count: { select: { companies: true, readers: true } },
      companies: { select: { vehicles: { where: { isInside: true }, select: { id: true } } } },
    },
  });

  return <main className="dashboard-page">
    <Sidebar role={user.role} canCreateSuperAdmins={primary} />
    <section className="dashboard-main">
      <header className="topbar"><div><div className="section-kicker">ACCESS CONTROL</div><h1>Gate Details</h1></div><SignOutButton /></header>
      <section className="portfolio-card building-management" style={{ marginTop: 19 }}>
        <div className="portfolio-header"><div><div className="section-kicker">BUILDING GATES</div><h2>Gate overview</h2><p>Parking and reader status by building.</p></div></div>
        <div className="portfolio-divider" />
        <div className="reader-grid">
          {buildings.map((building) => {
            const inside = building.companies.reduce((sum, company) => sum + company.vehicles.length, 0);
            return <article className="reader-card" key={building.id}>
              <h3>{building.name}</h3>
              <p><strong>{inside}</strong> vehicles currently inside</p>
              <p>Total parking: {building.totalParking}</p>
              <p>Owner parking: {building.ownerParking}</p>
              <p>Company parking: {building.companyParking}</p>
              <p>Companies: {building._count.companies} · Readers: {building._count.readers}</p>
            </article>;
          })}
        </div>
        {!buildings.length ? <p className="muted">No buildings are available for this account.</p> : null}
      </section>
    </section>
  </main>;
}
