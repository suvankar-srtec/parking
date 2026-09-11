"use client";
import { useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { ActionButton, Spinner } from "./LoadingIndicator";
export type CapturedCard = { enrollmentId: string; cardNo: string };
type Enrollment = { id: string; status: string; cardNo: string | null };
const cancel = (id: string) => fetch("/api/rfid/enrollments/" + id, { method: "DELETE", keepalive: true }).catch(() => undefined);
export default function CardCapture({ employeeId, vehicleId, onCaptured }: { employeeId: string; vehicleId?: string; onCaptured: (card: CapturedCard | null) => void }) {
  const [readers, setReaders] = useState<{ id: string; name: string }[]>([]);
  const [readerId, setReaderId] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const session = useRef("");
  const alive = useRef(false);
  const callback = useRef(onCaptured); callback.current = onCaptured;
  const { notify } = useFeedback(); const { pending, execute } = useMutation();
  useEffect(() => {
    alive.current = true;
    void fetch("/api/rfid/readers", { cache: "no-store", signal: AbortSignal.timeout(10000) }).then(async (response) => {
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      if (alive.current) { const available = data.readers.filter((r: { enabled: boolean; mode: string }) => r.enabled && r.mode === "REGISTER"); setReaders(available); setReaderId(available[0]?.id || ""); }
    }).catch(() => { if (alive.current) notify("Unable to load registration readers.", "error"); }).finally(() => { if (alive.current) setLoading(false); });
    return () => { alive.current = false; if (session.current) void cancel(session.current); };
  }, [notify]);
  useEffect(() => {
    if (!enrollment) return;
    let stopped = false; let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch("/api/rfid/enrollments/" + enrollment!.id, { cache: "no-store", signal: AbortSignal.timeout(10000) });
        const data = await response.json(); if (!response.ok) throw new Error(data.message);
        if (stopped) return;
        const next = data.enrollment as Enrollment;
        if (next.status === "COMPLETED") return;
        if (next.status === "CAPTURED" && next.cardNo && !enrollment!.cardNo) {
          callback.current({ enrollmentId: next.id, cardNo: next.cardNo }); setEnrollment(next); notify("Card captured. Save the registration."); return;
        }
        if (["CANCELLED","EXPIRED"].includes(next.status)) { callback.current(null); setEnrollment(null); notify("Card registration expired or was cancelled. Scan again.", "error"); return; }
        timer = setTimeout(poll, 1500);
      } catch { if (!stopped) { callback.current(null); setEnrollment(null); notify("Unable to read the scanned card. Try again.", "error"); } }
    }
    timer = setTimeout(poll, 500);
    return () => { stopped = true; clearTimeout(timer); };
  }, [enrollment, notify]);
  function start() {
    void execute(async () => {
      if (session.current) await cancel(session.current);
      callback.current(null); setEnrollment(null);
      const data = await requestJson<{ ok: true; enrollment: Enrollment }>("/api/rfid/enrollments", "POST", { readerId, employeeId, vehicleId });
      if (!alive.current) { void cancel(data.enrollment.id); return; }
      session.current = data.enrollment.id; setEnrollment(data.enrollment); notify("Present the card to the registration reader.");
    });
  }
  return <div className="card-capture">{loading ? <p><Spinner /> Loading readers…</p> : readers.length ? <>
    <label>Registration reader<select value={readerId} disabled={!!enrollment || pending} onChange={(e) => setReaderId(e.target.value)}>{readers.map((reader) => <option key={reader.id} value={reader.id}>{reader.name}</option>)}</select></label>
    <ActionButton type="button" className="secondary-button" pending={pending} pendingText="Preparing reader…" onClick={start}>{enrollment ? "Scan another card" : "Scan card"}</ActionButton>
  </> : <p className="muted">Ask the building administrator to switch a reader to Register card mode.</p>}
    <label>RFID Card No.<input name="rfidCardNo" readOnly value={enrollment?.cardNo || ""} placeholder="Scanned card number" /></label>
    {enrollment?.status === "WAITING" && <p role="status"><Spinner /> Waiting for a card…</p>}
  </div>;
}
