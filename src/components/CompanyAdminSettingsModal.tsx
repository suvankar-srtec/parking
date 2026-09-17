"use client";

import { useState, type FormEvent } from "react";
import { requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { ActionButton } from "./LoadingIndicator";

export default function CompanyAdminSettingsModal({ companyId, companyName, totalPersons, parkingAllocation }: {
  companyId: string;
  companyName: string;
  totalPersons: number;
  parkingAllocation: number;
}) {
  const { notify, refresh } = useFeedback();
  const { pending, execute } = useMutation();
  const [open, setOpen] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextTotal = Number(data.get("totalPersons"));
    const nextParking = Number(data.get("parkingAllocation"));
    void execute(async () => {
      const result = await requestJson(`/api/companies/${companyId}/admin-settings`, "PATCH", {
        totalPersons: nextTotal,
        parkingAllocation: nextParking,
      });
      notify(result.message || "Company capacity updated.");
      setOpen(false);
      refresh();
    });
  }

  return <>
    <button type="button" className="secondary-button" onClick={() => setOpen(true)}>Edit allocation</button>
    {open ? <div className="modal-backdrop"><section className="modal-card small-modal" role="dialog" aria-modal="true">
      <div className="modal-head"><div><div className="section-kicker">ADMIN ONLY</div><h2>Edit company capacity</h2><p>{companyName}</p></div><button type="button" className="modal-close" onClick={() => setOpen(false)}>×</button></div>
      <form className="modal-form" onSubmit={submit}>
        <fieldset className="entity-fields" disabled={pending}>
          <label>Total Persons (Staff + Employees)<input name="totalPersons" type="number" min="1" step="1" defaultValue={totalPersons} required /></label>
          <label>Company parking<input name="parkingAllocation" type="number" min="0" step="1" defaultValue={parkingAllocation} required /></label>
        </fieldset>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><ActionButton type="submit" className="primary-button" pending={pending} pendingText="Saving…">Save changes</ActionButton></div>
      </form>
    </section></div> : null}
  </>;
}
