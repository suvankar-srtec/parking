"use client";

import Link from "@/components/AppLink";
import { useState } from "react";
import ReaderConsole from "./ReaderConsole";

export default function Sidebar({
  roleLabel = "Super Admin",
  dashboardHref = "/dashboard",
  dashboardLabel = "Buildings",
}: { roleLabel?: string; dashboardHref?: string; dashboardLabel?: string }) {
  const [expanded, setExpanded] = useState({
    dashboard: true,
    personal: false,
    access: false,
  });

  function toggle(section: keyof typeof expanded) {
    setExpanded((current) => ({ ...current, [section]: !current[section] }));
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="logo-box">P</div>
        <div><strong>ParkControl</strong><span>{roleLabel}</span></div>
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
            <Link className="menu-button menu-button-sub active-menu" href={dashboardHref}>{dashboardLabel}</Link>
          </div>
        </div>

        <div className="menu-group">
          <button type="button" className="menu-section-title menu-toggle"
            aria-expanded={expanded.personal} aria-controls="personal-menu"
            onClick={() => toggle("personal")}>
            <span>Personal</span><span className="menu-chevron" aria-hidden="true" />
          </button>
          <div id="personal-menu" className="menu-items" hidden={!expanded.personal}>
            <div className="menu-button dark-menu">Person</div>
          </div>
        </div>

        <div className="menu-group">
          <button type="button" className="menu-section-title menu-toggle"
            aria-expanded={expanded.access} aria-controls="access-menu"
            onClick={() => toggle("access")}>
            <span>Access Control</span><span className="menu-chevron" aria-hidden="true" />
          </button>
          <div id="access-menu" className="menu-items" hidden={!expanded.access}>
            <Link className="menu-button dark-menu" href="/access-control">Device</Link>
            <div className="menu-button dark-menu">Slot Allocation</div>
            <div className="menu-button dark-menu">Manual In/Out</div>
            <Link className="menu-button dark-menu" href="/access-control#activity">Real Time Monitor</Link>
          </div>
        </div>
        <div className="menu-section-title"><span>Report</span></div>
      </nav>
      <ReaderConsole compact />
    </aside>
  );
}
