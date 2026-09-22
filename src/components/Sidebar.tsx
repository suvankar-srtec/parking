"use client";

import type { UserRole } from "@prisma/client";
import Link from "@/components/AppLink";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import SidebarReaderStatus from "./SidebarReaderStatus";
import { dashboardLabel, roleLabel } from "@/lib/roles";
import { defaultPermissionsForRole } from "@/lib/permissions";

type IconName =
  | "dashboard"
  | "building"
  | "parking"
  | "shield"
  | "reader"
  | "gate"
  | "card"
  | "activity"
  | "report"
  | "admin";

function NavIcon({ name }: { name: IconName }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "dashboard") return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>;
  if (name === "building") return <svg {...common}><path d="M4 21V5.5L12 3v18"/><path d="M12 8h8v13"/><path d="M7 8h2M7 12h2M7 16h2M15 11h2M15 15h2M3 21h18"/></svg>;
  if (name === "parking") return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M9 17V7h4.2a3.2 3.2 0 0 1 0 6.4H9"/><path d="M9 13.4h4.2"/></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 3 19 6v5c0 4.6-2.9 8.3-7 10-4.1-1.7-7-5.4-7-10V6l7-3Z"/><path d="m9.2 12 1.8 1.8 4-4"/></svg>;
  if (name === "reader") return <svg {...common}><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 7h6M8 17h8"/><path d="M9 11.5c1.6-1.5 4.4-1.5 6 0M10.5 14c.8-.7 2.2-.7 3 0"/></svg>;
  if (name === "gate") return <svg {...common}><path d="M4 21V5h16v16"/><path d="M8 21V9h8v12M8 13h8M8 17h8"/></svg>;
  if (name === "card") return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 9h18M7 14h4"/></svg>;
  if (name === "activity") return <svg {...common}><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>;
  if (name === "report") return <svg {...common}><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 11h6M9 15h6M9 18h4"/></svg>;
  return <svg {...common}><circle cx="12" cy="8" r="3.5"/><path d="M5 21c.8-4.1 3.2-6 7-6s6.2 1.9 7 6"/><path d="M17.5 5.5 19 4m-1.5 6.5L19 12"/></svg>;
}

function NavRow({
  icon,
  label,
  end,
}: {
  icon: IconName;
  label: ReactNode;
  end?: ReactNode;
}) {
  return <>
    <span className="sidebar-nav-icon"><NavIcon name={icon} /></span>
    <span className="sidebar-nav-label">{label}</span>
    {end ? <span className="sidebar-nav-end">{end}</span> : null}
  </>;
}

