"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { requestJson } from "@/lib/client-request";
import { defaultPermissionsForRole, type PermissionKey } from "@/lib/permissions";
import { useFeedback, useMutation } from "./FeedbackProvider";
import PermissionChecklist from "./PermissionChecklist";
import PasswordInput from "./PasswordInput";
import { ActionButton } from "./LoadingIndicator";

export default function AdminCompanyModal({ buildingId }: { buildingId: string }) {
  const { notify, refresh } = useFeedback();
  const { pending, execute } = useMutation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");
  const [reservationId, setReservationId] = useState("");
  const [permissions, setPermissions] = useState<PermissionKey[]>(() => defaultPermissionsForRole("COMPANY_ADMIN"));
  const [departmentLimit, setDepartmentLimit] = useState(1);
  const reservationRef = useRef("");

  useEffect(() => {
    if (!open || !name.trim()) { setUserId(""); setReservationId(""); reservationRef.current = ""; return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void requestJson<{ ok: true; userId: string; reservationId: string }>("/api/user-ids", "POST", {
        kind: "company", scopeId: buildingId, name: name.trim(), previousReservationId: reservationRef.current,
      }, controller.signal).then((result) => {
        setUserId(result.userId); setReservationId(result.reservationId); reservationRef.current = result.reservationId;
      }).catch(() => { if (!controller.signal.aborted) { setUserId(""); setReservationId(""); } });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, name, buildingId]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !reservationId) { notify("Enter the company name and wait for the generated User ID.", "error"); return; }
    const data = new FormData(event.currentTarget);
    const totalPersons = Number(data.get("totalPersons"));
    const parkingAllocation = Number(data.get("parkingAllocation"));
    if (!Number.isInteger(totalPersons) || totalPersons < 1) { notify("Total Persons must be at least 1.", "error"); return; }
    if (!Number.isInteger(parkingAllocation) || parkingAllocation < 0 || parkingAllocation > totalPersons) { notify("Company parking must be between 0 and Total Persons.", "error"); return; }
    void execute(async () => {
      const result = await requestJson(`/api/buildings/${buildingId}/companies`, "POST", {
        name: name.trim(), userId, reservationId,
        password: String(data.get("password") || ""),
        totalPersons, parkingAllocation, maximumDepartments: departmentLimit, permissions,
      });
      notify(result.message || "Company created successfully.");
      setOpen(false); refresh();
    });
  }

  return <>
    <button type="button" className="add-building-button" onClick={() => { setOpen(true); setName(""); setPermissions(defaultPermissionsForRole("COMPANY_ADMIN")); }}><span className="plus-icon">+</span>New company</button>
    {open ? <div className="modal-backdrop"><section className="modal-card permission-modal" role="dialog" aria-modal="true">
      <div className="modal-head permission-modal-head"><div><div className="section-kicker">COMPANY SETUP</div><h2>Create company</h2><p>Admin defines total people and total parking. Company/User later separates that parking between owners and employees.</p></div><button type="button" className="modal-close" onClick={() => setOpen(false)}>×</button></div>
      <form className="modal-form permission-layout-form" onSubmit={submit}>
        <div className="entity-main-column setup-card">
          <fieldset className="entity-fields compact-entity-fields" disabled={pending}>
            <label>Company name<input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Pvt Ltd" /></label>
            <label>User ID<input readOnly value={userId || "Generated automatically"} /></label>
            <PasswordInput label="Password" name="password" required autoComplete="new-password" placeholder="Password" disabled={pending} />
            <label>Total Persons (Staff + Employees)<input name="totalPersons" type="number" min="1" step="1" defaultValue="1" required /></label>
            <label>Company parking<input name="parkingAllocation" type="number" min="0" step="1" defaultValue="0" required /></label>
            <div className="department-limit-field"><span>Department limit</span><div className="department-stepper"><button type="button" onClick={() => setDepartmentLimit(v => Math.max(1, v - 1))}>−</button><strong>{departmentLimit}</strong><button type="button" onClick={() => setDepartmentLimit(v => Math.min(500, v + 1))}>+</button></div></div>
          </fieldset>
        </div>
        <aside className="permission-side-panel"><PermissionChecklist role="COMPANY_ADMIN" value={permissions} onChange={setPermissions} disabled={pending} title="Permissions Allowed" /></aside>
        <div className="modal-actions permission-modal-actions"><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><ActionButton type="submit" className="primary-button" pending={pending} pendingText="Creating…">Create company</ActionButton></div>
      </form>
    </section></div> : null}
  </>;
}
