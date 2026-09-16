"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "./LoadingIndicator";
import styles from "./SupervisorHeadcount.module.css";

type ScanEvent = {
  id: string;
  action: string;
  code: string;
  message: string;
  cardNo: string;
  deviceNumber: string;
  createdAt: string;
  vehicle: { plateNumber: string; ownerName: string; department: string } | null;
  company: { name: string } | null;
};

type EmployeeParkingCompany = {
  companyId: string;
  companyName: string;
  spacesAllotted: number;
  vehiclesInside: number;
};

type Headcount = {
  ok: true;
  buildingName: string;
  totalIn: number;
  totalOut: number;
  totalOnSite: number;
  employeeSpacesAllotted: number;
  employeeVehiclesInside: number;
  employeeParkingByCompany: EmployeeParkingCompany[];
  recentEvents: ScanEvent[];
  updatedAt: string;
};

type PopupState = ScanEvent & { tone: "entry" | "exit" | "denied" | "info" };

function localDayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function popupTone(event: ScanEvent): PopupState["tone"] {
  if (event.action === "ENTRY" && event.code === "0000") return "entry";
  if (event.action === "EXIT" && event.code === "0000") return "exit";
  if (event.code !== "0000" || event.action === "DENIED" || event.action === "IGNORED") return "denied";
  return "info";
}

function popupTitle(event: PopupState) {
  if (event.tone === "entry") return "Vehicle Entry";
  if (event.tone === "exit") return "Vehicle Exit";
  if (event.tone === "denied") return "Access Denied";
  return "RFID Scan";
}

function eventResult(event: ScanEvent) {
  if (event.code === "0000") return event.action === "ENTRY" ? "Entry allowed" : event.action === "EXIT" ? "Exit allowed" : event.message;
  return event.message || "Denied";
}

