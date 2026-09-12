"use client";

import { useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/client-request";
import { useFeedback } from "./FeedbackProvider";
import { Spinner } from "./LoadingIndicator";

export type CapturedCard = { enrollmentId: string; cardNo: string };
type Enrollment = { id: string; status: string; cardNo: string | null };
type Reader = { id: string; name: string };

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
  const [retryKey, setRetryKey] = useState(0);
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
        setReaderId(available[0]?.id || "");
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
    if (loading || !readerId) return;

    let stopped = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    async function prepareReader() {
      setPreparing(true);
      setSetupError("");

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
      } catch (error) {
        if (!stopped && alive.current) {
          setSetupError(error instanceof Error ? error.message : "Unable to prepare the registration reader.");
          retryTimer = setTimeout(() => setRetryKey((value) => value + 1), 3000);
        }
      } finally {
        if (!stopped && alive.current) setPreparing(false);
      }
    }

    void prepareReader();
    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [employeeId, loading, readerId, retryKey, vehicleId]);

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
          notify(`RFID card ${next.cardNo} captured automatically.`);
          return;
        }

        if (["CANCELLED", "EXPIRED"].includes(next.status)) {
          session.current = "";
          callback.current(null);
          setEnrollment(null);
          setRetryKey((value) => value + 1);
          return;
        }
      } catch {
        if (!stopped) {
          timer = setTimeout(poll, 1200);
          return;
        }
      }

      timer = setTimeout(poll, 900);
    }

    timer = setTimeout(poll, 350);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [enrollment, notify]);

  const readerName = readers.find((reader) => reader.id === readerId)?.name || "registration reader";

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
            onChange={(event) => setReaderId(event.target.value)}
          >
            {readers.map((reader) => <option key={reader.id} value={reader.id}>{reader.name}</option>)}
          </select>
        </label>
      ) : (
        <p className="muted">Ask the building administrator to switch a reader to Register card mode.</p>
      )}

      <label>
        RFID Card No.
        <input
          name="rfidCardNo"
          readOnly
          value={enrollment?.cardNo || ""}
          placeholder="Scanned card number"
        />
      </label>

      {preparing && <p role="status"><Spinner /> Preparing {readerName}…</p>}
      {!preparing && setupError && <p className="muted" role="status">{setupError} Retrying automatically…</p>}
      {enrollment?.status === "WAITING" && (
        <p role="status"><Spinner /> Ready. Scan the RFID card on {readerName}. The code will be captured automatically.</p>
      )}
      {enrollment?.status === "CAPTURED" && enrollment.cardNo && (
        <p role="status">Card captured: <strong>{enrollment.cardNo}</strong></p>
      )}
    </div>
  );
}
