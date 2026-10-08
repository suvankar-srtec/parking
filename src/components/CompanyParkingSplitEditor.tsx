"use client";

import { useState, type FormEvent } from "react";
import { requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { ActionButton } from "./LoadingIndicator";

export default function CompanyParkingSplitEditor({
  companyId,
  parkingAllocation,
  initialOwnerParking,
  initialVisitorParking,
  initialEmployeeParking,
}: {
  companyId: string;
  parkingAllocation: number;
  initialOwnerParking: number;
  initialVisitorParking: number;
  initialEmployeeParking: number;
}) {
  const { notify, refresh } = useFeedback();
  const { pending, execute } = useMutation();
  const [ownerParking, setOwnerParking] = useState(initialOwnerParking);
  const [visitorParking, setVisitorParking] = useState(initialVisitorParking);
  const employeeParking = Math.max(parkingAllocation - ownerParking - visitorParking, 0);

  function changeVisitor(nextVisitor: number) {
    if (!Number.isFinite(nextVisitor)) return;
    const delta = nextVisitor - visitorParking;
    setVisitorParking(nextVisitor);
    setOwnerParking((current) => current - delta);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Number.isInteger(ownerParking) || ownerParking < 0) {
      notify("Company Owner parking must be a whole number of 0 or greater.", "error");
      return;
    }
    if (!Number.isInteger(visitorParking) || visitorParking < 0) {
      notify("Visitor parking must be a whole number of 0 or greater.", "error");
      return;
    }
    if (ownerParking + visitorParking > parkingAllocation) {
      notify("Company Owner parking plus Visitor parking cannot exceed Total company parking.", "error");
      return;
    }

    void execute(async () => {
      const result = await requestJson(`/api/companies/${companyId}/parking-split`, "PATCH", {
        ownerParkingAllocation: ownerParking,
        visitorParkingAllocation: visitorParking,
        employeeParkingAllocation: employeeParking,
      });
      notify(result.message || "Parking split updated.");
      refresh();
    });
  }

  return <form className="parking-editor" onSubmit={submit} aria-busy={pending}>
    <div className="parking-editor-grid company-parking-split-grid">
      <label className="parking-input-card">
        <span>Total company parking</span>
        <div className="parking-input-wrap"><input value={parkingAllocation} readOnly /><span>spaces</span></div>
      </label>
      <label className="parking-input-card">
        <span>Company Owner parking</span>
        <div className="parking-input-wrap"><input type="number" min="0" max={parkingAllocation - visitorParking} step="1" value={ownerParking} onChange={(e) => setOwnerParking(Number(e.target.value))} disabled={pending} /><span>spaces</span></div>
      </label>
      <label className="parking-input-card">
        <span>Visitor parking</span>
        <div className="parking-input-wrap"><input type="number" min="0" max={parkingAllocation} step="1" value={visitorParking} onChange={(e) => changeVisitor(Number(e.target.value))} disabled={pending} /><span>spaces</span></div>
      </label>
      <label className="parking-input-card">
        <span>Employee parking</span>
        <div className="parking-input-wrap"><input value={employeeParking} readOnly /><span>spaces</span></div>
      </label>
    </div>
    <div className="parking-editor-footer"><div className="parking-edit-actions"><ActionButton type="submit" className="primary-button" pending={pending} pendingText="Updating…">Update parking split</ActionButton></div></div>
    <style>{`
      .company-parking-split-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
      @media(max-width:900px){.company-parking-split-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:640px){.company-parking-split-grid{grid-template-columns:1fr}}
    `}</style>
  </form>;
}
