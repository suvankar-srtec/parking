"use client";

import type { UserRole } from "@prisma/client";
import Link from "@/components/AppLink";
import { useState } from "react";
import ReaderConsole from "./ReaderConsole";
import { canConfigureReaders, dashboardLabel, roleLabel } from "@/lib/roles";

export default function Sidebar({
  role = "SUPER_ADMIN",
  dashboardHref = "/dashboard",
}: { role?: UserRole; dashboardHref?: string }) {
  const [expanded, setExpanded] = useState({
    dashboard: true,
    personal: false,
    access: false,
  });

  function toggle(section: keyof typeof expanded) {
    setExpanded((current) => ({ ...current, [section]: !current[section] }));
  }

  const showPersonal = role !== "EMPLOYEE";
  const showAccess = canConfigureReaders(role);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="logo-box">P</div>
        <div><strong>ParkControl</strong><span>{roleLabel(role)}</span></div>
      </div>
      <div className="sidebar-line" />
      <nav aria-label="Main navigation">
        <div className="menu-group">
          <button type="button" className="menu-button menu-button-main menu-toggle"
            aria-expanded={expanded.dashboard} aria-controls="dashboard-menu"
            onClick={() => toggle("dashboard")}>
            <span>Dashboard</span><span className="menu-chevron" aria-hidden="true" />
          </button>
          <div id="dashboard-menu" className="menu-items" hidden={!expanded.dashboard}>
            <Link className="menu-button menu-button-sub active-menu" href={dashboardHref}>{dashboardLabel(role)}</Link>
          </div>
        </div>

        {showPersonal ? <div className="menu-group">
          <button type="button" className="menu-section-title menu-toggle"
            aria-expanded={expanded.personal} aria-controls="personal-menu"
            onClick={() => toggle("personal")}>
            <span>Personal</span><span className="menu-chevron" aria-hidden="true" />
          </button>
          <div id="personal-menu" className="menu-items" hidden={!expanded.personal}>
            <Link className="menu-button dark-menu" href="/dashboard">Account overview</Link>
          </div>
        </div> : null}

        {showAccess ? <div className="menu-group">
          <button type="button" className="menu-section-title menu-toggle"
            aria-expanded={expanded.access} aria-controls="access-menu"
            onClick={() => toggle("access")}>
            <span>Access Control</span><span className="menu-chevron" aria-hidden="true" />
          </button>
          <div id="access-menu" className="menu-items" hidden={!expanded.access}>
            <Link className="menu-button dark-menu" href="/access-control">RFID devices</Link>
            <Link className="menu-button dark-menu" href="/access-control#activity">Real Time Monitor</Link>
          </div>
        </div> : null}
        <Link className="menu-section-title" href="/reports"><span>Report</span></Link>
      </nav>
      {showAccess ? <ReaderConsole compact /> : null}
    </aside>
  );
}
