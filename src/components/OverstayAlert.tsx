"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./OverstayAlert.module.css";

export type OverstayCard = {
  id: string;
  rfidCardNo: string;
  vehicleNumber: string;
  personName: string;
  personType: "OWNER" | "EMPLOYEE";
  companyName: string;
  department: string;
  entryTime: string | null;
};

const OVERSTAY_MS = 24 * 60 * 60 * 1000;
const ALERT_INTERVAL_MS = 10_000;
const ALERT_VISIBLE_MS = 6_000;

function stayDuration(entryTime: string) {
  const elapsed = Math.max(0, Date.now() - new Date(entryTime).getTime());
  const totalHours = Math.floor(elapsed / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

export default function OverstayAlert({
  cards,
  enabled = true,
}: {
  cards: OverstayCard[];
  enabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  const overdue = useMemo(() => {
    const now = Date.now();
    return cards
      .filter((card) => card.entryTime && now - new Date(card.entryTime).getTime() >= OVERSTAY_MS)
      .sort((a, b) => new Date(a.entryTime || 0).getTime() - new Date(b.entryTime || 0).getTime());
  }, [cards, tick]);

  const signature = overdue.map((card) => card.id + ":" + card.entryTime).join("|");

  useEffect(() => {
    if (!enabled || overdue.length === 0) {
      setOpen(false);
      return;
    }

    let hideTimer: number | undefined;
    const show = () => {
      setOpen(true);
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setOpen(false), ALERT_VISIBLE_MS);
    };

    show();
    const interval = window.setInterval(() => {
      setTick((value) => value + 1);
      show();
    }, ALERT_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
    };
  }, [enabled, signature, overdue.length]);

  if (!enabled || !open || overdue.length === 0) return null;

  return <aside className={styles.alert} role="alert" aria-live="assertive">
    <button type="button" className={styles.close} aria-label="Close 24 hour stay alert" onClick={() => setOpen(false)}>×</button>
    <div className={styles.heading}>
      <div className={styles.icon}>!</div>
      <div>
        <span>24+ HOUR PARKING ALERT</span>
        <h3>{overdue.length} vehicle{overdue.length === 1 ? "" : "s"} still on site</h3>
        <p>This warning repeats every 10 seconds while these cards remain inside.</p>
      </div>
    </div>
    <div className={styles.list}>
      {overdue.map((card) => <article className={styles.card} key={card.id}>
        <div className={styles.cardTop}>
          <strong>{card.vehicleNumber}</strong>
          <b>{card.entryTime ? stayDuration(card.entryTime) : "24h+"}</b>
        </div>
        <div className={styles.details}>
          <span><small>RFID</small>{card.rfidCardNo}</span>
          <span><small>{card.personType === "OWNER" ? "Owner" : "Employee"}</small>{card.personName}</span>
          <span><small>Company</small>{card.companyName}</span>
          <span><small>Entry time</small>{card.entryTime ? new Date(card.entryTime).toLocaleString() : "-"}</span>
        </div>
      </article>)}
    </div>
  </aside>;
}
