import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isPrimarySuperAdmin } from "@/lib/super-admin-scope";
import Sidebar from "@/components/Sidebar";
import ReaderConsole from "@/components/ReaderConsole";
import SignOutButton from "@/components/SignOutButton";

function readerMode(mode: string) {
  if (mode === "REGISTER") return "Registration";
  if (mode === "ENTRY_EXIT") return "Entry / Exit";
  if (mode === "EXIT") return "Exit";
  return "Entry";
}

export default async function AccessControlPage() {
  const user = await getCurrentUser();
  if (!user || !["SUPER_ADMIN", "BUILDING_ADMIN"].includes(user.role)) redirect("/dashboard");

  const primary = user.role === "SUPER_ADMIN" && isPrimarySuperAdmin(user);
  const where = user.role === "SUPER_ADMIN"
    ? (primary ? { enabled: true, buildingId: { not: null } } : { enabled: true, building: { superAdminId: user.id } })
    : { enabled: true, buildingId: user.buildingId || "__none__" };

  const readers = await prisma.rfidReader.findMany({
    where,
    orderBy: { deviceNumber: "asc" },
    include: { building: { select: { name: true } } },
  });

  return <main className="dashboard-page">
    <Sidebar role={user.role} canCreateSuperAdmins={primary} />
    <section className="dashboard-main">
      <header className="topbar">
        <div><div className="section-kicker">BUILDING PARKING</div><h1>RFID access</h1></div>
        <SignOutButton />
      </header>

      <div className="rfid-reader-console">
        <ReaderConsole />
      </div>

      <section className="rfid-reader-details-card">
        <div className="rfid-reader-details-head">
          <div className="section-kicker">RFID READERS</div>
          <div className="rfid-reader-count"><span>Configured</span><strong>{readers.length}</strong></div>
        </div>

        <div className="rfid-reader-table-wrap">
          <table className="rfid-reader-table">
            <thead>
              <tr>
                <th>Reader</th>
                <th>Device Number</th>
                <th>IP Address</th>
                <th>Building</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Last Contact</th>
              </tr>
            </thead>
            <tbody>
              {readers.map((reader) => <tr key={reader.id}>
                <td>
                  <div className="rfid-reader-name-cell">
                    <span className="rfid-reader-dot enabled" />
                    <strong>{reader.name}</strong>
                  </div>
                </td>
                <td><span className="rfid-reader-code">{reader.deviceNumber}</span></td>
                <td>{reader.readerIp || <span className="rfid-reader-muted">Not detected</span>}</td>
                <td>{reader.building?.name || <span className="rfid-reader-muted">Not assigned</span>}</td>
                <td><span className="rfid-reader-mode-pill">{readerMode(reader.mode)}</span></td>
                <td><span className="rfid-reader-status-pill approved">Approved</span></td>
                <td>{reader.lastSeenAt ? reader.lastSeenAt.toLocaleString() : <span className="rfid-reader-muted">No heartbeat yet</span>}</td>
              </tr>)}
              {!readers.length ? <tr><td colSpan={7} className="rfid-reader-empty-row">No readers have been added yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <style>{`
        .rfid-reader-details-card{margin-top:18px;border:1px solid #d4ded8;border-radius:9px;background:#fff;overflow:hidden;box-shadow:0 8px 22px rgba(28,47,36,.045)}
        .rfid-reader-details-head{min-height:46px;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:9px 14px;border-bottom:1px solid #dde5e0}
        .rfid-reader-details-head .section-kicker{margin:0;font-size:10px}
        .rfid-reader-count{display:flex;align-items:center;gap:7px;padding:4px 8px;border:1px solid #d6e0da;border-radius:7px;background:#f7faf8;white-space:nowrap}
        .rfid-reader-count span{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.45px;color:#6e7a73}
        .rfid-reader-count strong{font-size:14px;line-height:1;color:#7c46ac}
        .rfid-reader-table-wrap{width:100%;overflow-x:auto}
        .rfid-reader-table{width:100%;min-width:790px;border-collapse:collapse;table-layout:fixed}
        .rfid-reader-table th{padding:8px 11px;background:#f2f6f4;color:#5d6b63;font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;text-align:left;white-space:nowrap}
        .rfid-reader-table td{padding:9px 11px;border-top:1px solid #e6ece8;color:#27372f;font-size:11.5px;vertical-align:middle}
        .rfid-reader-table tbody tr:first-child td{border-top:0}
        .rfid-reader-table tbody tr:hover td{background:#fbfdfc}
        .rfid-reader-table th:nth-child(1){width:14%}
        .rfid-reader-table th:nth-child(2){width:15%}
        .rfid-reader-table th:nth-child(3){width:14%}
        .rfid-reader-table th:nth-child(4){width:16%}
        .rfid-reader-table th:nth-child(5){width:11%}
        .rfid-reader-table th:nth-child(6){width:12%}
        .rfid-reader-table th:nth-child(7){width:18%}
        .rfid-reader-name-cell{display:flex;align-items:center;gap:7px;min-width:0}
        .rfid-reader-name-cell strong{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .rfid-reader-dot{width:7px;height:7px;border-radius:50%;flex:0 0 auto}
        .rfid-reader-dot.enabled{background:#19a66e;box-shadow:0 0 0 3px rgba(25,166,110,.10)}
        .rfid-reader-code{display:inline-flex;padding:3px 7px;border-radius:5px;background:#f3eef8;color:#6d3998;font-size:10px;font-weight:800;letter-spacing:.15px}
        .rfid-reader-mode-pill,.rfid-reader-status-pill{display:inline-flex;align-items:center;justify-content:center;padding:4px 7px;border-radius:999px;font-size:9px;font-weight:800;white-space:nowrap}
        .rfid-reader-mode-pill{background:#eef4fb;color:#315f8b;border:1px solid #d7e4f2}
        .rfid-reader-status-pill.approved{background:#edf8f2;color:#176b4d;border:1px solid #cbe8d8}
        .rfid-reader-muted{color:#87928c}
        .rfid-reader-empty-row{text-align:center!important;padding:26px!important;color:#7a8780!important}
        @media(max-width:760px){
          .rfid-reader-details-head{padding:8px 11px}
          .rfid-reader-count span{display:none}
          .rfid-reader-table th,.rfid-reader-table td{padding-left:8px;padding-right:8px}
        }
      `}</style>
    </section>
  </main>;
}
