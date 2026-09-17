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
  const [people, setPeople] = useState(String(totalPersons));
  const [parking, setParking] = useState(String(parkingAllocation));

  function show() {
    setPeople(String(totalPersons));
    setParking(String(parkingAllocation));
    setOpen(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTotal = Number(people);
    const nextParking = Number(parking);
    if (!Number.isInteger(nextTotal) || nextTotal < 1) {
      notify("Total Persons must be at least 1.", "error");
      return;
    }
    if (!Number.isInteger(nextParking) || nextParking < 0 || nextParking > nextTotal) {
      notify("Company parking must be between 0 and Total Persons.", "error");
      return;
    }
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

  const availablePeople = Math.max(Number(people || 0) - Number(parking || 0), 0);

  return <>
    <button type="button" className="secondary-button" onClick={show}>Edit allocation</button>
    {open ? <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setOpen(false); }}>
      <section className="modal-card company-capacity-modal" role="dialog" aria-modal="true" aria-labelledby={`company-capacity-${companyId}`}>
        <div className="modal-head company-capacity-head">
          <div>
            <div className="section-kicker">ADMIN COMPANY SETUP</div>
            <h2 id={`company-capacity-${companyId}`}>Edit company capacity</h2>
            <p>Control this company&apos;s total roster size and total parking entitlement. Company/User can only divide the parking internally.</p>
          </div>
          <button type="button" className="modal-close" aria-label="Close" disabled={pending} onClick={() => setOpen(false)}>×</button>
        </div>

        <form className="modal-form company-capacity-form" onSubmit={submit}>
          <div className="company-capacity-company">
            <span>COMPANY</span>
            <strong>{companyName}</strong>
          </div>

          <div className="capacity-grid">
            <label className="capacity-card capacity-card-primary">
              <span className="capacity-number">01</span>
              <span className="capacity-copy"><strong>Total Persons</strong><small>Staff + Employees in the company roster</small></span>
              <input name="totalPersons" type="number" min="1" step="1" value={people} disabled={pending} onChange={(event) => setPeople(event.target.value)} required />
            </label>

            <label className="capacity-card">
              <span className="capacity-number">02</span>
              <span className="capacity-copy"><strong>Company Parking</strong><small>Total parking spaces assigned by Admin</small></span>
              <input name="parkingAllocation" type="number" min="0" step="1" value={parking} disabled={pending} onChange={(event) => setParking(event.target.value)} required />
            </label>
          </div>

          <div className="capacity-preview">
            <div><span>Employee roster</span><strong>{Number(people || 0)}</strong><small>EMP-1 to EMP-{Math.max(Number(people || 0), 1)}</small></div>
            <div><span>Parking assigned</span><strong>{Number(parking || 0)}</strong><small>Company/User divides Owner vs Employee parking</small></div>
            <div><span>Without parking</span><strong>{availablePeople}</strong><small>Roster members do not automatically consume parking</small></div>
          </div>

          <div className="capacity-note">
            Increasing Total Persons automatically creates new employee roster slots. Reducing it removes only unused placeholder slots and never deletes named employees or vehicle/RFID history.
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
            <ActionButton type="submit" className="primary-button" pending={pending} pendingText="Updating…">Update capacity</ActionButton>
          </div>
        </form>
      </section>
      <style>{`
        .company-capacity-modal{width:min(720px,calc(100vw - 28px));padding:0;overflow:hidden;border-radius:14px}
        .company-capacity-head{padding:18px 20px 14px;margin:0;border-bottom:1px solid #e0e7e3}
        .company-capacity-head h2{font-size:21px;margin-top:3px}.company-capacity-head p{max-width:590px;margin-top:5px;line-height:1.45}
        .company-capacity-form{padding:16px 20px 18px;margin:0;display:grid;gap:14px}
        .company-capacity-company{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:9px 11px;border-radius:8px;background:#f6f8f7;border:1px solid #e1e7e3}.company-capacity-company span{font-size:9px;font-weight:900;color:#7d4aae;letter-spacing:.6px}.company-capacity-company strong{font-size:13px;color:#21352a}
        .capacity-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.capacity-card{display:grid!important;grid-template-columns:32px minmax(0,1fr) 92px;align-items:center;gap:9px!important;padding:11px!important;border:1px solid #d7e0db;border-radius:10px;background:#fbfcfb}.capacity-card-primary{background:#faf7fc;border-color:#dfd1eb}.capacity-number{display:grid;place-items:center;width:28px;height:28px;border-radius:7px;background:#eee5f5;color:#7b46a4;font-size:10px;font-weight:900}.capacity-copy{display:grid;gap:2px}.capacity-copy strong{font-size:11px;color:#26382f}.capacity-copy small{font-size:8.5px;color:#76827b;line-height:1.3}.capacity-card input{width:92px!important;min-height:40px!important;padding:7px 9px!important;font-size:17px!important;font-weight:800;color:#7140a0;text-align:center}
        .capacity-preview{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.capacity-preview>div{display:grid;gap:3px;padding:10px;border:1px solid #dde5e1;border-radius:9px;background:#fff}.capacity-preview span{font-size:9px;font-weight:700;color:#617168}.capacity-preview strong{font-size:19px;color:#713ea2}.capacity-preview small{font-size:8px;color:#7b8780;line-height:1.3}
        .capacity-note{padding:9px 11px;border-radius:8px;background:#eef6f2;color:#54665c;font-size:9px;line-height:1.45}
        .company-capacity-form .modal-actions{margin-top:0;padding-top:13px;border-top:1px solid #e2e8e5}
        @media(max-width:640px){.capacity-grid,.capacity-preview{grid-template-columns:1fr}.capacity-card{grid-template-columns:32px minmax(0,1fr) 86px}}
      `}</style>
    </div> : null}
  </>;
}
