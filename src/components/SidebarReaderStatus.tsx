"use client";

import { useEffect, useState } from "react";
import Link from "@/components/AppLink";
import { readerStatus, type ReaderConnection } from "@/lib/reader-status";

type SidebarReader = ReaderConnection & {
  id: string;
  deviceNumber: string;
};

type ReaderResponse = {
  readers: SidebarReader[];
};

export default function SidebarReaderStatus() {
  const [readers, setReaders] = useState<SidebarReader[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;

    async function load() {
      try {
        const response = await fetch("/api/rfid/readers", {
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
        const payload = await response.json() as ReaderResponse;
        if (!response.ok) throw new Error("Reader status unavailable.");
        if (!stopped) {
          setReaders(Array.isArray(payload.readers) ? payload.readers : []);
          setLoaded(true);
        }
      } catch {
        if (!stopped) setLoaded(true);
      }

      if (!stopped) timer = window.setTimeout(load, 5000);
    }

    void load();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  return <div className="sidebar-reader-status">
    <Link href="/access-control" className="sidebar-reader-title">RFID Reader</Link>
    {!loaded ? null : readers.length === 0 ? <span className="sidebar-reader-empty">No reader configured</span> : readers.map((reader) => {
      const online = readerStatus(reader).tone === "online";
      return <div className="sidebar-reader-item" key={reader.id} title={online ? "Heartbeat active" : "Heartbeat unavailable"}>
        <i className={online ? "online" : "offline"} aria-hidden="true" />
        <span>Reader : <strong>{reader.deviceNumber}</strong></span>
      </div>;
    })}
    <style>{`
      .sidebar-reader-status{margin-top:auto;padding:10px 7px 2px;border-top:1px solid rgba(255,255,255,.14);display:grid;gap:7px}
      .sidebar-reader-title{color:#fff!important;text-decoration:none;font-size:10px;font-weight:800;line-height:1.2}
      .sidebar-reader-item{display:flex;align-items:center;gap:8px;color:#fff;font-size:10px;font-weight:500;line-height:1.2;min-height:16px}
      .sidebar-reader-item strong{font-weight:800;color:#fff}
      .sidebar-reader-item i{width:8px;height:8px;border-radius:50%;flex:0 0 8px;box-shadow:0 0 0 2px rgba(255,255,255,.05)}
      .sidebar-reader-item i.online{background:#20bf6b}
      .sidebar-reader-item i.offline{background:#e5484d}
      .sidebar-reader-empty{color:rgba(255,255,255,.62);font-size:9px}
    `}</style>
  </div>;
}
