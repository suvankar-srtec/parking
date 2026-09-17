"use client";

import { useState, type FormEvent } from "react";
import { requestJson } from "@/lib/client-request";
import { defaultPermissionsForRole, type PermissionKey } from "@/lib/permissions";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { ActionButton } from "./LoadingIndicator";
import PasswordInput from "./PasswordInput";
import PermissionChecklist from "./PermissionChecklist";

export default function SupervisorManager({
  buildingId,
  currentUserId,
  currentPermissions,
}: {
  buildingId: string;
  currentUserId?: string | null;
  currentPermissions?: PermissionKey[];
}) {
  const [open, setOpen] = useState(false);
  const [permissions, setPermissions] = useState<PermissionKey[]>(currentPermissions || defaultPermissionsForRole("EMPLOYEE"));
  const { notify, refresh } = useFeedback();
  const { pending, execute } = useMutation();

  function show() {
    setPermissions(currentPermissions || defaultPermissionsForRole("EMPLOYEE"));
    setOpen(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const userId = String(data.get("userId") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!userId || !password.trim()) {
      notify("Enter supervisor User ID and password.", "error");
      return;
    }
    void execute(async () => {
      const result = await requestJson(`/api/buildings/${buildingId}/supervisor`, "POST", { userId, password, permissions });
      setOpen(false);
      notify(result.message || "Supervisor account saved.");
      refresh();
    });
  }

  return <>
    <button type="button" className="secondary-button" onClick={show}>
      {currentUserId ? "Manage supervisor" : "Create supervisor"}
    </button>
    {open && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setOpen(false); }}>
      <section className="modal-card supervisor-permission-modal" role="dialog" aria-modal="true" aria-labelledby="supervisor-title">
        <div className="modal-head">
          <div><div className="section-kicker">SUPERVISOR ACCOUNT</div><h2 id="supervisor-title">{currentUserId ? "Update supervisor" : "Create supervisor"}</h2><p>Choose exactly which monitoring features this Supervisor can access in the assigned building.</p></div>
          <button type="button" className="modal-close" aria-label="Close" disabled={pending} onClick={() => setOpen(false)}>×</button>
        </div>
        <form className="modal-form supervisor-permission-form" onSubmit={submit}>
          <fieldset className="entity-fields supervisor-account-fields" disabled={pending}>
            <label>User ID<input name="userId" defaultValue={currentUserId || ""} required autoComplete="off" placeholder="e.g. sup01" /></label>
            <PasswordInput label="Password" name="password" required autoComplete="new-password" placeholder="Password" disabled={pending} />
          </fieldset>
          <PermissionChecklist role="EMPLOYEE" value={permissions} onChange={setPermissions} disabled={pending} title="Supervisor" />
          <div className="modal-actions">
            <button type="button" className="secondary-button" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
            <ActionButton type="submit" className="primary-button" pending={pending} pendingText="Saving…">Save supervisor</ActionButton>
          </div>
        </form>
      </section>
    </div>}
    <style>{`
      .supervisor-permission-modal{width:min(860px,96vw);padding:17px 18px}
      .supervisor-permission-form{grid-template-columns:minmax(0,.8fr) minmax(360px,1.2fr);align-items:start;margin-top:12px}
      .supervisor-account-fields{display:grid;gap:10px;border:0;padding:0;margin:0}
      .supervisor-permission-form .modal-actions{grid-column:1/-1}
      @media(max-width:760px){.supervisor-permission-form{grid-template-columns:1fr}.supervisor-permission-form .modal-actions{grid-column:auto}}
    `}</style>
  </>;
}
