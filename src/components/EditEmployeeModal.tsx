"use client";

import { useState, type FormEvent } from "react";
import { requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { ActionButton } from "./LoadingIndicator";
import DepartmentPicker from "./DepartmentPicker";

type DepartmentOption = { id: string; name: string };
type EmployeeSummary = {
  id: string;
  name: string;
  userId: string;
  category: string;
  parkingLimit: number;
  department: string;
  isPlaceholder?: boolean;
  slotNumber?: number | null;
};

export default function EditEmployeeModal({ companyId, employee, departments }: { companyId: string; employee: EmployeeSummary; departments: DepartmentOption[] }) {
  const { notify, refresh } = useFeedback();
  const { pending: saving, execute } = useMutation();
  const [departmentBusy, setDepartmentBusy] = useState(false);
  const pending = saving || departmentBusy;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(employee.name);
  const [department, setDepartment] = useState(employee.department === "Unassigned" ? "" : employee.department);

  function show() {
    setName(employee.isPlaceholder ? "" : employee.name);
    setDepartment(employee.department === "Unassigned" ? "" : employee.department);
    setOpen(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const cleanName = name.trim();
    if (!cleanName) {
      notify("Enter the employee name.", "error");
      return;
    }
    if (!department) {
      notify("Select a department.", "error");
      return;
    }

    void execute(async () => {
      const result = await requestJson<{ ok: true; message: string }>(
        `/api/companies/${companyId}/employees/${employee.id}`,
        "PATCH",
        { name: cleanName, department },
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
            <div className="section-kicker">EMPLOYEE ROSTER</div>
            <h2 id={`edit-employee-${employee.id}`}>Edit employee</h2>
            <p>{employee.slotNumber ? `Employee slot EMP-${employee.slotNumber}.` : `User ID ${employee.userId}.`} Update the employee name and department.</p>
          </div>
          <button type="button" className="modal-close" aria-label="Close form" disabled={pending} onClick={() => setOpen(false)}>×</button>
        </div>
        <form className="modal-form entity-form" aria-busy={pending} onSubmit={submit}>
          <fieldset className="entity-fields" disabled={pending}>
            <label>Name<input value={name} onChange={(event) => setName(event.target.value)} required autoFocus placeholder="Employee name" /></label>
            <label>Employee Slot<input value={employee.slotNumber ? `EMP-${employee.slotNumber}` : employee.userId} readOnly /></label>
            <DepartmentPicker companyId={companyId} departments={departments} value={department} onChange={setDepartment} disabled={pending} onBusyChange={setDepartmentBusy} />
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
