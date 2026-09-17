import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SignOutButton from "@/components/SignOutButton";
import { getCurrentUser } from "@/lib/session";
import { effectivePermissions, hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function RegisterCardsPage() {
  const user = await getCurrentUser();
  if (!user || !["SUPER_ADMIN", "BUILDING_ADMIN"].includes(user.role)) redirect("/dashboard");
  if (user.role === "BUILDING_ADMIN" && !hasPermission(user, "building.configureReaders")) redirect("/dashboard");
  const permissions = effectivePermissions(user);

  const vehicles = await prisma.vehicle.findMany({
    where: user.role === "SUPER_ADMIN" ? undefined : { company: { buildingId: user.buildingId! } },
    include: { company: { include: { building: { select: { name: true } } } }, employee: { select: { name: true, category: true } } },
    orderBy: [{ company: { building: { name: "asc" } } }, { company: { name: "asc" } }, { ownerName: "asc" }],
  });
  const registeredCount = vehicles.filter((vehicle) => Boolean(vehicle.rfidCardNo)).length;

  return <main className="dashboard-page">
    <Sidebar role={user.role} permissions={permissions} />
    <section className="dashboard-main">
      <header className="topbar"><div><div className="section-kicker">ACCESS CONTROL</div><h1>Register RFID cards</h1></div><SignOutButton /></header>
      <section className="portfolio-card building-management rfid-register-card">
        <div className="portfolio-header rfid-register-header">
          <div><div className="section-kicker">VEHICLES</div><h2>Card registration</h2><p>{user.role === "SUPER_ADMIN" ? "View RFID card assignments for vehicles across all buildings." : "View RFID card assignments for vehicles in your assigned building."}</p></div>
          <div className="rfid-register-summary" aria-label="RFID registration summary"><div><span>Total vehicles</span><strong>{vehicles.length}</strong></div><div><span>Cards registered</span><strong>{registeredCount}</strong></div></div>
        </div>
        <div className="portfolio-divider" />
        <div className="rfid-register-table-wrap"><table className="rfid-register-table"><thead><tr><th>Building</th><th>Company</th><th>Owner</th><th>Type</th><th>Vehicle</th><th>Current RFID</th></tr></thead><tbody>
          {vehicles.length ? vehicles.map((vehicle) => <tr key={vehicle.id}><td><span className="rfid-primary-cell">{vehicle.company.building.name}</span></td><td>{vehicle.company.name}</td><td>{vehicle.employee.name}</td><td><span className={`rfid-type-badge ${vehicle.employee.category === "OWNER" ? "owner" : "employee"}`}>{vehicle.employee.category === "OWNER" ? "Company Owner" : "Employee"}</span></td><td><span className="rfid-vehicle-number">{vehicle.plateNumber}</span></td><td>{vehicle.rfidCardNo ? <span className="rfid-card-badge registered">{vehicle.rfidCardNo}</span> : <span className="rfid-card-badge unregistered">Not registered</span>}</td></tr>) : <tr><td colSpan={6} className="rfid-empty-row">No vehicles are available for card registration.</td></tr>}
        </tbody></table></div>
      </section>
    </section>
    <style>{`
      .rfid-register-card{overflow:hidden}.rfid-register-header{align-items:flex-end}.rfid-register-summary{display:flex;gap:10px;flex-wrap:wrap}.rfid-register-summary>div{min-width:116px;padding:10px 12px;border:1px solid #d8e1dc;border-radius:8px;background:#f8fbf9;text-align:right}.rfid-register-summary span{display:block;color:#6b7770;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.35px}.rfid-register-summary strong{display:block;margin-top:5px;color:#7c46ac;font-size:19px}.rfid-register-table-wrap{width:100%;overflow-x:auto;border:1px solid #d9e2dd;border-radius:9px;background:#fff}.rfid-register-table{width:100%;min-width:760px;border-collapse:separate;border-spacing:0;text-align:left;font-size:13px}.rfid-register-table thead th{padding:12px 16px;border-bottom:1px solid #d8e1dc;background:#f1f6f3;color:#53645b;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.45px;white-space:nowrap}.rfid-register-table tbody td{padding:14px 16px;border-bottom:1px solid #e4ebe7;color:#21342a;vertical-align:middle}.rfid-register-table tbody tr:last-child td{border-bottom:0}.rfid-register-table tbody tr:hover td{background:#fafcfb}.rfid-primary-cell{font-weight:800;color:#18271f}.rfid-vehicle-number{font-weight:800;letter-spacing:.2px;white-space:nowrap}.rfid-type-badge,.rfid-card-badge{display:inline-flex;align-items:center;min-height:27px;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap}.rfid-type-badge.employee{background:#eef4ff;color:#365a94}.rfid-type-badge.owner{background:#f4eef9;color:#71439b}.rfid-card-badge.registered{background:#e9f7f0;color:#137256;border:1px solid #c5e7d7;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;letter-spacing:.3px}.rfid-card-badge.unregistered{background:#f5f6f5;color:#7c8781;border:1px solid #e0e5e2}.rfid-empty-row{text-align:center!important;padding:34px 16px!important;color:#738078!important}@media(max-width:760px){.rfid-register-header{align-items:flex-start}.rfid-register-summary{width:100%}.rfid-register-summary>div{flex:1;min-width:120px}.rfid-register-table thead th,.rfid-register-table tbody td{padding-left:12px;padding-right:12px}}
    `}</style>
  </main>;
}
