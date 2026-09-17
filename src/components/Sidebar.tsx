"use client";

import type { UserRole } from "@prisma/client";
import Link from "@/components/AppLink";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import SidebarReaderStatus from "./SidebarReaderStatus";
import { dashboardLabel, roleLabel } from "@/lib/roles";
import { defaultPermissionsForRole } from "@/lib/permissions";

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
  const dashboardLinkActive = role === "EMPLOYEE" || role === "BUILDING_ADMIN" ? pathname === dashboardHref : dashboardPageActive;
  const superAdminsActive = pathname === "/super-admins" || pathname.startsWith("/super-admins/");
  const dashboardGroupActive = dashboardPageActive || superAdminsActive;
  const accessGroupActive = pathname === "/access-control" || pathname.startsWith("/access-control/");
  const reportsActive = pathname === "/reports" || pathname.startsWith("/reports/");

  const [expanded, setExpanded] = useState({ dashboard: dashboardGroupActive, access: accessGroupActive });

  useEffect(() => {
    setExpanded((current) => ({ dashboard: dashboardGroupActive ? true : current.dashboard, access: accessGroupActive ? true : current.access }));
  }, [dashboardGroupActive, accessGroupActive]);

  function toggle(section: keyof typeof expanded) {
    setExpanded((current) => ({ ...current, [section]: !current[section] }));
  }

  const showAccess = isSuperAdmin || (role === "BUILDING_ADMIN" && assigned.has("building.configureReaders"));
  const showSupervisorParking = role === "EMPLOYEE" && assigned.has("supervisor.employeeParking");
  const showAdminParking = role === "BUILDING_ADMIN" && assigned.has("building.allocateCompanyParking") && assigned.has("building.manageOwnerParking");
  const showReports = isSuperAdmin ||
    (role === "BUILDING_ADMIN" && assigned.has("building.viewReports")) ||
    ((role === "COMPANY_ADMIN" || role === "BUILDING_OWNER") && assigned.has("company.viewReports")) ||
    (role === "EMPLOYEE" && assigned.has("supervisor.viewReports"));
  const showReaderStatus = showAccess || (role === "EMPLOYEE" && assigned.has("supervisor.readerStatus"));
  const roleClass = `sidebar-${role.toLowerCase().replaceAll("_", "-")}`;
  const isAccessPage = (href: string) => pathname === href;

  return <aside className={`sidebar ${roleClass}`}>
    <div className="sidebar-brand"><div className="logo-box" aria-hidden="true">S</div><div><strong>SRTEC Access Control</strong><span>{roleLabel(role)}</span></div></div>
    <div className="sidebar-line" />
    <nav aria-label="Main navigation">
      <div className="menu-group">
        <button type="button" className={`menu-button menu-button-main menu-toggle${dashboardGroupActive ? " sidebar-parent-active" : ""}`} aria-expanded={expanded.dashboard} aria-controls="dashboard-menu" onClick={() => toggle("dashboard")}>
          <span>Dashboard</span><span className="menu-chevron" aria-hidden="true" />
        </button>
        <div id="dashboard-menu" className="menu-items" hidden={!expanded.dashboard}>
          <Link className={`menu-button menu-button-sub${dashboardLinkActive ? " active-menu" : " dark-menu"}`} href={dashboardHref}>{dashboardLabel(role)}</Link>
          {showAdminParking ? <Link className={`menu-button menu-button-sub${adminParkingActive ? " active-menu" : " dark-menu"}`} href="/dashboard/parking-allocation">Parking allocation</Link> : null}
          {showSupervisorParking ? <Link className={`menu-button menu-button-sub${supervisorParkingActive ? " active-menu" : " dark-menu"}`} href="/dashboard/employee-parking">Employee Parking Allocation</Link> : null}
          {canCreateSuperAdmins ? <Link className={`menu-button menu-button-sub dark-menu${superAdminsActive ? " active-menu" : ""}`} href="/super-admins">Create Super Admin</Link> : null}
        </div>
      </div>

      {showAccess ? <div className="menu-group">
        <button type="button" className={`menu-section-title menu-toggle${accessGroupActive ? " sidebar-section-active" : ""}`} aria-expanded={expanded.access} aria-controls="access-menu" onClick={() => toggle("access")}>
          <span>Access Control</span><span className="menu-chevron" aria-hidden="true" />
        </button>
        <div id="access-menu" className="menu-items" hidden={!expanded.access}>
          <Link className={`menu-button dark-menu${isAccessPage("/access-control") ? " active-menu" : ""}`} href="/access-control">Device / Reader</Link>
          <Link className={`menu-button dark-menu${isAccessPage("/access-control/gate-details") ? " active-menu" : ""}`} href="/access-control/gate-details">Gate Details</Link>
          <Link className={`menu-button dark-menu${isAccessPage("/access-control/register-cards") ? " active-menu" : ""}`} href="/access-control/register-cards">Register cards</Link>
          <Link className={`menu-button dark-menu${isAccessPage("/access-control/activity") ? " active-menu" : ""}`} href="/access-control/activity">Real Time Monitor</Link>
        </div>
      </div> : null}
      {showReports ? <Link className={`menu-button menu-button-main report-nav-item${reportsActive ? " active-menu" : ""}`} href="/reports"><span>Reports</span></Link> : null}
    </nav>
    {showReaderStatus ? (role === "EMPLOYEE" ? <SidebarReaderStatus endpoint="/api/supervisor/readers" title="Allotted Reader" linkToAccess={false} /> : <SidebarReaderStatus />) : null}

    <style>{`
      .sidebar{height:100vh;min-height:100vh;position:sticky;top:0;overflow:hidden;padding:14px 12px 12px}.sidebar .sidebar-brand{gap:10px;padding:0 7px 12px}.sidebar .logo-box{width:38px;height:38px;flex-shrink:0}.sidebar .sidebar-brand>div:last-child{min-width:0}.sidebar .sidebar-brand strong{font-size:13px;line-height:1.3;white-space:normal}.sidebar .sidebar-brand span{font-size:10.5px;margin-top:2px}.sidebar .sidebar-line{margin-bottom:12px}.sidebar nav{display:flex;flex-direction:column;gap:5px;min-height:0;overflow:visible;scrollbar-width:none}.sidebar nav::-webkit-scrollbar{display:none}.sidebar .menu-group{gap:5px}.sidebar .menu-items{gap:5px}.sidebar .menu-button,.sidebar .menu-section-title{font-size:12px;line-height:1.2;border-radius:7px}.sidebar .menu-button{padding:8px 10px}.sidebar .menu-button-main{min-height:35px}.sidebar .report-nav-item{margin:0;width:100%;color:#eee7f1;background:transparent;border:1px solid transparent;font-weight:700;text-align:left;justify-content:flex-start}.sidebar .report-nav-item:hover{background:rgba(255,255,255,.08);color:#fff}.sidebar .report-nav-item.active-menu{background:#fff;color:#352245;border-color:#fff;box-shadow:inset 4px 0 0 #9a58c8;font-weight:800}.sidebar .menu-button-sub,.sidebar .dark-menu{margin-left:10px;width:calc(100% - 10px);font-size:11px;padding:8px 10px}.sidebar .menu-section-title{min-height:32px;padding:8px 10px;color:#eee7f1;font-size:12.5px;font-weight:700;align-items:center}.sidebar .menu-toggle.menu-section-title{padding-bottom:8px}.sidebar .menu-chevron{width:6px;height:6px;border-width:0 1.5px 1.5px 0;margin-right:2px}.sidebar .sidebar-parent-active{box-shadow:inset 4px 0 0 #8a4dbc}.sidebar .sidebar-section-active{background:rgba(255,255,255,.10);color:#fff}.sidebar .dark-menu.active-menu,.sidebar .menu-button-sub.active-menu{background:#fff;color:#352245;border-color:#fff;font-weight:800}.sidebar .dark-menu.active-menu{box-shadow:inset 4px 0 0 #9a58c8}@media(max-height:760px) and (min-width:951px){.sidebar{padding-top:10px;padding-bottom:8px}.sidebar .sidebar-brand{padding-bottom:9px}.sidebar .sidebar-line{margin-bottom:8px}.sidebar nav,.sidebar .menu-group,.sidebar .menu-items{gap:3px}.sidebar .menu-button{padding:6px 9px}.sidebar .menu-button-main{min-height:31px}.sidebar .menu-button-sub,.sidebar .dark-menu{padding:6px 9px;font-size:10.5px}.sidebar .menu-section-title{min-height:29px;padding:6px 9px;font-size:12px}.sidebar .menu-toggle.menu-section-title{padding-bottom:6px}}@media(max-width:950px){.sidebar{height:auto;min-height:auto;position:relative;overflow:visible}}
    `}</style>
  </aside>;
}
