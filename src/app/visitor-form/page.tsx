import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SignOutButton from "@/components/SignOutButton";
import VisitorForm from "@/components/VisitorForm";
import { prisma } from "@/lib/prisma";
import { effectivePermissions } from "@/lib/permissions";
import { roleLabel } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

function formatVisitorTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(value);
}

export default async function VisitorFormPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const isBuildingAdmin = user.role === "BUILDING_ADMIN";
  const isCompanyUser = user.role === "COMPANY_ADMIN" || user.role === "BUILDING_OWNER";
  if (!isBuildingAdmin && !isCompanyUser) redirect("/dashboard");

  const permissions = effectivePermissions(user);
  let scopeLabel = "Building";
  let scopeName = "";
  let visitorWhere: { buildingId: string; companyId: null } | { companyId: string };

  if (isBuildingAdmin) {
    if (!user.buildingId) redirect("/dashboard");
    const building = await prisma.building.findUnique({
      where: { id: user.buildingId },
      select: { name: true },
    });
    if (!building) redirect("/dashboard");
    scopeName = building.name;
    visitorWhere = { buildingId: user.buildingId, companyId: null };
  } else {
    if (!user.companyId) redirect("/dashboard");
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { name: true, enabled: true, building: { select: { name: true } } },
    });
    if (!company || !company.enabled) redirect("/dashboard");
    scopeLabel = "Company";
    scopeName = company.name;
    visitorWhere = { companyId: user.companyId };
  }

  const visitors = await prisma.visitor.findMany({
    where: visitorWhere,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      email: true,
      vehicleNumber: true,
      accessory: true,
      createdAt: true,
    },
  });

  return <main className="dashboard-page">
    <Sidebar role={user.role} permissions={permissions} />
    <section className="dashboard-main">
      <header className="topbar">
        <div>
          <div className="section-kicker">{roleLabel(user.role).toUpperCase()}</div>
          <h1>Visitor Form</h1>
        </div>
        <div className="topbar-right">
          <div className="summary-card"><span>{scopeLabel}</span><strong>{scopeName}</strong></div>
          <SignOutButton />
        </div>
      </header>

      <section className="portfolio-card building-management visitor-form-card">
        <div className="portfolio-header visitor-form-heading">
          <div>
            <div className="section-kicker">VISITOR ACCESS</div>
            <h2>Visitor details</h2>
            <p>Vehicle Number is optional. All other fields are required.</p>
          </div>
        </div>
        <div className="portfolio-divider" />
        <VisitorForm />
      </section>

      <section className="portfolio-card building-management visitor-list-card">
        <div className="portfolio-header visitor-list-heading">
          <div>
            <div className="section-kicker">VISITOR LIST</div>
            <h2>Visitors</h2>
          </div>
          <span className="visitor-count">{visitors.length} {visitors.length === 1 ? "visitor" : "visitors"}</span>
        </div>
        <div className="portfolio-divider" />

        {visitors.length ? <div className="visitor-table-wrap">
          <table className="visitor-table">
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Name</th>
                <th>Phone Number</th>
                <th>Mail</th>
                <th>Vehicle Number</th>
                <th>Accessory</th>
              </tr>
            </thead>
            <tbody>
              {visitors.map((visitor) => <tr key={visitor.id}>
                <td className="visitor-date">{formatVisitorTime(visitor.createdAt)}</td>
                <td><strong>{visitor.name}</strong></td>
                <td>{visitor.phoneNumber}</td>
                <td>{visitor.email}</td>
                <td>{visitor.vehicleNumber || "—"}</td>
                <td>{visitor.accessory}</td>
              </tr>)}
            </tbody>
          </table>
        </div> : <div className="visitor-empty">No visitors added yet.</div>}
      </section>

      <style>{`
        .visitor-form-card{padding-top:15px;padding-bottom:15px}
        .visitor-form-card .portfolio-divider{margin:10px 0 12px}
        .visitor-form-heading h2{margin:3px 0 2px!important;font-size:18px!important}
        .visitor-form-heading p{font-size:10px!important}
        .visitor-list-card{padding-top:15px}
        .visitor-list-card .portfolio-divider{margin:10px 0 0}
        .visitor-list-heading{align-items:center}
        .visitor-list-heading h2{margin:3px 0 0!important;font-size:18px!important}
        .visitor-count{display:inline-flex;align-items:center;min-height:26px;padding:4px 9px;border-radius:999px;background:#f0e8f6;color:#73409e;font-size:10px;font-weight:800;white-space:nowrap}
        .visitor-table-wrap{width:100%;overflow-x:auto}
        .visitor-table{width:100%;border-collapse:collapse;table-layout:auto;font-size:11px}
        .visitor-table th{padding:9px 10px;border-bottom:1px solid #d5dfd9;background:#f6f9f7;color:#5c6a62;font-size:9px;font-weight:900;letter-spacing:.25px;text-align:left;white-space:nowrap}
        .visitor-table td{padding:9px 10px;border-bottom:1px solid #e2e8e4;color:#45564d;line-height:1.35;vertical-align:middle}
        .visitor-table tbody tr:last-child td{border-bottom:0}
        .visitor-table tbody tr:hover{background:#faf8fc}
        .visitor-table td strong{color:#25362d;font-size:11px}
        .visitor-date{white-space:nowrap;color:#718078!important;font-size:10px}
        .visitor-empty{padding:22px 12px;text-align:center;color:#78847d;font-size:11px}
        @media(max-width:760px){
          .visitor-list-heading{flex-direction:row;align-items:center}
          .visitor-table{min-width:780px}
          .visitor-form-card,.visitor-list-card{padding:13px}
        }
      `}</style>
    </section>
  </main>;
}
