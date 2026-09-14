import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SignOutButton from "@/components/SignOutButton";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isPrimarySuperAdmin } from "@/lib/super-admin-scope";

export default async function ReaderDetailsPage() {
  const user = await getCurrentUser();
  if (!user || !["SUPER_ADMIN", "BUILDING_ADMIN"].includes(user.role)) redirect("/dashboard");

  const primary = user.role === "SUPER_ADMIN" && isPrimarySuperAdmin(user);
  const where = user.role === "SUPER_ADMIN"
    ? (primary ? { buildingId: { not: null } } : { building: { superAdminId: user.id } })
    : { buildingId: user.buildingId || "__none__" };

  const readers = await prisma.rfidReader.findMany({
    where,
    orderBy: { deviceNumber: "asc" },
    include: { building: { select: { name: true } } },
  });

  return <main className="dashboard-page">
    <Sidebar role={user.role} canCreateSuperAdmins={primary} />
    <section className="dashboard-main">
      <header className="topbar"><div><div className="section-kicker">ACCESS CONTROL</div><h1>Reader Details</h1></div><SignOutButton /></header>
      <section className="portfolio-card building-management" style={{ marginTop: 19 }}>
        <div className="portfolio-header"><div><div className="section-kicker">RFID READERS</div><h2>Reader inventory</h2><p>Configured reader details for the buildings available to this account.</p></div></div>
        <div className="portfolio-divider" />
        <div className="rfid-register-table-wrap">
          <table className="rfid-register-table">
            <thead><tr><th>Reader</th><th>Device Number</th><th>IP Address</th><th>Building</th><th>Mode</th><th>Status</th><th>Last Contact</th></tr></thead>
            <tbody>
              {readers.map((reader) => <tr key={reader.id}>
                <td><strong>{reader.name}</strong></td>
                <td>{reader.deviceNumber}</td>
                <td>{reader.readerIp || "Not detected"}</td>
                <td>{reader.building?.name || "Not assigned"}</td>
                <td>{reader.mode === "REGISTER" ? "Registration" : reader.mode === "EXIT" ? "Exit" : "Entry"}</td>
                <td>{reader.enabled ? "Approved" : "Disabled"}</td>
                <td>{reader.lastSeenAt ? reader.lastSeenAt.toLocaleString() : "No contact yet"}</td>
              </tr>)}
              {!readers.length ? <tr><td colSpan={7} className="rfid-empty-row">No configured readers are available.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  </main>;
}
