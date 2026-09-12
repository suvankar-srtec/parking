"use client";

import { useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/client-request";
import { useFeedback } from "./FeedbackProvider";
import { Spinner } from "./LoadingIndicator";

export type CapturedCard = { enrollmentId: string; cardNo: string };
type Enrollment = { id: string; status: string; cardNo: string | null; expiresAt?: string };
type Reader = { id: string; name: string };

const SCAN_WINDOW_SECONDS = 30;

const cancel = (id: string) =>
  fetch("/api/rfid/enrollments/" + id, { method: "DELETE", keepalive: true }).catch(() => undefined);

export default function CardCapture({
  employeeId,
  vehicleId,
  onCaptured,
}: {
  employeeId: string;
  vehicleId?: string;
  onCaptured: (card: CapturedCard | null) => void;
}) {
  const [readers, setReaders] = useState<Reader[]>([]);
  const [readerId, setReaderId] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const session = useRef("");
  const alive = useRef(false);
  const callback = useRef(onCaptured);
  callback.current = onCaptured;
  const { notify } = useFeedback();

  useEffect(() => {
    alive.current = true;
    void fetch("/api/rfid/readers", {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        if (!alive.current) return;
        const available = data.readers.filter(
          (reader: { enabled: boolean; mode: string }) => reader.enabled && reader.mode === "REGISTER",
        ) as Reader[];
        setReaders(available);
      })
      .catch(() => {
        if (alive.current) notify("Unable to load registration readers.", "error");
      })
      .finally(() => {
        if (alive.current) setLoading(false);
      });

    return () => {
      alive.current = false;
      if (session.current) void cancel(session.current);
    };
  }, [notify]);

  useEffect(() => {
    if (!readerId || loading) return;

    let stopped = false;

    async function prepareReader() {
      setPreparing(true);
      setSetupError("");
      setTimedOut(false);
      setSecondsLeft(0);

      const previous = session.current;
      session.current = "";
      if (previous) await cancel(previous);
      if (stopped || !alive.current) return;

      callback.current(null);
      setEnrollment(null);

      try {
        const data = await requestJson<{ ok: true; enrollment: Enrollment }>(
          "/api/rfid/enrollments",
          "POST",
          { readerId, employeeId, vehicleId },
        );
        if (stopped || !alive.current) {
          void cancel(data.enrollment.id);
          return;
        }
        session.current = data.enrollment.id;
        setEnrollment(data.enrollment);
        setSecondsLeft(SCAN_WINDOW_SECONDS);
      } catch (error) {
        if (!stopped && alive.current) {
          setSetupError(error instanceof Error ? error.message : "Unable to prepare the registration reader.");
          setReaderId("");
        }
      } finally {
        if (!stopped && alive.current) setPreparing(false);
      }
    }

    void prepareReader();
    return () => { stopped = true; };
  }, [employeeId, loading, readerId, vehicleId]);

  useEffect(() => {
    if (!enrollment || enrollment.status !== "WAITING" || secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [enrollment, secondsLeft]);

  useEffect(() => {
    if (!enrollment || enrollment.status !== "WAITING" || secondsLeft !== 0) return;
    const id = enrollment.id;
    session.current = "";
    void cancel(id);
    callback.current(null);
    setEnrollment(null);
    setTimedOut(true);
    setReaderId("");
  }, [enrollment, secondsLeft]);

  useEffect(() => {
    if (!enrollment || enrollment.status !== "WAITING") return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const response = await fetch("/api/rfid/enrollments/" + enrollment!.id, {
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        if (stopped) return;

        const next = data.enrollment as Enrollment;
        if (next.status === "COMPLETED") return;

        if (next.status === "CAPTURED" && next.cardNo) {
          callback.current({ enrollmentId: next.id, cardNo: next.cardNo });
          setEnrollment(next);
          setSecondsLeft(0);
          notify(`RFID card ${next.cardNo} captured automatically.`);
          return;
        }

        if (["CANCELLED", "EXPIRED"].includes(next.status)) {
          session.current = "";
          callback.current(null);
          setEnrollment(null);
          setSecondsLeft(0);
          setTimedOut(next.status === "EXPIRED");
          setReaderId("");
          return;
        }
      } catch {
        // Keep polling during the active 30-second capture window.
      }

      timer = setTimeout(poll, 700);
    }

    timer = setTimeout(poll, 250);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [enrollment, notify]);

  const readerName = readers.find((reader) => reader.id === readerId)?.name || "registration reader";
  const progress = Math.max(0, Math.min(1, secondsLeft / SCAN_WINDOW_SECONDS));
  const circumference = 2 * Math.PI * 18;

  return (
    <div className="card-capture">
      {loading ? (
        <p><Spinner /> Loading readers…</p>
      ) : readers.length ? (
        <label>
          Registration reader
          <select
            value={readerId}
            disabled={preparing || enrollment?.status === "CAPTURED"}
            onChange={(event) => {
              setSetupError("");
              setTimedOut(false);
              setReaderId(event.target.value);
            }}
          >
            <option value="">Select registration reader</option>
            {readers.map((reader) => <option key={reader.id} value={reader.id}>{reader.name}</option>)}
          </select>
        </label>
      ) : (
        <p className="muted">Ask the building administrator to switch a reader to Register card mode.</p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: enrollment?.status === "WAITING" ? "1fr 54px" : "1fr", gap: 12, alignItems: "end" }}>
        <label>
          RFID Card No.
          <input
            name="rfidCardNo"
            readOnly
            value={enrollment?.cardNo || ""}
            placeholder="Scanned card number"
          />
        </label>

        {enrollment?.status === "WAITING" ? (
          <div title={`${secondsLeft} seconds remaining`} style={{ width: 54, height: 54, position: "relative", display: "grid", placeItems: "center" }}>
            <svg width="54" height="54" viewBox="0 0 44 44" aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="4" />
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
              />
            </svg>
            <strong style={{ position: "absolute", fontSize: 12 }}>{secondsLeft}</strong>
          </div>
        ) : null}
      </div>

      {preparing && <p role="status"><Spinner /> Preparing {readerName}…</p>}
      {!preparing && setupError && <p className="muted" role="status">{setupError}</p>}
      {timedOut && <p className="muted" role="status">Time up. Select the registration reader again and scan the card within 30 seconds.</p>}
      {enrollment?.status === "WAITING" && (
        <p role="status"><Spinner /> Scan the RFID card on {readerName} within {secondsLeft} seconds.</p>
      )}
      {enrollment?.status === "CAPTURED" && enrollment.cardNo && (
        <p role="status">Card captured: <strong>{enrollment.cardNo}</strong></p>
      )}
    </div>
  );
}
