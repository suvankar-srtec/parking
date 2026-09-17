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
  buildingName = "Assigned building",
  currentUserId,
  currentPermissions,
}: {
  buildingId: string;
  buildingName?: string;
  currentUserId?: string | null;
  currentPermissions?: PermissionKey[];
}) {
  const [open, setOpen] = useState(false);
  const [permissions, setPermissions] = useState<PermissionKey[]>(currentPermissions || defaultPermissionsForRole("EMPLOYEE"));
  const [generatedUserId, setGeneratedUserId] = useState(currentUserId || "");
  const [reservationId, setReservationId] = useState("");
  const [generatingId, setGeneratingId] = useState(false);
  const { notify, refresh } = useFeedback();
  const { pending, execute } = useMutation();

  async function show() {
    setPermissions(currentPermissions || defaultPermissionsForRole("EMPLOYEE"));
    setGeneratedUserId(currentUserId || "");
    setReservationId("");
    setOpen(true);
    if (currentUserId) return;

    setGeneratingId(true);
    try {
      const result = await requestJson<{ ok: true; userId: string; reservationId: string }>("/api/user-ids", "POST", {
        kind: "supervisor",
        scopeId: buildingId,
        name: `Supervisor ${buildingId}`,
      });
      setGeneratedUserId(result.userId);
      setReservationId(result.reservationId);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to generate Supervisor User ID.", "error");
    } finally {
      setGeneratingId(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    if (!generatedUserId || !password.trim()) {
      notify(generatingId ? "Wait for the User ID to finish generating." : "User ID and password are required.", "error");
      return;
    }
    void execute(async () => {
      const result = await requestJson(`/api/buildings/${buildingId}/supervisor`, "POST", { password, permissions, reservationId });
      setOpen(false);
      notify(result.message || "Supervisor account saved.");
      refresh();
    });
  }

  return <>
    <button type="button" className="secondary-button" onClick={() => void show()}>
      {currentUserId ? "Manage supervisor" : "Create supervisor"}
    </button>
    {open && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setOpen(false); }}>
      <section className="modal-card supervisor-permission-modal" role="dialog" aria-modal="true" aria-labelledby="supervisor-title">
        <div className="modal-head">
          <div>
            <div className="section-kicker">USER DETAILS</div>
            <h2 id="supervisor-title">{currentUserId ? "Edit Supervisor" : "Add Supervisor"}</h2>
            <p>User ID is generated automatically. Select only the permissions this Supervisor is allowed to use.</p>
          </div>
          <button type="button" className="modal-close" aria-label="Close" disabled={pending} onClick={() => setOpen(false)}>×</button>
        </div>
        <div className="modal-divider" />
        <form className="modal-form supervisor-permission-form" onSubmit={submit}>
          <fieldset className="entity-fields supervisor-account-fields" disabled={pending}>
            <label>User ID<input value={generatedUserId || (generatingId ? "Generating automatically…" : "Unable to generate")} readOnly /></label>
            <PasswordInput label="Password" name="password" required autoComplete="new-password" placeholder="Password" disabled={pending} />
            <label>Role Name<input value="Supervisor" readOnly /></label>
            <label>Building Allowed<input value={buildingName} readOnly /></label>
          </fieldset>
          <PermissionChecklist role="EMPLOYEE" value={permissions} onChange={setPermissions} disabled={pending} title="Permissions Allowed" />
          <div className="modal-actions">
            <button type="button" className="secondary-button" disabled={pending} onClick={() => setOpen(false)}>Close</button>
            <ActionButton type="submit" className="primary-button" pending={pending || generatingId} pendingText="Saving…">{currentUserId ? "Save" : "Add"}</ActionButton>
          </div>
        </form>
      </section>
    </div>}
    <style>{`
      .supervisor-permission-modal{width:min(900px,96vw);padding:17px 18px}
      .supervisor-permission-form{grid-template-columns:minmax(0,.9fr) minmax(390px,1.1fr);align-items:start;margin-top:12px}
      .supervisor-account-fields{display:grid;gap:10px;border:0;padding:0;margin:0}
      .supervisor-account-fields input[readonly]{background:#f6f8f7;color:#46534c}
      .supervisor-permission-form .modal-actions{grid-column:1/-1}
      @media(max-width:760px){.supervisor-permission-form{grid-template-columns:1fr}.supervisor-permission-form .modal-actions{grid-column:auto}}
    `}</style>
  </>;
}
