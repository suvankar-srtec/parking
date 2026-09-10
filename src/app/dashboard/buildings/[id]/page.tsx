import SignOutButton from "@/components/SignOutButton";
import Link from "@/components/AppLink";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/session";
import Sidebar from "@/components/Sidebar";
import CompanyList from "@/components/CompanyList";
import BuildingParkingEditor from "@/components/BuildingParkingEditor";

export default async function BuildingPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin();
  if (!admin) redirect("/");
  const { id } = await params;
  const building = await prisma.building.findUnique({
    where: { id },
    include: {
      companies: {
        orderBy: { createdAt: "asc" },
        include: {
          users: {
            where: { role: "COMPANY_ADMIN" },
            select: { userId: true, username: true },
            take: 1,
          },
          vehicles: { select: { id: true } },
        },
      },
    },
  });
  if (!building) notFound();

  return (
    <main className="dashboard-page">
      <Sidebar />
      <section className="dashboard-main">
        <header className="topbar">
          <div><div className="section-kicker">BUILDING PARKING</div><h1>{building.name}</h1></div>
          <div className="topbar-right">
            <Link className="logout-button link-button" href="/dashboard">← All buildings</Link>
            <SignOutButton />
          </div>
        </header>
        <section className="portfolio-card building-management">
          <div className="portfolio-header">
            <div>
              <div className="section-kicker">SUPER ADMIN</div>
              <h2>Building management</h2>
              <p>Manage parking capacity and view companies in this building.</p>
            </div>
          </div>
          <div className="portfolio-divider" />
          <BuildingParkingEditor
            buildingId={building.id}
            initialValues={{ totalParking: building.totalParking, ownerParking: building.ownerParking, companyParking: building.companyParking }}
          />
        </section>
        <section className="portfolio-card building-management">
          <div className="section-kicker">COMPANIES</div>
          <CompanyList companies={building.companies} companyParking={building.companyParking} />
        </section>
      </section>
    </main>
  );
}
