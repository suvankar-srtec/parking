"use client";

import { useId, useState, type FormEvent } from "react";
import CardCapture, { type CapturedCard } from "./CardCapture";
import { ActionButton } from "./LoadingIndicator";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { checkForm, requestJson } from "@/lib/client-request";

type Props = {
  companyId: string;
  buildingId: string;
  employee: { id: string; name: string; department: string; parkingLimit: number };
  vehicle?: { id: string; plateNumber: string; isInside: boolean };
  departments: { id: string; name: string }[];
  disabled?: boolean;
};

export default function RegisterEmployeeCard({ companyId, buildingId, employee, vehicle, departments, disabled }: Props) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<CapturedCard | null>(null);
  const { notify, refresh } = useFeedback();
  const { pending, execute } = useMutation();

  function start() {
    if (vehicle?.isInside) { notify("Record the vehicle's exit before registering its card.", "error"); return; }
    if (!vehicle && employee.parkingLimit < 1) { notify("Assign parking to this employee before registering a vehicle and card.", "error"); return; }
    if (!vehicle && !departments.length) { notify("Add a company department before registering this employee's vehicle.", "error"); return; }
    setCard(null);
    setOpen(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const error = checkForm(event.currentTarget);
    if (error) { notify(error, "error"); return; }
    if (!card) { notify("Scan a card using a registration reader first.", "error"); return; }
    const data = new FormData(event.currentTarget);
    const endpoint = vehicle ? "/api/rfid/cards" : "/api/companies/" + companyId + "/employees/" + employee.id + "/vehicles";
    const body = vehicle ? { vehicleId: vehicle.id, enrollmentId: card.enrollmentId } : {
      ownerName: employee.name,
      plateNumber: String(data.get("plateNumber") || "").trim(),
      vehicleType: String(data.get("vehicleType") || ""),
      department: String(data.get("department") || ""),
      workerType: String(data.get("workerType") || ""),
      enrollmentId: card.enrollmentId,
    };
    void execute(async () => {
      await requestJson(endpoint, "POST", body);
      setOpen(false);
      notify("RFID card registered successfully.");
      refresh();
    });
  }

  return <>
    <button className="primary-button" type="button" disabled={disabled} onClick={start}>Register card</button>
    {open && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !pending) setOpen(false); }} onKeyDown={event => { if (event.key === "Escape" && !pending) setOpen(false); }}>
      <section className="modal-card small-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-head">
          <div><div className="section-kicker">RFID REGISTRATION</div><h2 id={titleId}>Register card</h2><p>{employee.name}{vehicle ? " · " + vehicle.plateNumber : " · Add vehicle details and scan a card."}</p></div>
          <button className="modal-close" type="button" aria-label="Close registration" disabled={pending} onClick={() => setOpen(false)}>×</button>
        </div>
        <form className="modal-form entity-form" noValidate onSubmit={submit}>
          <fieldset className="entity-fields" disabled={pending}>
            {!vehicle && <>
              <label>Plate number<input autoFocus name="plateNumber" required placeholder="e.g. KA 01 AB 1234" /></label>
              <label>Vehicle type<select name="vehicleType" required defaultValue=""><option value="" disabled>Select vehicle type</option><option>Two wheeler</option><option>Four wheeler</option></select></label>
              <label>Department<select name="department" required defaultValue={departments.some(d => d.name === employee.department) ? employee.department : ""}><option value="" disabled>Select department</option>{departments.map(d => <option key={d.id}>{d.name}</option>)}</select></label>
              <label>Staff or employee<select name="workerType" required defaultValue="Employee"><option>Employee</option><option>Staff</option></select></label>
            </>}
            <CardCapture buildingId={buildingId} employeeId={employee.id} vehicleId={vehicle?.id} onCaptured={setCard} />
          </fieldset>
          <div className="modal-actions">
            <button type="button" className="secondary-button" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
            <ActionButton type="submit" className="primary-button" pending={pending} pendingText="Registering..." disabled={!card}>Save registration</ActionButton>
          </div>
        </form>
      </section>
    </div>}
  </>;
}
