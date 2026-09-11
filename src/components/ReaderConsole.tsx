"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "@/components/AppLink";
import { readerStatus, type ReaderConnection } from "@/lib/reader-status";
import { requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { ActionButton, Spinner } from "./LoadingIndicator";
type Reader = ReaderConnection & { id: string; name: string; deviceNumber: string; mode: string; enabled: boolean; buildingId: string | null; readerIp: string | null; sourcePort: number | null };
type ReaderData = { readers: Reader[]; buildings: { id: string; name: string }[]; canManage: boolean };
type Activity = { inside: number; events: { id: string; createdAt: string; deviceNumber: string; cardNo: string; code: string; action: string; message: string }[] };
export default function ReaderConsole({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<ReaderData | null>(null);
  const [activity, setActivity] = useState<Activity>({ inside: 0, events: [] });
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<Reader | null>(null);
  const [revision, setRevision] = useState(0);
  const { notify } = useFeedback();
  const { pending, execute } = useMutation();
  useEffect(() => {
    let stopped = false, failed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const response = await fetch("/api/rfid/readers", { cache: "no-store", signal: AbortSignal.timeout(10000) });
        const devices = await response.json();
        if (!response.ok) throw new Error(devices.message || "Reader status unavailable.");
        let events;
        if (!compact) {
          const result = await fetch("/api/rfid/events", { cache: "no-store", signal: AbortSignal.timeout(10000) });
          events = await result.json();
          if (!result.ok) throw new Error(events.message || "Reader events unavailable.");
        }
        if (!stopped) { setData(devices); if (events) setActivity(events); setError(false); failed = false; }
      } catch (cause) { if (!stopped) { setError(true); if (!compact && !failed) notify(cause instanceof Error ? cause.message : "Reader status unavailable.", "error"); failed = true; } }
      if (!stopped) timer = setTimeout(load, 5000);
    }
    void load();
    return () => { stopped = true; clearTimeout(timer); };
  }, [compact, revision, notify]);
  if (compact) return <div className="reader-panel"><Link href="/access-control" className="reader-heading">RFID readers</Link>
    {error ? <p>Status unavailable</p> : !data ? <p>Loading readers…</p> : !data.readers.length ? <p>No readers configured</p> : data.readers.map((reader) => {
      const state = readerStatus(reader); return <div className="reader-line" key={reader.id}><i className={"reader-dot " + state.tone} /><span>{reader.name} · {reader.deviceNumber}<small>{state.label}</small></span></div>;
    })}</div>;
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void execute(async () => {
      const result = await requestJson("/api/rfid/readers", "POST", { deviceNumber: editing!.deviceNumber, name: form.get("name"), buildingId: form.get("buildingId"), mode: form.get("mode"), enabled: form.get("enabled") === "on", heartbeatSeconds: editing!.heartbeatSeconds });
      notify(result.message || "Reader saved."); setEditing(null); setRevision((n) => n + 1);
    });
  }
  return <>
    <section className="portfolio-card"><div className="portfolio-header"><div><div className="section-kicker">ACCESS CONTROL</div><h2>Reader configuration</h2><p>Readers communicate with Vercel through HTTPS. Assign a building and operating mode.</p></div><strong>{activity.inside} vehicles inside</strong></div>
      {!data ? <p><Spinner /> Loading readers…</p> : <div className="reader-grid">{data.readers.map((reader) => { const state = error ? { tone: "unknown", label: "Status unavailable" } : readerStatus(reader); return <article className="reader-card" key={reader.id}>
        <h3>{reader.name}</h3><p>{reader.deviceNumber} · {reader.readerIp || reader.connectionType}</p><div className="reader-line"><i className={"reader-dot " + state.tone} />{state.label}</div>
        <p>{data.buildings.find((building) => building.id === reader.buildingId)?.name || "Building not assigned"} · {reader.mode.replaceAll("_", " / ")}</p>
        <p className="muted">{reader.enabled ? "Approved" : "Disabled"} · Last contact: {reader.lastSeenAt ? new Date(reader.lastSeenAt).toLocaleString() : "None"}</p>
        {data.canManage && <button className="secondary-button" onClick={() => setEditing(reader)}>Configure reader</button>}
      </article>; })}</div>}
      <p className="muted">HTTPS readers are green after recent scan/heartbeat activity. If heartbeat is disabled, an idle reader is shown as idle rather than disconnected. The hardware red LED is separate and belongs to a successful scan response.</p>
    </section>
    <section className="portfolio-card" id="activity"><div className="section-kicker">LIVE ACTIVITY</div><h2>Card and parking events</h2><div className="reader-table-wrap"><table className="reader-table"><thead><tr><th>Time</th><th>Device</th><th>Card</th><th>Action</th><th>Result</th></tr></thead><tbody>{activity.events.map((event) => <tr key={event.id}><td>{new Date(event.createdAt).toLocaleString()}</td><td>{event.deviceNumber}</td><td>{event.cardNo}</td><td>{event.action}</td><td className={event.code === "0000" ? "reader-success" : "reader-failure"}>{event.message}</td></tr>)}</tbody></table>{!activity.events.length && <p>No scans received yet.</p>}</div></section>
    {editing && <div className="modal-backdrop"><section className="modal-card small-modal" role="dialog" aria-modal="true" aria-label="Configure reader"><div className="modal-head"><h2>Configure {editing.deviceNumber}</h2><button className="modal-close" disabled={pending} aria-label="Close reader settings" onClick={() => setEditing(null)}>×</button></div>
      <form className="modal-form entity-form" onSubmit={save}><fieldset className="entity-fields" disabled={pending}>
        <label>Name<input name="name" defaultValue={editing.name} required /></label>
        <label>Building<select name="buildingId" defaultValue={editing.buildingId || ""} required><option value="">Select building</option>{data?.buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}</select></label>
        <label>Mode<select name="mode" defaultValue={editing.mode}><option value="ENTRY">Entry</option><option value="EXIT">Exit</option><option value="ENTRY_EXIT">Entry / Exit</option><option value="REGISTER">Register card</option></select></label>
        <label className="reader-enabled"><input type="checkbox" name="enabled" defaultChecked={editing.enabled} />Approved / enabled</label>
      </fieldset><div className="modal-actions"><button type="button" className="secondary-button" disabled={pending} onClick={() => setEditing(null)}>Cancel</button><ActionButton type="submit" className="primary-button" pending={pending} pendingText="Saving…">Save reader</ActionButton></div></form>
    </section></div>}
  </>;
}
