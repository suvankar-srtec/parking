"use client";

import { useState, type FormEvent } from "react";
import { requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { ActionButton } from "./LoadingIndicator";

type EmployeeSummary = {
  id: string;
  name: string;
  userId: string;
  category: string;
  parkingLimit: number;
};

export default function EditEmployeeModal({ companyId, employee }: { companyId: string; employee: EmployeeSummary }) {
  const { notify, refresh } = useFeedback();
  const { pending, execute } = useMutation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(employee.name);
  const [category, setCategory] = useState(employee.category);
  const [parkingLimit, setParkingLimit] = useState(employee.parkingLimit);

  function show() {
    setName(employee.name);
    setCategory(employee.category);
    setParkingLimit(employee.parkingLimit);
    setOpen(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      notify("Enter the employee or company owner name.", "error");
      return;
    }
    if (!Number.isInteger(parkingLimit) || parkingLimit < 1) {
      notify("Parking limit must be at least 1.", "error");
      return;
    }

    void execute(async () => {
      const result = await requestJson<{ ok: true; message: string }>(
        `/api/companies/${companyId}/employees/${employee.id}`,
        "PATCH",
        { name: cleanName, category, parkingLimit },
      );
      setOpen(false);
      notify(result.message || "Employee updated successfully.");
      refresh();
    });
  }

  return <>
    <button type="button" className="secondary-button employee-edit-button" onClick={show}>Edit</button>
    {open && <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !pending) setOpen(false);
    }} onKeyDown={(event) => { if (event.key === "Escape" && !pending) setOpen(false); }}>
      <section className="modal-card small-modal" role="dialog" aria-modal="true" aria-labelledby={`edit-employee-${employee.id}`}>
        <div className="modal-head">
          <div>
            <div className="section-kicker">EDIT PERSON</div>
            <h2 id={`edit-employee-${employee.id}`}>{employee.category === "OWNER" ? "Edit company owner" : "Edit employee"}</h2>
            <p>User ID {employee.userId} remains unchanged.</p>
          </div>
          <button type="button" className="modal-close" aria-label="Close form" disabled={pending} onClick={() => setOpen(false)}>×</button>
        </div>
        <form className="modal-form entity-form" aria-busy={pending} onSubmit={submit}>
          <fieldset className="entity-fields" disabled={pending}>
            <label>Name<input value={name} onChange={(event) => setName(event.target.value)} required autoFocus /></label>
            <label>User ID<input value={employee.userId} readOnly /></label>
            <label>Type<select value={category} onChange={(event) => setCategory(event.target.value)} required><option value="EMPLOYEE">Employee</option><option value="OWNER">Company Owner</option></select></label>
            <label>Parking lot limit<input type="number" min="1" step="1" value={parkingLimit} onChange={(event) => setParkingLimit(Number(event.target.value))} required /></label>
          </fieldset>
          <div className="modal-actions">
            <button type="button" className="secondary-button" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
            <ActionButton type="submit" className="primary-button" pending={pending} pendingText="Updating…">Save changes</ActionButton>
          </div>
        </form>
      </section>
    </div>}
  </>;
}
