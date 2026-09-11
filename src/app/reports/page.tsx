import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SignOutButton from "@/components/SignOutButton";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { roleLabel } from "@/lib/roles";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const where = user.role === "SUPER_ADMIN"
    ? undefined
    : user.companyId
      ? { companyId: user.companyId }
      : user.buildingId
        ? { buildingId: user.buildingId }
        : { id: "__no_scope__" };

  const events = await prisma.rfidEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return <main className="dashboard-page">
    <Sidebar role={user.role} />
    <section className="dashboard-main">
      <header className="topbar">
        <div><div className="section-kicker">{roleLabel(user.role).toUpperCase()}</div><h1>Reports</h1></div>
        <div className="topbar-right"><div className="summary-card"><span>User ID</span><strong>{user.userId}</strong></div><SignOutButton /></div>
      </header>

      <section className="portfolio-card building-management">
        <div className="portfolio-header"><div><div className="section-kicker">LIVE / HISTORY</div><h2>Parking activity</h2><p>Recent RFID access and parking events available to this account.</p></div></div>
        <div className="portfolio-divider" />
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Device</th><th>Card</th><th>Action</th><th>Code</th><th>Result</th></tr></thead>
            <tbody>
              {events.length ? events.map((event) => <tr key={event.id}>
                <td>{event.createdAt.toLocaleString()}</td>
                <td>{event.deviceNumber}</td>
                <td>{event.cardNo}</td>
                <td>{event.action}</td>
                <td>{event.code}</td>
                <td>{event.message}</td>
              </tr>) : <tr><td colSpan={6}>No parking activity is available for this account yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  </main>;
}
