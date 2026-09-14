import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SignOutButton from "@/components/SignOutButton";
import GateDetailsManager from "@/components/GateDetailsManager";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isPrimarySuperAdmin } from "@/lib/super-admin-scope";

type GateDirection = "ENTRY" | "EXIT" | "ENTRY_EXIT";

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
    select: {
      id: true,
      name: true,
      maximumGate: true,
      gates: {
        select: { gateNumber: true, direction: true },
        orderBy: { gateNumber: "asc" },
      },
    },
  });

  const gateRows = buildings.map((building) => {
    const configured = new Map(building.gates.map((gate) => [gate.gateNumber, gate.direction]));
    return {
      id: building.id,
      name: building.name,
      maximumGate: building.maximumGate,
      gates: Array.from({ length: building.maximumGate }, (_, index) => {
        const gateNumber = index + 1;
        const stored = configured.get(gateNumber);
        const direction: GateDirection = stored === "EXIT" || stored === "ENTRY_EXIT" ? stored : "ENTRY";
        return { gateNumber, direction };
      }),
    };
  });

  return <main className="dashboard-page">
    <Sidebar role={user.role} canCreateSuperAdmins={primary} />
    <section className="dashboard-main">
      <header className="topbar">
        <div>
          <div className="section-kicker">ACCESS CONTROL</div>
          <h1>Gate Details</h1>
        </div>
        <SignOutButton />
      </header>

      <section className="portfolio-card building-management" style={{ marginTop: 19 }}>
        <div className="portfolio-header">
          <div>
            <div className="section-kicker">BUILDING GATES</div>
            <h2>Gate direction management</h2>
            <p>Configure each gate as Entry, Exit, or Entry / Exit. The direction indicators update automatically when you change the dropdown.</p>
          </div>
        </div>
        <div className="portfolio-divider" />
        <GateDetailsManager buildings={gateRows} />
      </section>
    </section>
  </main>;
}
