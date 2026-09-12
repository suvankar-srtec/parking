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

type ColumnKey =
  | "vehicleNumber"
  | "rfidUid"
  | "driver"
  | "buildingName"
  | "companyName"
  | "department"
  | "inTime"
  | "outTime"
  | "parkedFor"
  | "status";

type ColumnDefinition = {
  key: ColumnKey;
  label: string;
  pdfWidth: number;
  value: (row: ReportRow) => string;
};

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

const COLUMN_DEFINITIONS: ColumnDefinition[] = [
  { key: "vehicleNumber", label: "Vehicle number", pdfWidth: 13, value: (row) => row.vehicleNumber },
  { key: "rfidUid", label: "RFID UID", pdfWidth: 12, value: (row) => row.rfidUid },
  { key: "driver", label: "Driver", pdfWidth: 14, value: (row) => row.driver },
  { key: "buildingName", label: "Building", pdfWidth: 16, value: (row) => row.buildingName },
  { key: "companyName", label: "Company", pdfWidth: 16, value: (row) => row.companyName },
  { key: "department", label: "Department", pdfWidth: 14, value: (row) => row.department },
  { key: "inTime", label: "IN time", pdfWidth: 20, value: (row) => formatDateTime(row.inTime) },
  { key: "outTime", label: "OUT time", pdfWidth: 20, value: (row) => formatDateTime(row.outTime) },
  { key: "parkedFor", label: "Parked for", pdfWidth: 10, value: (row) => row.parkedFor },
  { key: "status", label: "Status", pdfWidth: 10, value: (row) => row.status },
];

const ALL_COLUMN_KEYS = COLUMN_DEFINITIONS.map((column) => column.key);

function withinDate(value: string, from: string, to: string) {
  const time = new Date(value).getTime();
  if (from && time < new Date(`${from}T00:00:00`).getTime()) return false;
  if (to && time > new Date(`${to}T23:59:59.999`).getTime()) return false;
  return true;
}

function htmlEscape(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pdfEscape(value: string) {
  return value
    .replace(/[^\x20-\x7E]/g, " ")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function fitPdfCell(value: string, width: number) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= width) return text.padEnd(width, " ");
  if (width <= 3) return text.slice(0, width);
  return `${text.slice(0, width - 3)}...`;
}

