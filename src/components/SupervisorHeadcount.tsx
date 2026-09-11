"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Spinner } from "./LoadingIndicator";
import styles from "./SupervisorHeadcount.module.css";

type Headcount = {
  ok: true;
  buildingName: string;
  totalIn: number;
  totalOut: number;
  totalOnSite: number;
  departments: { name: string; count: number }[];
  updatedAt: string;
};

function localDayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function SupervisorHeadcount() {
  const [data, setData] = useState<Headcount | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(() => new Date());
  const range = useMemo(localDayRange, []);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams(range);
      const response = await fetch(`/api/supervisor/headcount?${params.toString()}`, { cache: "no-store" });
      const next = await response.json();
      if (!response.ok) throw new Error(next.message || "Unable to load realtime head count.");
      setData(next);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load realtime head count.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
    const poller = window.setInterval(() => void load(), 5000);
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => { window.clearInterval(poller); window.clearInterval(timer); };
  }, [load]);

  if (loading && !data) {
    return <section className={`portfolio-card ${styles.headcount}`}><p><Spinner /> Loading realtime head count…</p></section>;
  }

  return <section className={`portfolio-card ${styles.headcount}`}>
    <div className={styles.titleRow}>
      <div>
        <div className="section-kicker"><span className={styles.liveDot} />REALTIME MONITOR</div>
        <h2>Realtime Head Count</h2>
        <p>{data?.buildingName || "Assigned building"} · updates every 5 seconds</p>
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
  </section>;
}
