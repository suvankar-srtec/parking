import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SignOutButton from "@/components/SignOutButton";
import RegisterCardButton from "@/components/RegisterCardButton";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function RegisterCardsPage() {
  const user = await getCurrentUser();
  if (!user || !["SUPER_ADMIN", "BUILDING_ADMIN"].includes(user.role)) redirect("/");

  const vehicles = await prisma.vehicle.findMany({
    where: user.role === "SUPER_ADMIN" ? undefined : { company: { buildingId: user.buildingId! } },
    include: {
      company: { include: { building: { select: { name: true } } } },
      employee: { select: { id: true, name: true, category: true } },
    },
    orderBy: [{ company: { name: "asc" } }, { ownerName: "asc" }],
  });

  return <main className="dashboard-page">
    <Sidebar role={user.role} />
    <section className="dashboard-main">
      <header className="topbar">
        <div><div className="section-kicker">ACCESS CONTROL</div><h1>Register RFID cards</h1></div>
        <SignOutButton />
      </header>
      <section className="portfolio-card building-management">
        <div className="portfolio-header"><div><div className="section-kicker">VEHICLES</div><h2>Card registration</h2><p>{user.role === "SUPER_ADMIN" ? "Register cards for vehicles across all buildings." : "Register cards for vehicles in your assigned building."}</p></div></div>
        <div className="portfolio-divider" />
        <div className="table-wrap">
          <table>
            <thead><tr><th>Building</th><th>Company</th><th>Owner</th><th>Type</th><th>Vehicle</th><th>Current RFID</th><th>Action</th></tr></thead>
            <tbody>
              {vehicles.length ? vehicles.map((vehicle) => <tr key={vehicle.id}>
                <td>{vehicle.company.building.name}</td>
                <td>{vehicle.company.name}</td>
                <td>{vehicle.employee.name}</td>
                <td>{vehicle.employee.category === "OWNER" ? "Company Owner" : "Employee"}</td>
                <td>{vehicle.plateNumber}</td>
                <td>{vehicle.rfidCardNo || "Not registered"}</td>
                <td><RegisterCardButton employeeId={vehicle.employee.id} vehicleId={vehicle.id} plateNumber={vehicle.plateNumber} /></td>
              </tr>) : <tr><td colSpan={7}>No vehicles are available for card registration.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  </main>;
}
