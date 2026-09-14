"use client";

import type { UserRole } from "@prisma/client";
import Link from "@/components/AppLink";
import { useState } from "react";
import ReaderConsole from "./ReaderConsole";
import { canConfigureReaders, dashboardLabel, roleLabel } from "@/lib/roles";

export default function Sidebar({
  role = "SUPER_ADMIN",
  dashboardHref = "/dashboard",
  canCreateSuperAdmins = false,
}: { role?: UserRole; dashboardHref?: string; canCreateSuperAdmins?: boolean }) {
  const [expanded, setExpanded] = useState({ dashboard: true, personal: false, access: false });
  function toggle(section: keyof typeof expanded) { setExpanded((current) => ({ ...current, [section]: !current[section] })); }

  const showPersonal = role !== "EMPLOYEE";
  const showAccess = canConfigureReaders(role);
  const showReaderStatus = showAccess || role === "COMPANY_ADMIN" || role === "BUILDING_OWNER";
  const personalLabel = role === "SUPER_ADMIN" ? "Admin / Company / Supervisor" : role === "BUILDING_ADMIN" ? "Company / Supervisor" : "Employees / Company Owners";
  const roleClass = `sidebar-${role.toLowerCase().replaceAll("_", "-")}`;

  return <aside className={`sidebar ${roleClass}`}>
    <div className="sidebar-brand"><div className="logo-box">P</div><div><strong>ParkControl</strong><span>{roleLabel(role)}</span></div></div>
    <div className="sidebar-line" />
    <nav aria-label="Main navigation">
      <div className="menu-group">
        <button type="button" className="menu-button menu-button-main menu-toggle" aria-expanded={expanded.dashboard} aria-controls="dashboard-menu" onClick={() => toggle("dashboard")}><span>Dashboard</span><span className="menu-chevron" aria-hidden="true" /></button>
        <div id="dashboard-menu" className="menu-items" hidden={!expanded.dashboard}>
          <Link className="menu-button menu-button-sub active-menu" href={dashboardHref}>{dashboardLabel(role)}</Link>
          {canCreateSuperAdmins ? <Link className="menu-button menu-button-sub dark-menu" href="/super-admins">Create Super Admin</Link> : null}
        </div>
      </div>

      {showPersonal ? <div className="menu-group">
        <button type="button" className="menu-section-title menu-toggle" aria-expanded={expanded.personal} aria-controls="personal-menu" onClick={() => toggle("personal")}><span>Personal</span><span className="menu-chevron" aria-hidden="true" /></button>
        <div id="personal-menu" className="menu-items" hidden={!expanded.personal}><Link className="menu-button dark-menu" href="/dashboard">{personalLabel}</Link></div>
      </div> : null}

      {showAccess ? <div className="menu-group">
        <button type="button" className="menu-section-title menu-toggle" aria-expanded={expanded.access} aria-controls="access-menu" onClick={() => toggle("access")}><span>Access Control</span><span className="menu-chevron" aria-hidden="true" /></button>
        <div id="access-menu" className="menu-items" hidden={!expanded.access}>
          <Link className="menu-button dark-menu" href="/access-control">RFID devices</Link>
          <Link className="menu-button dark-menu" href="/access-control/register-cards">Register cards</Link>
          <Link className="menu-button dark-menu" href="/access-control/activity">Real Time Monitor</Link>
          <Link className="menu-button dark-menu" href="/access-control/gate-details">Gate Details</Link>
          <Link className="menu-button dark-menu" href="/access-control/reader-details">Reader Details</Link>
        </div>
      </div> : null}
      <Link className="menu-section-title" href="/reports"><span>Reports</span></Link>
    </nav>
    {showReaderStatus ? <ReaderConsole compact /> : null}

    <style>{`
      .sidebar{
        height:100vh;
        min-height:100vh;
        position:sticky;
        top:0;
        overflow:hidden;
        padding:14px 12px 12px;
      }
      .sidebar .sidebar-brand{gap:10px;padding:0 7px 12px}
      .sidebar .logo-box{width:38px;height:38px}
      .sidebar .sidebar-brand strong{font-size:14px;line-height:1.15}
      .sidebar .sidebar-brand span{font-size:10.5px;margin-top:2px}
      .sidebar .sidebar-line{margin-bottom:12px}
      .sidebar nav{
        display:flex;
        flex-direction:column;
        gap:5px;
        min-height:0;
        overflow:visible;
        scrollbar-width:none;
      }
      .sidebar nav::-webkit-scrollbar{display:none}
      .sidebar .menu-group{gap:5px}
      .sidebar .menu-items{gap:5px}
      .sidebar .menu-button,
      .sidebar .menu-section-title{
        font-size:12px;
        line-height:1.2;
        border-radius:7px;
      }
      .sidebar .menu-button{padding:8px 10px}
      .sidebar .menu-button-main{min-height:35px}
      .sidebar .menu-button-sub,
      .sidebar .dark-menu{
        margin-left:10px;
        width:calc(100% - 10px);
        font-size:11px;
        padding:8px 10px;
      }
      .sidebar .menu-section-title{
        min-height:32px;
        padding:8px 10px;
        color:#eee7f1;
        font-size:12.5px;
        font-weight:700;
        align-items:center;
      }
      .sidebar .menu-toggle.menu-section-title{padding-bottom:8px}
      .sidebar .menu-chevron{width:6px;height:6px;border-width:0 1.5px 1.5px 0;margin-right:2px}
      .sidebar .reader-panel{
        margin-top:auto;
        padding:10px 7px 2px;
        font-size:9.5px;
        line-height:1.25;
      }
      .sidebar .reader-heading{font-size:10px}
      .sidebar .reader-status-dot{width:7px;height:7px}
      @media(max-height:760px) and (min-width:951px){
        .sidebar{padding-top:10px;padding-bottom:8px}
        .sidebar .sidebar-brand{padding-bottom:9px}
        .sidebar .sidebar-line{margin-bottom:8px}
        .sidebar nav,.sidebar .menu-group,.sidebar .menu-items{gap:3px}
        .sidebar .menu-button{padding:6px 9px}
        .sidebar .menu-button-main{min-height:31px}
        .sidebar .menu-button-sub,.sidebar .dark-menu{padding:6px 9px;font-size:10.5px}
        .sidebar .menu-section-title{min-height:29px;padding:6px 9px;font-size:12px}
        .sidebar .menu-toggle.menu-section-title{padding-bottom:6px}
        .sidebar .reader-panel{padding-top:7px;font-size:9px}
      }
      @media(max-width:950px){
        .sidebar{height:auto;min-height:auto;position:relative;overflow:visible}
      }
    `}</style>
  </aside>;
}
