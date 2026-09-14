"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Spinner } from "./LoadingIndicator";
import styles from "./SupervisorHeadcount.module.css";

type Option = { id: string; name: string; buildingId?: string };
type Headcount = {
  ok: true;
  buildingName: string;
  companyName: string | null;
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

export default function RealtimeMonitor({
  buildings,
  companies,
  fixedBuildingId,
  fixedCompanyId,
}: {
  buildings: Option[];
  companies: Option[];
  fixedBuildingId?: string | null;
  fixedCompanyId?: string | null;
}) {
  const [buildingId, setBuildingId] = useState(fixedBuildingId || buildings[0]?.id || "");
  const [companyId, setCompanyId] = useState(fixedCompanyId || "");
  const [data, setData] = useState<Headcount | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(() => new Date());
  const range = useMemo(localDayRange, []);

  const visibleCompanies = useMemo(
    () => companies.filter((company) => !buildingId || company.buildingId === buildingId),
    [companies, buildingId],
  );

  useEffect(() => {
    if (companyId && !visibleCompanies.some((company) => company.id === companyId)) setCompanyId("");
  }, [buildingId, companyId, visibleCompanies]);

  const load = useCallback(async () => {
    if (!buildingId) {
      setData(null);
      setLoading(false);
      setError("Select a building to view realtime monitoring.");
      return;
    }
    try {
      const params = new URLSearchParams({ ...range, buildingId });
      if (companyId) params.set("companyId", companyId);
      const response = await fetch(`/api/supervisor/headcount?${params.toString()}`, { cache: "no-store" });
      const next = await response.json();
      if (!response.ok) throw new Error(next.message || "Unable to load realtime monitor.");
      setData(next);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load realtime monitor.");
    } finally {
      setLoading(false);
    }
  }, [range, buildingId, companyId]);

  useEffect(() => {
    setLoading(true);
    void load();
    const poller = window.setInterval(() => void load(), 5000);
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => { window.clearInterval(poller); window.clearInterval(timer); };
  }, [load]);

  return <>
    <section className="portfolio-card building-management" style={{ marginTop: 19 }}>
      <div className="portfolio-header">
        <div>
          <div className="section-kicker">FILTER REALTIME DATA</div>
          <h2>Realtime monitor scope</h2>
          <p>Select a building and optionally a company. Data refreshes automatically every 5 seconds.</p>
        </div>
      </div>
      <div className="portfolio-divider" />
      <div className={styles.filterGrid}>
        <label className={styles.filterField}>
          <span>Building</span>
          <div className={styles.selectShell}>
            <select className={styles.modernSelect} value={buildingId} disabled={Boolean(fixedBuildingId)} onChange={(event) => setBuildingId(event.target.value)}>
              <option value="">Select building</option>
              {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
            </select>
            <span className={styles.selectChevron} aria-hidden="true">⌄</span>
          </div>
        </label>
        <label className={styles.filterField}>
          <span>Company</span>
          <div className={styles.selectShell}>
            <select className={styles.modernSelect} value={companyId} disabled={Boolean(fixedCompanyId)} onChange={(event) => setCompanyId(event.target.value)}>
              <option value="">All companies</option>
              {visibleCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
            <span className={styles.selectChevron} aria-hidden="true">⌄</span>
          </div>
        </label>
      </div>
    </section>

    <section className={`portfolio-card ${styles.headcount}`}>
      <div className={styles.titleRow}>
        <div>
          <div className="section-kicker"><span className={styles.liveDot} />REALTIME MONITOR</div>
          <h2>Realtime Head Count</h2>
          <p>{data ? `${data.buildingName}${data.companyName ? ` · ${data.companyName}` : " · All companies"}` : "Select scope above"} · updates every 5 seconds</p>
        </div>
        <div className={styles.clock}><strong>{clock.toLocaleDateString()}</strong><span>{clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span></div>
      </div>
      <div className="portfolio-divider" />
      {error ? <div className={`parking-feedback parking-feedback-error ${styles.error}`}>{error}</div> : null}
      {loading && !data ? <p><Spinner /> Loading realtime monitor…</p> : <div className={styles.layout}>
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
            </article>) : <div className={styles.empty}><p>No vehicles are currently on site for this selection.</p></div>}
          </div>
        </div>
      </div>}
    </section>
  </>;
}
