"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "./LoadingIndicator";
import styles from "./SupervisorHeadcount.module.css";

type EmployeeParkingCompany = {
  companyId: string;
  companyName: string;
  spacesAllotted: number;
  vehiclesInside: number;
};

type EmployeeParkingData = {
  ok: true;
  buildingName: string;
  employeeSpacesAllotted: number;
  employeeVehiclesInside: number;
  employeeParkingByCompany: EmployeeParkingCompany[];
};

function localDayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function SupervisorEmployeeParking() {
  const [data, setData] = useState<EmployeeParkingData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const range = useMemo(localDayRange, []);
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
      if (!response.ok) throw new Error(next.message || "Unable to load employee parking allocation.");
      setData(next);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load employee parking allocation.");
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
    return () => {
      stopped = true;
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  if (loading && !data) {
    return <section className={`portfolio-card ${styles.employeeParkingCard}`}><p><Spinner /> Loading Employee Parking Allocation…</p></section>;
  }

  return <section className={`portfolio-card ${styles.employeeParkingCard}`}>
    <div className={styles.employeeParkingHeader}>
      <div>
        <div className="section-kicker">EMPLOYEE PARKING</div>
        <h2>Employee Parking Allocation</h2>
        <p>{data?.buildingName || "Assigned building"} · parking spaces allotted by companies and employee vehicles currently inside.</p>
      </div>
      <div className={styles.employeeParkingTotals}>
        <div><span>Spaces Allotted</span><strong>{data?.employeeSpacesAllotted ?? 0}</strong></div>
        <div><span>Vehicles In</span><strong>{data?.employeeVehiclesInside ?? 0}</strong></div>
      </div>
    </div>
    <div className="portfolio-divider" />
    {error ? <div className={`parking-feedback parking-feedback-error ${styles.error}`}>{error}</div> : null}
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
  </section>;
}
