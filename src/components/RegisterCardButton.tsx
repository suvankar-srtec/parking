"use client";
import { useState } from "react";
import CardCapture, { type CapturedCard } from "./CardCapture";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { ActionButton } from "./LoadingIndicator";
import { requestJson } from "@/lib/client-request";
export default function RegisterCardButton({ employeeId, vehicleId, plateNumber }: { employeeId: string; vehicleId: string; plateNumber: string }) {
  const [open, setOpen] = useState(false), [card, setCard] = useState<CapturedCard | null>(null);
  const { notify, refresh } = useFeedback(); const { pending, execute } = useMutation();
  return <><button type="button" className="secondary-button" onClick={() => { setCard(null); setOpen(true); }}>Register card</button>
    {open && <div className="modal-backdrop"><section className="modal-card small-modal" role="dialog" aria-modal="true" aria-label="Register RFID card"><div className="modal-head"><h2>Card for {plateNumber}</h2><button className="modal-close" disabled={pending} aria-label="Close card registration" onClick={() => setOpen(false)}>×</button></div>
    <form className="modal-form entity-form" onSubmit={(e) => { e.preventDefault(); if (!card) return; void execute(async () => { const result = await requestJson("/api/rfid/cards", "POST", { vehicleId, enrollmentId: card.enrollmentId }); setOpen(false); notify(result.message || "Card registered."); refresh(); }); }}>
      <fieldset className="entity-fields" disabled={pending}><CardCapture employeeId={employeeId} vehicleId={vehicleId} onCaptured={setCard} /></fieldset>
      <div className="modal-actions"><button type="button" className="secondary-button" disabled={pending} onClick={() => setOpen(false)}>Cancel</button><ActionButton type="submit" className="primary-button" pending={pending} pendingText="Saving…" disabled={!card}>Save card</ActionButton></div>
    </form></section></div>}</>;
}