export default function Sidebar({
  role = "SUPER_ADMIN",
  dashboardHref = "/dashboard",
  canCreateSuperAdmins = false,
  permissions,
}: {
  role?: UserRole;
  dashboardHref?: string;
  canCreateSuperAdmins?: boolean;
  permissions?: string[];
}) {
  const pathname = usePathname();
  const assigned = new Set(permissions ?? defaultPermissionsForRole(role));
  const isSuperAdmin = role === "SUPER_ADMIN";

  const dashboardPageActive = pathname === dashboardHref || pathname.startsWith(`${dashboardHref}/`);
  const supervisorParkingActive = role === "EMPLOYEE" && (pathname === "/dashboard/employee-parking" || pathname.startsWith("/dashboard/employee-parking/"));
  const adminParkingActive = role === "BUILDING_ADMIN" && (pathname === "/dashboard/parking-allocation" || pathname.startsWith("/dashboard/parking-allocation/"));
  const companyParkingActive = (role === "COMPANY_ADMIN" || role === "BUILDING_OWNER") && (pathname === "/dashboard/company-parking" || pathname.startsWith("/dashboard/company-parking/"));
  const dashboardLinkActive = role === "EMPLOYEE" || role === "BUILDING_ADMIN" || role === "COMPANY_ADMIN" || role === "BUILDING_OWNER"
    ? pathname === dashboardHref
    : dashboardPageActive;
  const superAdminsActive = pathname === "/super-admins" || pathname.startsWith("/super-admins/");
  const dashboardGroupActive = dashboardPageActive || superAdminsActive;
  const accessGroupActive = pathname === "/access-control" || pathname.startsWith("/access-control/");
  const reportsActive = pathname === "/reports" || pathname.startsWith("/reports/");

  const [expanded, setExpanded] = useState({
    dashboard: dashboardGroupActive,
    access: accessGroupActive,
  });

  useEffect(() => {
    setExpanded((current) => ({
      dashboard: dashboardGroupActive ? true : current.dashboard,
      access: accessGroupActive ? true : current.access,
    }));
  }, [dashboardGroupActive, accessGroupActive]);

  function toggle(section: keyof typeof expanded) {
    setExpanded((current) => ({ ...current, [section]: !current[section] }));
  }

  const showAccess = isSuperAdmin || (role === "BUILDING_ADMIN" && assigned.has("building.configureReaders"));
  const showSupervisorParking = role === "EMPLOYEE" && assigned.has("supervisor.employeeParking");
  const showAdminParking = role === "BUILDING_ADMIN"
    && assigned.has("building.allocateCompanyParking")
    && assigned.has("building.manageOwnerParking");
  const showCompanyParking = (role === "COMPANY_ADMIN" || role === "BUILDING_OWNER")
    && assigned.has("company.allocateEmployeeParking");
  const showReports = isSuperAdmin
    || (role === "BUILDING_ADMIN" && assigned.has("building.viewReports"))
    || ((role === "COMPANY_ADMIN" || role === "BUILDING_OWNER") && assigned.has("company.viewReports"))
    || (role === "EMPLOYEE" && assigned.has("supervisor.viewReports"));
  const showReaderStatus = showAccess || (role === "EMPLOYEE" && assigned.has("supervisor.readerStatus"));
  const roleClass = `sidebar-${role.toLowerCase().replaceAll("_", "-")}`;
  const isAccessPage = (href: string) => pathname === href || (href !== "/access-control" && pathname.startsWith(href + "/"));

  const dashboardIcon: IconName = role === "SUPER_ADMIN"
    ? "building"
    : role === "EMPLOYEE"
      ? "activity"
      : "dashboard";

  return <aside className={`sidebar sidebar-shell ${roleClass}`}>
    <div className="sidebar-brand">
      <div className="logo-box" aria-hidden="true">S</div>
      <div className="sidebar-brand-copy">
        <strong>SRTEC Access Control</strong>
        <span className="sidebar-role-pill">{roleLabel(role)}</span>
      </div>
    </div>

    <div className="sidebar-divider" />

    <nav className="sidebar-nav" aria-label="Main navigation">
      <div className="sidebar-nav-group">
        <button
          type="button"
          className={`sidebar-nav-parent${dashboardGroupActive ? " is-active" : ""}`}
          aria-expanded={expanded.dashboard}
          aria-controls="dashboard-menu"
          onClick={() => toggle("dashboard")}
        >
          <NavRow
            icon="dashboard"
            label="Dashboard"
            end={<span className={`sidebar-chevron${expanded.dashboard ? " is-open" : ""}`} aria-hidden="true" />}
          />
        </button>

        <div
          id="dashboard-menu"
          className={`sidebar-submenu${expanded.dashboard ? " is-open" : ""}`}
          hidden={!expanded.dashboard}
        >
          <Link
            className={`sidebar-submenu-link${dashboardLinkActive ? " is-active" : ""}`}
            href={dashboardHref}
          >
            <NavRow icon={dashboardIcon} label={dashboardLabel(role)} />
          </Link>

          {showAdminParking ? <Link
            className={`sidebar-submenu-link${adminParkingActive ? " is-active" : ""}`}
            href="/dashboard/parking-allocation"
          >
            <NavRow icon="parking" label="Parking allocation" />
          </Link> : null}

          {showCompanyParking ? <Link
            className={`sidebar-submenu-link${companyParkingActive ? " is-active" : ""}`}
            href="/dashboard/company-parking"
          >
            <NavRow icon="parking" label="Parking allocation" />
          </Link> : null}

          {showSupervisorParking ? <Link
            className={`sidebar-submenu-link${supervisorParkingActive ? " is-active" : ""}`}
            href="/dashboard/employee-parking"
          >
            <NavRow icon="parking" label="Employee parking" />
          </Link> : null}

          {canCreateSuperAdmins ? <Link
            className={`sidebar-submenu-link${superAdminsActive ? " is-active" : ""}`}
            href="/super-admins"
          >
            <NavRow icon="admin" label="Create Super Admin" />
          </Link> : null}
        </div>
      </div>

      {showAccess ? <div className="sidebar-nav-group">
        <button
          type="button"
          className={`sidebar-nav-parent${accessGroupActive ? " is-active" : ""}`}
          aria-expanded={expanded.access}
          aria-controls="access-menu"
          onClick={() => toggle("access")}
        >
          <NavRow
            icon="shield"
            label="Access Control"
            end={<span className={`sidebar-chevron${expanded.access ? " is-open" : ""}`} aria-hidden="true" />}
          />
        </button>

        <div
          id="access-menu"
          className={`sidebar-submenu${expanded.access ? " is-open" : ""}`}
          hidden={!expanded.access}
        >
          <Link
            className={`sidebar-submenu-link${isAccessPage("/access-control") ? " is-active" : ""}`}
            href="/access-control"
          >
            <NavRow icon="reader" label="Device / Reader" />
          </Link>
          <Link
            className={`sidebar-submenu-link${isAccessPage("/access-control/gate-details") ? " is-active" : ""}`}
            href="/access-control/gate-details"
          >
            <NavRow icon="gate" label="Gate Details" />
          </Link>
          <Link
            className={`sidebar-submenu-link${isAccessPage("/access-control/register-cards") ? " is-active" : ""}`}
            href="/access-control/register-cards"
          >
            <NavRow icon="card" label="Register cards" />
          </Link>
          <Link
            className={`sidebar-submenu-link${isAccessPage("/access-control/activity") ? " is-active" : ""}`}
            href="/access-control/activity"
          >
            <NavRow icon="activity" label="Real Time Monitor" />
          </Link>
        </div>
      </div> : null}

      {showReports ? <Link
        className={`sidebar-nav-link${reportsActive ? " is-active" : ""}`}
        href="/reports"
      >
        <NavRow icon="report" label="Reports" />
      </Link> : null}
    </nav>

    {showReaderStatus
      ? (role === "EMPLOYEE"
        ? <SidebarReaderStatus endpoint="/api/supervisor/readers" title="Allotted Reader" linkToAccess={false} />
        : <SidebarReaderStatus />)
      : null}

    <style>{`
      .sidebar-shell{
        --sidebar-bg:#2f203f;
        --sidebar-bg-deep:#281936;
        --sidebar-accent:#9b61c8;
        --sidebar-accent-soft:#b987df;
        --sidebar-text:#f7f2fa;
        --sidebar-muted:#cfc1d8;
        --sidebar-line:rgba(255,255,255,.11);
        height:100vh;
        min-height:100vh;
        position:sticky;
        top:0;
        overflow:hidden;
        padding:14px 12px 11px;
        background:
          radial-gradient(circle at 15% -5%,rgba(171,106,215,.25),transparent 28%),
          linear-gradient(180deg,var(--sidebar-bg) 0%,var(--sidebar-bg-deep) 100%);
        box-shadow:9px 0 28px rgba(35,20,46,.08);
      }

      .sidebar-shell .sidebar-brand{
        display:flex;
        align-items:center;
        gap:10px;
        padding:2px 5px 12px;
      }

      .sidebar-shell .logo-box{
        width:39px;
        height:39px;
        flex:0 0 39px;
        display:grid;
        place-items:center;
        border:1px solid rgba(255,255,255,.18);
        border-radius:10px;
        background:linear-gradient(145deg,#ffd45d,#e9b92f);
        color:#35220d;
        font-size:16px;
        font-weight:900;
        box-shadow:0 8px 18px rgba(0,0,0,.16);
      }

      .sidebar-brand-copy{
        min-width:0;
        display:grid;
        gap:5px;
      }

      .sidebar-brand-copy strong{
        color:#fff;
        font-size:12.5px;
        line-height:1.2;
        letter-spacing:.1px;
      }

      .sidebar-role-pill{
        justify-self:start;
        display:inline-flex!important;
        align-items:center;
        min-height:18px;
        margin:0!important;
        padding:3px 7px;
        border:1px solid rgba(255,255,255,.1);
        border-radius:999px;
        background:rgba(255,255,255,.08);
        color:#e9dff0!important;
        font-size:8.5px!important;
        font-weight:800;
        letter-spacing:.35px;
        text-transform:uppercase;
      }

      .sidebar-divider{
        height:1px;
        margin:0 3px 11px;
        background:linear-gradient(90deg,transparent,var(--sidebar-line) 12%,var(--sidebar-line) 88%,transparent);
      }

      .sidebar-shell .sidebar-nav{
        flex:1 1 auto;
        min-height:0;
        display:flex;
        flex-direction:column;
        gap:6px;
        overflow-y:auto;
        overflow-x:hidden;
        padding:0 1px 10px;
        scrollbar-width:none;
      }

      .sidebar-shell .sidebar-nav::-webkit-scrollbar{display:none}

      .sidebar-nav-group{
        display:grid;
        gap:4px;
      }

      .sidebar-nav-parent,
      .sidebar-nav-link,
      .sidebar-submenu-link{
        width:100%;
        min-width:0;
        display:grid;
        grid-template-columns:28px minmax(0,1fr) auto;
        align-items:center;
        gap:7px;
        border:0;
        text-align:left;
        text-decoration:none;
        transition:background .15s ease,color .15s ease,transform .15s ease,border-color .15s ease,box-shadow .15s ease;
      }

      .sidebar-nav-parent,
      .sidebar-nav-link{
        min-height:40px;
        padding:7px 9px;
        border:1px solid transparent;
        border-radius:9px;
        background:transparent;
        color:var(--sidebar-text);
        font-size:11.5px;
        font-weight:750;
      }

      .sidebar-nav-parent:hover,
      .sidebar-nav-link:hover{
        background:rgba(255,255,255,.07);
        color:#fff;
      }

      .sidebar-nav-parent.is-active,
      .sidebar-nav-link.is-active{
        border-color:rgba(255,255,255,.12);
        background:linear-gradient(90deg,rgba(151,86,197,.30),rgba(255,255,255,.07));
        color:#fff;
        box-shadow:inset 3px 0 0 var(--sidebar-accent-soft);
      }

      .sidebar-nav-icon{
        width:28px;
        height:28px;
        display:grid;
        place-items:center;
        border-radius:7px;
        color:#cbb1dd;
        background:rgba(255,255,255,.045);
      }

      .is-active>.sidebar-nav-icon,
      .sidebar-nav-parent.is-active .sidebar-nav-icon{
        color:#fff;
        background:rgba(174,111,218,.24);
      }

      .sidebar-nav-label{
        min-width:0;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .sidebar-nav-end{
        display:grid;
        place-items:center;
      }

      .sidebar-chevron{
        width:7px;
        height:7px;
        display:block;
        border-right:1.7px solid currentColor;
        border-bottom:1.7px solid currentColor;
        transform:rotate(45deg) translate(-1px,-1px);
        transform-origin:center;
        transition:transform .2s ease;
        opacity:.85;
      }

      .sidebar-chevron.is-open{
        transform:rotate(225deg) translate(-1px,-1px);
      }

      .sidebar-submenu{
        position:relative;
        display:grid;
        gap:3px;
        padding:2px 0 3px 15px;
      }

      .sidebar-submenu[hidden]{display:none}

      .sidebar-submenu:before{
        content:"";
        position:absolute;
        left:14px;
        top:4px;
        bottom:6px;
        width:1px;
        background:rgba(208,180,226,.20);
      }

      .sidebar-submenu-link{
        position:relative;
        min-height:34px;
        margin-left:7px;
        width:calc(100% - 7px);
        padding:5px 8px 5px 10px;
        border:1px solid transparent;
        border-radius:8px;
        color:#d7cadd;
        background:transparent;
        font-size:10.5px;
        font-weight:650;
      }

      .sidebar-submenu-link:before{
        content:"";
        position:absolute;
        left:-9px;
        top:50%;
        width:8px;
        height:1px;
        background:rgba(208,180,226,.22);
      }

      .sidebar-submenu-link .sidebar-nav-icon{
        width:25px;
        height:25px;
        border-radius:6px;
        background:transparent;
        color:#bda5cd;
      }

      .sidebar-submenu-link:hover{
        background:rgba(255,255,255,.065);
        color:#fff;
      }

      .sidebar-submenu-link.is-active{
        border-color:rgba(255,255,255,.13);
        background:#fff;
        color:#352245;
        box-shadow:0 5px 14px rgba(22,10,29,.13);
        font-weight:800;
      }

      .sidebar-submenu-link.is-active .sidebar-nav-icon{
        background:#f1e8f7;
        color:#7c46ac;
      }

      .sidebar-shell :global(.sidebar-reader-status){
        flex:0 0 auto;
        margin-top:7px!important;
        padding:10px 6px 1px!important;
        border-top:1px solid rgba(255,255,255,.12)!important;
      }

      .sidebar-shell :global(.sidebar-reader-title){
        color:#d8c9e2!important;
        font-size:9px!important;
        letter-spacing:.35px;
        text-transform:uppercase;
      }

      .sidebar-shell :global(.sidebar-reader-item){
        color:#eee7f3!important;
        font-size:9.5px!important;
      }

      .sidebar-shell :global(.sidebar-reader-item strong){color:#fff!important}

      .sidebar-nav-parent:focus-visible,
      .sidebar-nav-link:focus-visible,
      .sidebar-submenu-link:focus-visible{
        outline:2px solid #d7b3ef;
        outline-offset:2px;
      }

      @media(max-height:760px) and (min-width:951px){
        .sidebar-shell{padding-top:10px;padding-bottom:8px}
        .sidebar-shell .sidebar-brand{padding-bottom:8px}
        .sidebar-divider{margin-bottom:8px}
        .sidebar-shell .sidebar-nav{gap:4px}
        .sidebar-nav-parent,.sidebar-nav-link{min-height:35px;padding:5px 8px}
        .sidebar-nav-icon{width:25px;height:25px}
        .sidebar-submenu-link{min-height:30px;padding-top:3px;padding-bottom:3px}
        .sidebar-submenu-link .sidebar-nav-icon{width:23px;height:23px}
      }

      @media(max-width:950px){
        .sidebar-shell{
          height:auto;
          min-height:auto;
          position:relative;
          overflow:visible;
          border-radius:0 0 14px 14px;
        }

        .sidebar-shell .sidebar-nav{
          overflow:visible;
          padding-bottom:4px;
        }

        .sidebar-shell :global(.sidebar-reader-status){
          margin-top:10px!important;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .sidebar-nav-parent,
        .sidebar-nav-link,
        .sidebar-submenu-link,
        .sidebar-chevron{transition:none}
      }
    `}</style>
  </aside>;
}
