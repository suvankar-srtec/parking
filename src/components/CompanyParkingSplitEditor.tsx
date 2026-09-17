"use client";

import { useState, type FormEvent } from "react";
import { requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { ActionButton } from "./LoadingIndicator";

export default function CompanyParkingSplitEditor({
  companyId,
  parkingAllocation,
  initialOwnerParking,
  initialEmployeeParking,
}: {
  companyId: string;
  parkingAllocation: number;
  initialOwnerParking: number;
  initialEmployeeParking: number;
}) {
  const { notify, refresh } = useFeedback();
  const { pending, execute } = useMutation();
  const [ownerParking, setOwnerParking] = useState(initialOwnerParking);
  const employeeParking = Math.max(parkingAllocation - ownerParking, 0);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Number.isInteger(ownerParking) || ownerParking < 0 || ownerParking > parkingAllocation) {
      notify(`Company Owner parking must be between 0 and ${parkingAllocation}.`, "error");
      return;
    }
    void execute(async () => {
      const result = await requestJson(`/api/companies/${companyId}/parking-split`, "PATCH", {
        ownerParkingAllocation: ownerParking,
        employeeParkingAllocation: employeeParking,
      });
      notify(result.message || "Parking split updated.");
      refresh();
    });
  }

  return <form className="parking-editor" onSubmit={submit} aria-busy={pending}>
    <div className="parking-editor-grid">
      <label className="parking-input-card">
        <span>Total company parking</span>
        <div className="parking-input-wrap"><input value={parkingAllocation} readOnly /><span>spaces</span></div>
      </label>
      <label className="parking-input-card">
        <span>Company Owner parking</span>
        <div className="parking-input-wrap"><input type="number" min="0" max={parkingAllocation} step="1" value={ownerParking} onChange={(e) => setOwnerParking(Number(e.target.value))} disabled={pending} /><span>spaces</span></div>
      </label>
      <label className="parking-input-card">
        <span>Employee parking</span>
        <div className="parking-input-wrap"><input value={employeeParking} readOnly /><span>spaces</span></div>
      </label>
    </div>
    <div className="parking-editor-footer"><div className="parking-edit-actions"><ActionButton type="submit" className="primary-button" pending={pending} pendingText="Updating…">Update parking split</ActionButton></div></div>
  </form>;
}
