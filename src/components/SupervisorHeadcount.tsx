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

type Headcount = {
  ok: true;
  buildingName: string;
  totalIn: number;
  totalOut: number;
  totalOnSite: number;
  departments: { name: string; count: number }[];
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
      if (!response.ok) throw new Error(next.message || "Unable to load realtime head count.");

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
      setError(err instanceof Error ? err.message : "Unable to load realtime head count.");
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    let stopped = false;
    let pollTimer: ReturnType<typeof setTimeout>;

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
      window.clearTimeout(pollTimer);
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
    return <section className={`portfolio-card ${styles.headcount}`}><p><Spinner /> Loading realtime head count…</p></section>;
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
          <span><strong>Driver</strong>{popup.vehicle?.ownerName || "Unknown"}</span>
          <span><strong>Company</strong>{popup.company?.name || "-"}</span>
          <span><strong>RFID</strong>{popup.cardNo}</span>
        </div>
      </div>
    </div> : null}

    <section className={`portfolio-card ${styles.headcount}`}>
      <div className={styles.titleRow}>
        <div>
          <div className="section-kicker"><span className={styles.liveDot} />REALTIME MONITOR</div>
          <h2>Realtime Head Count</h2>
          <p>{data?.buildingName || "Assigned building"} · updates every 3 seconds</p>
        </div>
        <div className={styles.clock}><strong>{clock.toLocaleDateString()}</strong><span>{clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span></div>
      </div>
      <div className="portfolio-divider" />
      {error ? <div className={`parking-feedback parking-feedback-error ${styles.error}`}>{error}</div> : null}
      <div className={styles.layout}>
        <div className={styles.totals}>
          <article className={`${styles.totalCard} ${styles.in}`}><span>Total IN</span><strong>{data?.totalIn ?? 0}</strong></article>
          <article className={`${styles.totalCard} ${styles.out}`}><span>Total OUT</span><strong>{data?.totalOut ?? 0}</strong></article>
          <article className={`${styles.totalCard} ${styles.onsite}`}><span>Total On Site</span><strong>{data?.totalOnSite ?? 0}</strong></article>
        </div>
        <div className={styles.departments}>
          <h3>Department on Site</h3>
          <div className={styles.departmentGrid}>
            {data?.departments.length ? data.departments.map((department) => <article className={styles.departmentCard} key={department.name}>
              <span>{department.name}</span><strong>{department.count}</strong>
            </article>) : <div className={styles.empty}><p>No vehicles are currently on site.</p></div>}
          </div>
        </div>
      </div>
    </section>
  </>;
}
