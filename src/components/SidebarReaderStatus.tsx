"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/AppLink";
import { readerStatus, type ReaderConnection } from "@/lib/reader-status";

type SidebarReader = ReaderConnection & {
  id: string;
  name?: string;
  deviceNumber: string;
};

type ReaderResponse = {
  readers: SidebarReader[];
  availableReaders?: SidebarReader[];
};

export default function SidebarReaderStatus({
  endpoint = "/api/rfid/readers",
  title = "RFID Reader",
  linkToAccess = true,
  includeAvailableReaders = false,
}: {
  endpoint?: string;
  title?: string;
  linkToAccess?: boolean;
  includeAvailableReaders?: boolean;
}) {
  const [readers, setReaders] = useState<SidebarReader[]>([]);
  const [availableReaders, setAvailableReaders] = useState<SidebarReader[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;

    async function load() {
      try {
        const response = await fetch(endpoint, {
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
        const payload = await response.json() as ReaderResponse;
        if (!response.ok) throw new Error("Reader status unavailable.");
        if (!stopped) {
          setReaders(Array.isArray(payload.readers) ? payload.readers : []);
          setAvailableReaders(includeAvailableReaders && Array.isArray(payload.availableReaders) ? payload.availableReaders : []);
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
  }, [endpoint, includeAvailableReaders]);

  const visibleReaders = useMemo(() => {
    const byId = new Map<string, { reader: SidebarReader; detectedOnly: boolean }>();
    for (const reader of readers) byId.set(reader.id, { reader, detectedOnly: false });
    for (const reader of availableReaders) {
      if (!byId.has(reader.id)) byId.set(reader.id, { reader, detectedOnly: true });
    }
    return Array.from(byId.values());
  }, [readers, availableReaders]);

  return <div className="sidebar-reader-status">
    {linkToAccess
      ? <Link href="/access-control" className="sidebar-reader-title">{title}</Link>
      : <span className="sidebar-reader-title">{title}</span>}
    {!loaded ? null : visibleReaders.length === 0 ? <span className="sidebar-reader-empty">No reader detected</span> : visibleReaders.map(({ reader, detectedOnly }) => {
      const status = readerStatus(reader);
      const tone = detectedOnly || status.tone === "unknown" ? "detected" : status.tone;
      const label = detectedOnly ? "Not configured" : status.label;
      return <div className="sidebar-reader-item" key={reader.id} title={label}>
        <i className={tone} aria-hidden="true" />
        <span>{reader.name ? `${reader.name} : ` : "Reader : "}<strong>{reader.deviceNumber}</strong>{detectedOnly ? <small> · Not configured</small> : null}</span>
      </div>;
    })}
    <style>{`
      .sidebar-reader-status{margin-top:auto;padding:10px 7px 2px;border-top:1px solid rgba(255,255,255,.14);display:grid;gap:7px}
      .sidebar-reader-title{color:#fff!important;text-decoration:none;font-size:10px;font-weight:800;line-height:1.2}
      .sidebar-reader-item{display:flex;align-items:center;gap:8px;color:#fff;font-size:10px;font-weight:500;line-height:1.2;min-height:16px}
      .sidebar-reader-item strong{font-weight:800;color:#fff}
      .sidebar-reader-item small{color:rgba(255,255,255,.68);font-size:8.5px}
      .sidebar-reader-item i{width:8px;height:8px;border-radius:50%;flex:0 0 8px;box-shadow:0 0 0 2px rgba(255,255,255,.05)}
      .sidebar-reader-item i.online{background:#20bf6b}
      .sidebar-reader-item i.offline{background:#e5484d}
      .sidebar-reader-item i.detected{background:#d5a31b}
      .sidebar-reader-empty{color:rgba(255,255,255,.62);font-size:9px}
    `}</style>
  </div>;
}
