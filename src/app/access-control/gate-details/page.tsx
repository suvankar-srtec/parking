import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SignOutButton from "@/components/SignOutButton";
import GateDetailsManager from "@/components/GateDetailsManager";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isPrimarySuperAdmin } from "@/lib/super-admin-scope";
import { parseGateConfig } from "@/lib/gate-config";

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
      readers: {
        orderBy: { deviceNumber: "asc" },
        select: {
          id: true,
          name: true,
          deviceNumber: true,
          mode: true,
          enabled: true,
        },
      },
    },
  });

  const gateRows = buildings.map((building) => ({
    id: building.id,
    name: building.name,
    maximumGate: building.maximumGate,
    readers: building.readers,
    gates: building.gates.length
      ? building.gates.map((gate) => {
          const config = parseGateConfig(gate.direction);
          return {
            gateNumber: gate.gateNumber,
            direction: config.direction,
            readerId: config.readerId,
          };
        })
      : [{ gateNumber: 1, direction: "SELECT" as const, readerId: null }],
  }));

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
        <GateDetailsManager buildings={gateRows} />
      </section>
    </section>
  </main>;
}