function buildPdfBlob(pages: string[][]) {
  const objects: string[] = [];
  const pageIds = pages.map((_, index) => 4 + index * 2);
  const contentIds = pages.map((_, index) => 5 + index * 2);

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>";

  pages.forEach((lines, index) => {
    const pageId = pageIds[index];
    const contentId = contentIds[index];
    const streamLines = ["BT", "/F1 7 Tf", "1 0 0 1 24 565 Tm"];
    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) streamLines.push("0 -11 Td");
      streamLines.push(`(${pdfEscape(line)}) Tj`);
    });
    streamLines.push("ET");
    const stream = streamLines.join("\n");

    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<Set<ColumnKey>>(() => new Set(ALL_COLUMN_KEYS));

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

  const visibleColumns = useMemo(
    () => COLUMN_DEFINITIONS.filter((column) => visibleColumnKeys.has(column.key)),
    [visibleColumnKeys],
  );

  const inside = filtered.filter((row) => row.status === "Inside").length;
  const exited = filtered.filter((row) => row.status === "Exited").length;

  function clearFilters() {
    setFromDate("");
    setToDate("");
    if (role === "SUPER_ADMIN") setBuildingId("");
    if (role !== "COMPANY_ADMIN") setCompanyId("");
  }

  function toggleColumn(key: ColumnKey) {
    setVisibleColumnKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        if (next.size === 1) return current;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function downloadExcel() {
    const headers = visibleColumns.map((column) => column.label);
    const body = filtered.map((row) => visibleColumns.map((column) => column.value(row)));
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><table><tr>${headers.map((header) => `<th>${htmlEscape(header)}</th>`).join("")}</tr>${body.map((values) => `<tr>${values.map((value) => `<td>${htmlEscape(value)}</td>`).join("")}</tr>`).join("")}</table></body></html>`;
    downloadBlob(new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" }), `parking-report-${new Date().toISOString().slice(0, 10)}.xls`);
  }

  function downloadPdf() {
    const headerLine = visibleColumns
      .map((column) => fitPdfCell(column.label.toUpperCase(), column.pdfWidth))
      .join(" | ");
    const separatorLine = visibleColumns
      .map((column) => "-".repeat(column.pdfWidth))
      .join("-+-");
    const dataLines = filtered.map((row) => visibleColumns
      .map((column) => fitPdfCell(column.value(row), column.pdfWidth))
      .join(" | "));

    const buildingName = buildingId ? buildings.find((building) => building.id === buildingId)?.name || "Selected building" : "All buildings";
    const companyName = companyId === "__owner__"
      ? "Building owner"
      : companyId
        ? companies.find((company) => company.id === companyId)?.name || "Selected company"
        : "All companies";
    const dateRange = `${fromDate || "Any date"} to ${toDate || "Any date"}`;
    const pageRows = 38;
    const chunks: string[][] = [];
    if (dataLines.length === 0) {
      chunks.push([]);
    } else {
      for (let index = 0; index < dataLines.length; index += pageRows) {
        chunks.push(dataLines.slice(index, index + pageRows));
      }
    }

    const pages = chunks.map((chunk, index) => [
      "Parking report - Vehicle IN / OUT time",
      `Generated ${new Date().toLocaleString()} | Records ${filtered.length} | Page ${index + 1}/${chunks.length}`,
      `Date: ${dateRange} | Building: ${buildingName} | Company/Owner: ${companyName}`,
      "",
      headerLine,
      separatorLine,
      ...(chunk.length ? chunk : ["No parking records match the selected filters."]),
    ]);

    downloadBlob(buildPdfBlob(pages), `parking-report-${new Date().toISOString().slice(0, 10)}.pdf`);
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
        <button type="button" onClick={downloadPdf}>PDF</button>
      </div>
    </section>

    <section className={styles.filters}>
      <label>From date<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
      <label>To date<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
      {role === "SUPER_ADMIN" && <label>Building<select value={buildingId} onChange={(event) => { setBuildingId(event.target.value); setCompanyId(""); }}><option value="">All buildings</option>{buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}</select></label>}
      {role !== "COMPANY_ADMIN" && <label>Company / owner<select value={companyId} onChange={(event) => setCompanyId(event.target.value)}><option value="">All companies</option><option value="__owner__">Building owner</option>{allowedCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>}
      {role === "COMPANY_ADMIN" && <label>Company<select value={companyId} disabled>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>}
      <div className={styles.columnFilter}>
        <span>Columns</span>
        <details className={styles.columnPicker}>
          <summary>{visibleColumns.length} of {COLUMN_DEFINITIONS.length} shown</summary>
          <div className={styles.columnMenu}>
            {COLUMN_DEFINITIONS.map((column) => {
              const checked = visibleColumnKeys.has(column.key);
              return <label key={column.key}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={checked && visibleColumnKeys.size === 1}
                  onChange={() => toggleColumn(column.key)}
                />
                <span>{column.label}</span>
              </label>;
            })}
          </div>
        </details>
      </div>
      <button className={styles.clearButton} type="button" onClick={clearFilters}>Clear filter</button>
    </section>

    <section className={styles.summaryGrid}>
      <div><span>Records</span><strong>{filtered.length}</strong></div>
      <div><span>Currently inside</span><strong>{inside}</strong></div>
      <div><span>Exited</span><strong>{exited}</strong></div>
    </section>

    <section className={styles.reportTableCard}>
      <div className={styles.tableHeader}><strong>Vehicle IN / OUT time</strong></div>
      <div className={styles.tableWrap}>
        <table>
          <thead><tr>{visibleColumns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
          <tbody>{filtered.length ? filtered.map((row) => <tr key={row.id}>
            {visibleColumns.map((column) => <td key={column.key}>{column.key === "status" ? <span className={row.status === "Inside" ? styles.inside : styles.exited}>{row.status}</span> : column.value(row)}</td>)}
          </tr>) : <tr><td colSpan={visibleColumns.length}>No parking records match the selected filters.</td></tr>}</tbody>
        </table>
      </div>
    </section>
  </>;
}
