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

  const companyWhere = user.role === "SUPER_ADMIN" ? undefined : { buildingId: user.buildingId! };

  const companies = await prisma.company.findMany({
    where: companyWhere,
    orderBy: [{ building: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      parkingAllocation: true,
      building: { select: { name: true } },
      users: {
        where: { role: "COMPANY_ADMIN" },
        select: { userId: true },
        take: 1,
      },
      vehicles: {
        select: { id: true, rfidCardNo: true },
      },
    },
  });

  return <main className="dashboard-page">
    <Sidebar role={user.role} permissions={permissions} />
    <section className="dashboard-main">
      <header className="topbar">
        <div><div className="section-kicker">ACCESS CONTROL</div><h1>Register RFID cards</h1></div>
        <SignOutButton />
      </header>

      <section className="portfolio-card building-management rfid-register-card">
        <div className="portfolio-header rfid-register-header">
          <div>
            <div className="section-kicker">COMPANIES</div>
            <h2>{user.role === "BUILDING_ADMIN" ? "Companies in this building" : "Companies"}</h2>
            <p>{user.role === "BUILDING_ADMIN"
              ? "All companies assigned to your building are shown here."
              : "Companies available in your current Super Admin scope."}</p>
          </div>
          <div className="rfid-register-summary" aria-label="Company summary">
            <div><span>Total companies</span><strong>{companies.length}</strong></div>
          </div>
        </div>

        <div className="portfolio-divider" />

        {companies.length ? <div className="rfid-company-grid">
          {companies.map((company) => {
            const companyRegistered = company.vehicles.filter((vehicle) => Boolean(vehicle.rfidCardNo)).length;
            return <article className="rfid-company-card" key={company.id}>
              <div className="rfid-company-card-head">
                <div>
                  <span>{company.building.name}</span>
                  <strong>{company.name}</strong>
                </div>
                <span className="rfid-company-user-id">{company.users[0]?.userId || "No user"}</span>
              </div>
              <div className="rfid-company-stats">
                <div><span>Parking allotted</span><strong>{company.parkingAllocation}</strong></div>
                <div><span>Vehicles</span><strong>{company.vehicles.length}</strong></div>
                <div><span>RFID registered</span><strong>{companyRegistered}</strong></div>
              </div>
            </article>;
          })}
        </div> : <div className="rfid-company-empty">No companies have been created for this building yet.</div>}
      </section>
    </section>

    <style>{`
      .rfid-register-card{overflow:hidden}
      .rfid-register-header{align-items:flex-end}
      .rfid-register-summary{display:flex;gap:10px;flex-wrap:wrap}
      .rfid-register-summary>div{min-width:116px;padding:10px 12px;border:1px solid #d8e1dc;border-radius:8px;background:#f8fbf9;text-align:right}
      .rfid-register-summary span{display:block;color:#6b7770;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.35px}
      .rfid-register-summary strong{display:block;margin-top:5px;color:#7c46ac;font-size:19px}
      .rfid-company-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .rfid-company-card{min-width:0;padding:14px;border:1px solid #d7e1db;border-radius:10px;background:#fbfdfc}
      .rfid-company-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px}
      .rfid-company-card-head>div{min-width:0}
      .rfid-company-card-head>div>span{display:block;margin-bottom:4px;color:#7a867f;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.4px}
      .rfid-company-card-head strong{display:block;overflow:hidden;color:#1d2f25;font-size:14px;text-overflow:ellipsis;white-space:nowrap}
      .rfid-company-user-id{display:inline-flex;align-items:center;min-height:24px;padding:4px 7px;border-radius:999px;background:#f1ecf7;color:#7445a0;font-size:9px;font-weight:800;white-space:nowrap}
      .rfid-company-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
      .rfid-company-stats>div{min-width:0;padding:8px;border-radius:7px;background:#f2f6f4}
      .rfid-company-stats span{display:block;min-height:22px;color:#68766e;font-size:8.5px;font-weight:700;line-height:1.2}
      .rfid-company-stats strong{display:block;margin-top:4px;color:#293d32;font-size:16px}
      .rfid-company-empty{padding:28px 16px;border:1px dashed #d1dbd5;border-radius:9px;color:#738078;text-align:center;font-size:12px}
      @media(max-width:980px){.rfid-company-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:760px){
        .rfid-register-header{align-items:flex-start}
        .rfid-register-summary{width:100%}
        .rfid-register-summary>div{flex:1;min-width:120px}
        .rfid-company-grid{grid-template-columns:1fr}
      }
    `}</style>
  </main>;
}
