"use client";

import { useState, type FormEvent } from "react";
import { requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { ActionButton } from "./LoadingIndicator";
import PasswordInput from "./PasswordInput";

export default function SupervisorManager({ buildingId, currentUserId }: { buildingId: string; currentUserId?: string | null }) {
  const [open, setOpen] = useState(false);
  const { notify, refresh } = useFeedback();
  const { pending, execute } = useMutation();

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
      const result = await requestJson(`/api/buildings/${buildingId}/supervisor`, "POST", { userId, password });
      setOpen(false);
      notify(result.message || "Supervisor account saved.");
      refresh();
    });
  }

  return <>
    <button type="button" className="secondary-button" onClick={() => setOpen(true)}>
      {currentUserId ? "Manage supervisor" : "Create supervisor"}
    </button>
    {open && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setOpen(false); }}>
      <section className="modal-card small-modal" role="dialog" aria-modal="true" aria-labelledby="supervisor-title">
        <div className="modal-head">
          <div><div className="section-kicker">SUPERVISOR ACCOUNT</div><h2 id="supervisor-title">{currentUserId ? "Update supervisor" : "Create supervisor"}</h2><p>Each building has one Supervisor account for live reports and report generation.</p></div>
          <button type="button" className="modal-close" aria-label="Close" disabled={pending} onClick={() => setOpen(false)}>×</button>
        </div>
        <form className="modal-form entity-form" onSubmit={submit}>
          <fieldset className="entity-fields" disabled={pending}>
            <label>User ID<input name="userId" defaultValue={currentUserId || ""} required autoComplete="off" placeholder="e.g. sup01" /></label>
            <PasswordInput label="Password" name="password" required autoComplete="new-password" placeholder="Password" disabled={pending} />
          </fieldset>
          <div className="modal-actions">
            <button type="button" className="secondary-button" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
            <ActionButton type="submit" className="primary-button" pending={pending} pendingText="Saving…">Save supervisor</ActionButton>
          </div>
        </form>
      </section>
    </div>}
  </>;
}
