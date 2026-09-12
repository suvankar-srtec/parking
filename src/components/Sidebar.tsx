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
        <div id="dashboard-menu" className="menu-items" hidden={!expanded.dashboard}><Link className="menu-button menu-button-sub active-menu" href={dashboardHref}>{dashboardLabel(role)}</Link></div>
      </div>

      {canCreateSuperAdmins ? <Link className="menu-section-title" href="/super-admins"><span>Create Super Admin</span></Link> : null}

      {showPersonal ? <div className="menu-group">
        <button type="button" className="menu-section-title menu-toggle" aria-expanded={expanded.personal} aria-controls="personal-menu" onClick={() => toggle("personal")}><span>Personal</span><span className="menu-chevron" aria-hidden="true" /></button>
        <div id="personal-menu" className="menu-items" hidden={!expanded.personal}><Link className="menu-button dark-menu" href="/dashboard">{personalLabel}</Link></div>
      </div> : null}

      {showAccess ? <div className="menu-group">
        <button type="button" className="menu-section-title menu-toggle" aria-expanded={expanded.access} aria-controls="access-menu" onClick={() => toggle("access")}><span>Access Control</span><span className="menu-chevron" aria-hidden="true" /></button>
        <div id="access-menu" className="menu-items" hidden={!expanded.access}>
          <Link className="menu-button dark-menu" href="/access-control">RFID devices</Link>
          <Link className="menu-button dark-menu" href="/access-control/register-cards">Register cards</Link>
          <Link className="menu-button dark-menu" href="/access-control#activity">Real Time Monitor</Link>
        </div>
      </div> : null}
      <Link className="menu-section-title" href="/reports"><span>{role === "EMPLOYEE" ? "Reports" : "Reports"}</span></Link>
    </nav>
    {showReaderStatus ? <ReaderConsole compact /> : null}
  </aside>;
}
