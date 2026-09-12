"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ReportsDashboard.module.css";

type ScopeOption = { id: string; name: string; buildingId?: string };
type ReportRow = {
  id: string;
  buildingId: string | null;
  buildingName: string;
  companyId: string | null;
  companyName: string;
  vehicleNumber: string;
  rfidUid: string;
  driver: string;
  department: string;
  inTime: string;
  outTime: string | null;
  parkedFor: string;
  status: "Inside" | "Exited";
};

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function withinDate(value: string, from: string, to: string) {
  const time = new Date(value).getTime();
  if (from && time < new Date(`${from}T00:00:00`).getTime()) return false;
  if (to && time > new Date(`${to}T23:59:59.999`).getTime()) return false;
  return true;
}

export default function ReportsDashboard({
  role,
  rows,
  buildings,
  companies,
}: {
  role: string;
  rows: ReportRow[];
  buildings: ScopeOption[];
  companies: ScopeOption[];
}) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [buildingId, setBuildingId] = useState(role === "SUPER_ADMIN" ? "" : buildings[0]?.id || "");
  const [companyId, setCompanyId] = useState(role === "COMPANY_ADMIN" ? companies[0]?.id || "" : "");
  const [reportType, setReportType] = useState("vehicle");

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const interval = window.setInterval(refresh, 3000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);

  const allowedCompanies = useMemo(() => {
    if (!buildingId) return companies;
    return companies.filter((company) => company.buildingId === buildingId);
  }, [buildingId, companies]);

  const filtered = useMemo(() => rows.filter((row) => {
    if (buildingId && row.buildingId !== buildingId) return false;
    if (companyId === "__owner__") {
      if (row.companyId) return false;
    } else if (companyId && row.companyId !== companyId) return false;
    return withinDate(row.inTime, fromDate, toDate);
  }), [rows, buildingId, companyId, fromDate, toDate]);

  const inside = filtered.filter((row) => row.status === "Inside").length;
  const exited = filtered.filter((row) => row.status === "Exited").length;

  function clearFilters() {
    setFromDate("");
    setToDate("");
    if (role === "SUPER_ADMIN") setBuildingId("");
    if (role !== "COMPANY_ADMIN") setCompanyId("");
  }

  function downloadExcel() {
    const headers = ["Vehicle number", "RFID UID", "Driver", "Building", "Company", "Department", "IN time", "OUT time", "Parked for", "Status"];
    const body = filtered.map((row) => [
      row.vehicleNumber, row.rfidUid, row.driver, row.buildingName, row.companyName,
      row.department, formatDateTime(row.inTime), formatDateTime(row.outTime), row.parkedFor, row.status,
    ]);
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><table><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>${body.map((values) => `<tr>${values.map((value) => `<td>${String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</td>`).join("")}</tr>`).join("")}</table></body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `parking-report-${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function downloadCsv() {
    const lines = [
      ["Vehicle number", "RFID UID", "Driver", "Building", "Company", "Department", "IN time", "OUT time", "Parked for", "Status"].map(csvCell).join(","),
      ...filtered.map((row) => [row.vehicleNumber, row.rfidUid, row.driver, row.buildingName, row.companyName, row.department, formatDateTime(row.inTime), formatDateTime(row.outTime), row.parkedFor, row.status].map(csvCell).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `parking-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function printPdf() {
    const popup = window.open("", "_blank", "noopener,noreferrer,width=1100,height=800");
    if (!popup) return;
    const rowsHtml = filtered.map((row) => `<tr><td>${row.vehicleNumber}</td><td>${row.rfidUid}</td><td>${row.driver}</td><td>${row.buildingName}</td><td>${row.companyName}</td><td>${row.department}</td><td>${formatDateTime(row.inTime)}</td><td>${formatDateTime(row.outTime)}</td><td>${row.parkedFor}</td><td>${row.status}</td></tr>`).join("");
    popup.document.write(`<!doctype html><html><head><title>Parking report</title><style>body{font-family:Arial;padding:24px;color:#17221d}h1{margin:0 0 4px}p{color:#65726b}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ccd7d1;padding:7px;text-align:left}th{background:#edf4f0}@media print{button{display:none}}</style></head><body><h1>Parking report</h1><p>Generated ${new Date().toLocaleString()} · ${filtered.length} records</p><table><thead><tr><th>Vehicle</th><th>RFID UID</th><th>Driver</th><th>Building</th><th>Company</th><th>Department</th><th>IN</th><th>OUT</th><th>Parked for</th><th>Status</th></tr></thead><tbody>${rowsHtml || '<tr><td colspan="10">No records</td></tr>'}</tbody></table><script>window.onload=()=>window.print();<\/script></body></html>`);
    popup.document.close();
  }

  return <>
    <section className={styles.reportToolbar}>
      <div>
        <strong>Vehicle IN / OUT time</strong>
        <span>Generated {new Date().toLocaleString()} · Auto-updating every 3 seconds</span>
      </div>
      <div className={styles.toolbarActions}>
        <select value={reportType} onChange={(event) => setReportType(event.target.value)} aria-label="Report type">
          <option value="vehicle">Vehicle IN / OUT time</option>
        </select>
        <button type="button" onClick={downloadExcel}>Excel</button>
        <button type="button" onClick={printPdf}>PDF</button>
      </div>
    </section>

    <section className={styles.filters}>
      <label>From date<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
      <label>To date<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
      {role === "SUPER_ADMIN" && <label>Building<select value={buildingId} onChange={(event) => { setBuildingId(event.target.value); setCompanyId(""); }}><option value="">All buildings</option>{buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}</select></label>}
      {role !== "COMPANY_ADMIN" && <label>Company / owner<select value={companyId} onChange={(event) => setCompanyId(event.target.value)}><option value="">All companies</option><option value="__owner__">Building owner</option>{allowedCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>}
      {role === "COMPANY_ADMIN" && <label>Company<select value={companyId} disabled>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>}
      <button className={styles.clearButton} type="button" onClick={clearFilters}>Clear filter</button>
    </section>

    <section className={styles.summaryGrid}>
      <div><span>Records</span><strong>{filtered.length}</strong></div>
      <div><span>Currently inside</span><strong>{inside}</strong></div>
      <div><span>Exited</span><strong>{exited}</strong></div>
    </section>

    <section className={styles.reportTableCard}>
      <div className={styles.tableHeader}><strong>Vehicle IN / OUT time</strong><div><button type="button" onClick={downloadCsv}>CSV</button></div></div>
      <div className={styles.tableWrap}>
        <table>
          <thead><tr><th>Vehicle number</th><th>RFID UID</th><th>Driver</th><th>Building</th><th>Company</th><th>Department</th><th>IN time</th><th>OUT time</th><th>Parked for</th><th>Status</th></tr></thead>
          <tbody>{filtered.length ? filtered.map((row) => <tr key={row.id}><td>{row.vehicleNumber}</td><td>{row.rfidUid}</td><td>{row.driver}</td><td>{row.buildingName}</td><td>{row.companyName}</td><td>{row.department}</td><td>{formatDateTime(row.inTime)}</td><td>{formatDateTime(row.outTime)}</td><td>{row.parkedFor}</td><td><span className={row.status === "Inside" ? styles.inside : styles.exited}>{row.status}</span></td></tr>) : <tr><td colSpan={10}>No parking records match the selected filters.</td></tr>}</tbody>
        </table>
      </div>
    </section>
  </>;
}
