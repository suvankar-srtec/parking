import SignOutButton from "@/components/SignOutButton";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/session";
import Sidebar from "@/components/Sidebar";
import BuildingPortfolio from "@/components/BuildingPortfolio";

export default async function DashboardPage() {
  const admin = await requireSuperAdmin();
  if (!admin) redirect("/");

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

  return (
    <main className="dashboard-page">
      <Sidebar />
      <section className="dashboard-main">
        <header className="topbar">
          <div><div className="section-kicker">BUILDING PARKING</div><h1>Buildings</h1></div>
          <div className="topbar-right">
            <div className="summary-card"><span>Super admin</span><strong>{admin.username}</strong></div>
            <SignOutButton />
          </div>
        </header>
        <BuildingPortfolio buildings={buildings} />
      </section>
    </main>
  );
}