export default function SupervisorHeadcount() {
  const [data, setData] = useState<Headcount | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(() => new Date());
  const [popup, setPopup] = useState<PopupState | null>(null);
  const range = useMemo(localDayRange, []);
  const seenEventId = useRef<string | null>(null);
  const initialized = useRef(false);
  const requestInFlight = useRef(false);

  const load = useCallback(async () => {
    if (requestInFlight.current || document.visibilityState !== "visible") return;
    requestInFlight.current = true;
    try {
      const params = new URLSearchParams(range);
      const response = await fetch(`/api/supervisor/headcount?${params.toString()}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next.message || "Unable to load real time monitor.");

      const newestEvent = Array.isArray(next.recentEvents) ? next.recentEvents[0] as ScanEvent | undefined : undefined;
      if (!initialized.current) {
        initialized.current = true;
        seenEventId.current = newestEvent?.id || null;
      } else if (newestEvent?.id && newestEvent.id !== seenEventId.current) {
        seenEventId.current = newestEvent.id;
        setPopup({ ...newestEvent, tone: popupTone(newestEvent) });
      }

      setData(next);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load real time monitor.");
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    let stopped = false;
    let pollTimer: number | undefined;

    async function poll() {
      if (stopped) return;
      await load();
      if (!stopped) pollTimer = window.setTimeout(poll, 3000);
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };

    void poll();
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => {
      stopped = true;
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  useEffect(() => {
    if (!popup) return;
    const timer = window.setTimeout(() => setPopup(null), 6000);
    return () => window.clearTimeout(timer);
  }, [popup]);

  if (loading && !data) {
    return <section className={`portfolio-card ${styles.headcount}`}><p><Spinner /> Loading Real Time Monitor…</p></section>;
  }

  return <>
    {popup ? <div className={`${styles.scanPopup} ${styles[popup.tone]}`} role="status" aria-live="polite">
      <button type="button" className={styles.popupClose} aria-label="Close notification" onClick={() => setPopup(null)}>×</button>
      <div className={styles.popupIcon} aria-hidden="true">{popup.tone === "entry" ? "IN" : popup.tone === "exit" ? "OUT" : popup.tone === "denied" ? "!" : "RF"}</div>
      <div className={styles.popupBody}>
        <span className={styles.popupEyebrow}>LIVE RFID EVENT</span>
        <h3>{popupTitle(popup)}</h3>
        <p>{popup.message}</p>
        <div className={styles.popupMeta}>
          <span><strong>Vehicle</strong>{popup.vehicle?.plateNumber || "Unknown"}</span>
          <span><strong>Rider</strong>{popup.vehicle?.ownerName || "Unknown"}</span>
          <span><strong>Company</strong>{popup.company?.name || "-"}</span>
          <span><strong>RFID</strong>{popup.cardNo}</span>
        </div>
      </div>
    </div> : null}

    <section className={`portfolio-card ${styles.headcount}`}>
      <div className={styles.titleRow}>
        <div>
          <div className="section-kicker"><span className={styles.liveDot} />REAL TIME MONITOR</div>
          <h2>Real Time Monitor</h2>
          <p>{data?.buildingName || "Assigned building"} · updates every 3 seconds</p>
        </div>
        <div className={styles.clock}><strong>{clock.toLocaleDateString()}</strong><span>{clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span></div>
      </div>
      <div className="portfolio-divider" />
      {error ? <div className={`parking-feedback parking-feedback-error ${styles.error}`}>{error}</div> : null}
      <div className={styles.totals} style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <article className={`${styles.totalCard} ${styles.onsite}`}><span>Total On Site</span><strong>{data?.totalOnSite ?? 0}</strong></article>
        <article className={`${styles.totalCard} ${styles.in}`}><span>Total IN</span><strong>{data?.totalIn ?? 0}</strong></article>
        <article className={`${styles.totalCard} ${styles.out}`}><span>Total OUT</span><strong>{data?.totalOut ?? 0}</strong></article>
      </div>
    </section>

    <section className={`portfolio-card ${styles.employeeParkingCard}`}>
      <div className={styles.employeeParkingHeader}>
        <div>
          <div className="section-kicker">EMPLOYEE PARKING</div>
          <h2>Employee Parking Allocation</h2>
          <p>Parking spaces allotted by companies and employee vehicles currently inside the building.</p>
        </div>
        <div className={styles.employeeParkingTotals}>
          <div><span>Spaces Allotted</span><strong>{data?.employeeSpacesAllotted ?? 0}</strong></div>
          <div><span>Vehicles In</span><strong>{data?.employeeVehiclesInside ?? 0}</strong></div>
        </div>
      </div>
      <div className="portfolio-divider" />
      <div className={styles.companyParkingGrid}>
        {data?.employeeParkingByCompany.length ? data.employeeParkingByCompany.map((company) => (
          <article className={styles.companyParkingCard} key={company.companyId}>
            <h3>{company.companyName}</h3>
            <div>
              <span>Employee spaces allotted<strong>{company.spacesAllotted}</strong></span>
              <span>Employee vehicles in<strong>{company.vehiclesInside}</strong></span>
            </div>
          </article>
        )) : <p className={styles.emptyParking}>No employee parking allocation found.</p>}
      </div>
    </section>

    <section className={`portfolio-card ${styles.scanTableCard}`}>
      <div className={styles.scanTableHeader}>
        <div>
          <div className="section-kicker">RFID ACTIVITY</div>
          <h2>Live Dashboard</h2>
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.scanTable}>
          <thead><tr><th>Time</th><th>Device</th><th>RFID</th><th>Vehicle</th><th>Rider</th><th>Company</th><th>Action</th><th>Result</th></tr></thead>
          <tbody>
            {data?.recentEvents.length ? data.recentEvents.map((event) => <tr key={event.id}>
              <td>{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
              <td>{event.deviceNumber || "-"}</td>
              <td>{event.cardNo || "-"}</td>
              <td>{event.vehicle?.plateNumber || "-"}</td>
              <td>{event.vehicle?.ownerName || "-"}</td>
              <td>{event.company?.name || "-"}</td>
              <td><span className={`${styles.actionBadge} ${event.action === "ENTRY" ? styles.entryBadge : event.action === "EXIT" ? styles.exitBadge : styles.deniedBadge}`}>{event.action}</span></td>
              <td className={event.code === "0000" ? styles.successResult : styles.deniedResult}>{eventResult(event)}</td>
            </tr>) : <tr><td colSpan={8} className={styles.emptyTable}>No RFID scans recorded today.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </>;
}
