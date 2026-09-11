"use client";

import { useState, type FormEvent } from "react";
import { checkForm, requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { ActionButton } from "./LoadingIndicator";
import CardCapture, { type CapturedCard } from "./CardCapture";

const departments = ["Admin", "Finance", "HR", "IT", "Operations", "Security", "Other"];
const vehicleTypes = ["Two wheeler", "Four wheeler"];

export default function VehicleModal({ companyId, employeeId, ownerName }: { companyId: string; employeeId: string; ownerName: string }) {
  const { notify, refresh } = useFeedback();
  const { pending, execute } = useMutation();
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<CapturedCard | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const error = checkForm(form);
    if (error) { notify(error, "error"); return; }
    const data = new FormData(form);
    const body = {
      ownerName: String(data.get("ownerName") ?? "").trim(),
      plateNumber: String(data.get("plateNumber") ?? "").trim(),
      vehicleType: String(data.get("vehicleType") ?? ""),
      workerType: String(data.get("workerType") ?? ""),
      department: String(data.get("department") ?? ""),
      enrollmentId: card?.enrollmentId,
    };
    void execute(async () => {
      const result = await requestJson(`/api/companies/${companyId}/employees/${employeeId}/vehicles`, "POST", body);
      setOpen(false);
      notify(result.message || "Vehicle registered successfully.");
      refresh();
    });
  }
  return <>
    <button type="button" className="secondary-button vehicle-add-button" onClick={() => { setCard(null); setOpen(true); }}>Add vehicle</button>
    {open && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setOpen(false); }}>
      <section className="modal-card small-modal" role="dialog" aria-modal="true" aria-labelledby="vehicle-modal-title">
        <div className="modal-head"><div><div className="section-kicker">VEHICLE REGISTRATION</div><h2 id="vehicle-modal-title">Add vehicle</h2><p>{ownerName}'s vehicle is linked to this company automatically.</p></div><button type="button" className="modal-close" aria-label="Close form" disabled={pending} onClick={() => setOpen(false)}>×</button></div>
        <form className="modal-form entity-form" noValidate onSubmit={submit}>
          <fieldset className="entity-fields" disabled={pending}>
            <label>Owner Name<input name="ownerName" defaultValue={ownerName} required /></label>
            <label>Plate Number<input name="plateNumber" required placeholder="e.g. KA 01 AB 1234" /></label>
            <label>Vehicle Type<select name="vehicleType" defaultValue="" required><option value="" disabled>Select vehicle type</option>{vehicleTypes.map((vehicleType) => <option key={vehicleType}>{vehicleType}</option>)}</select></label>
            <label>Department<select name="department" defaultValue="Admin" required>{departments.map((department) => <option key={department}>{department}</option>)}</select></label>
            <label>Staff or Employee<select name="workerType" defaultValue="" required><option value="" disabled>Select type</option><option>Staff</option><option>Employee</option></select></label>
            <CardCapture employeeId={employeeId} onCaptured={setCard} />
          </fieldset>
          <div className="modal-actions"><button type="button" className="secondary-button" disabled={pending} onClick={() => setOpen(false)}>Cancel</button><ActionButton type="submit" className="primary-button" pending={pending} pendingText="Registering...">Register vehicle</ActionButton></div>
        </form>
      </section>
    </div>}
  </>;
}
