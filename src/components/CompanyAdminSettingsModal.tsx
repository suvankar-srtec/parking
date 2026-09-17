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

  const personCount = Math.max(Number(people || 0), 0);
  const parkingCount = Math.max(Number(parking || 0), 0);
  const withoutParking = Math.max(personCount - parkingCount, 0);
  const changed = personCount !== totalPersons || parkingCount !== parkingAllocation;

  return <>
    <button type="button" className="secondary-button" onClick={show}>Edit allocation</button>
    {open ? <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !pending) setOpen(false);
    }} onKeyDown={(event) => {
      if (event.key === "Escape" && !pending) setOpen(false);
    }}>
      <section className="modal-card company-capacity-modal" role="dialog" aria-modal="true" aria-labelledby={`company-capacity-${companyId}`}>
        <div className="modal-head company-capacity-head">
          <div>
            <div className="section-kicker">ADMIN COMPANY SETUP</div>
            <h2 id={`company-capacity-${companyId}`}>Edit company capacity</h2>
            <p>Set the company roster size and total parking assigned by the Building Admin.</p>
          </div>
          <button type="button" className="modal-close" aria-label="Close" disabled={pending} onClick={() => setOpen(false)}>×</button>
        </div>

        <form className="company-capacity-form" onSubmit={submit}>
          <div className="company-capacity-company">
            <div>
              <span>COMPANY</span>
              <strong>{companyName}</strong>
            </div>
            <div className="company-capacity-badge">Admin controlled</div>
          </div>

          <div className="capacity-fields">
            <div className="capacity-field">
              <div className="capacity-field-head">
                <span className="capacity-step">01</span>
                <div>
                  <label htmlFor={`total-persons-${companyId}`}>Total Persons</label>
                  <p>Staff + Employees available in this company roster.</p>
                </div>
              </div>
              <div className="capacity-input-wrap">
                <input
                  id={`total-persons-${companyId}`}
                  name="totalPersons"
                  type="number"
                  min="1"
                  step="1"
                  value={people}
                  disabled={pending}
                  onChange={(event) => setPeople(event.target.value)}
                  required
                />
                <span>people</span>
              </div>
            </div>

            <div className="capacity-field">
              <div className="capacity-field-head">
                <span className="capacity-step">02</span>
                <div>
                  <label htmlFor={`company-parking-${companyId}`}>Company Parking</label>
                  <p>Total parking spaces assigned to this company.</p>
                </div>
              </div>
              <div className="capacity-input-wrap">
                <input
                  id={`company-parking-${companyId}`}
                  name="parkingAllocation"
                  type="number"
                  min="0"
                  step="1"
                  value={parking}
                  disabled={pending}
                  onChange={(event) => setParking(event.target.value)}
                  required
                />
                <span>spaces</span>
              </div>
            </div>
          </div>

          <div className="capacity-summary">
            <div>
              <span>Employee roster</span>
              <strong>{personCount}</strong>
              <small>{personCount > 0 ? `EMP-1 to EMP-${personCount}` : "No roster slots"}</small>
            </div>
            <div>
              <span>Parking assigned</span>
              <strong>{parkingCount}</strong>
              <small>Owner + Employee parking pool</small>
            </div>
            <div>
              <span>Without parking</span>
              <strong>{withoutParking}</strong>
              <small>Roster members without a parking allocation</small>
            </div>
          </div>

          <div className="capacity-info">
            <strong>How this works</strong>
            <span>Increasing Total Persons creates new employee roster slots automatically. Reducing it removes only unused slots. Existing named employees, vehicles and RFID history are never deleted automatically.</span>
          </div>

          <div className="modal-actions company-capacity-actions">
            <button type="button" className="secondary-button" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
            <ActionButton type="submit" className="primary-button" disabled={!changed} pending={pending} pendingText="Updating…">Update capacity</ActionButton>
          </div>
        </form>
      </section>

      <style>{`
        .company-capacity-modal{width:min(650px,calc(100vw - 30px));padding:0;overflow:hidden;border-radius:14px;background:#fff}
        .company-capacity-head{padding:18px 20px 15px;margin:0;border-bottom:1px solid #e2e8e4}
        .company-capacity-head h2{margin:2px 0 0;font-size:21px;color:#17271f}
        .company-capacity-head p{margin:5px 0 0;max-width:520px;color:#69766f;font-size:11px;line-height:1.45}
        .company-capacity-form{padding:16px 20px 18px;display:grid;gap:14px}
        .company-capacity-company{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 14px;border:1px solid #dce4df;border-radius:10px;background:#f8faf9}
        .company-capacity-company>div:first-child{display:grid;gap:3px}
        .company-capacity-company span{font-size:9px;font-weight:900;letter-spacing:.7px;color:#7b47a4}
        .company-capacity-company strong{font-size:15px;color:#203229}
        .company-capacity-badge{padding:5px 9px;border-radius:999px;background:#f0e8f6;color:#74449b;font-size:9px;font-weight:800;white-space:nowrap}
        .capacity-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .capacity-field{display:grid;gap:12px;padding:14px;border:1px solid #dbe3df;border-radius:11px;background:#fff}
        .capacity-field:first-child{border-color:#dfd2e9;background:#fcfafd}
        .capacity-field-head{display:flex;align-items:flex-start;gap:9px;min-width:0}
        .capacity-step{display:grid;place-items:center;width:27px;height:27px;flex:0 0 27px;border-radius:7px;background:#eee6f4;color:#7746a0;font-size:9px;font-weight:900}
        .capacity-field-head>div{display:grid;gap:2px;min-width:0}
        .capacity-field label{font-size:12px;font-weight:800;color:#283a31}
        .capacity-field p{margin:0;color:#78857e;font-size:9px;line-height:1.35}
        .capacity-input-wrap{display:flex;align-items:center;gap:8px;border:1px solid #cbd6d0;border-radius:8px;background:#fff;padding:0 10px}
        .capacity-input-wrap:focus-within{border-color:#8b56b4;box-shadow:0 0 0 2px rgba(139,86,180,.09)}
        .capacity-input-wrap input{width:100%!important;min-width:0!important;height:43px!important;border:0!important;outline:0!important;box-shadow:none!important;padding:0!important;background:transparent!important;color:#7340a1;font-size:20px!important;font-weight:900!important}
        .capacity-input-wrap span{color:#7b8780;font-size:9px;font-weight:700;white-space:nowrap}
        .capacity-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
        .capacity-summary>div{display:grid;gap:3px;padding:10px 11px;border:1px solid #e0e7e3;border-radius:9px;background:#fafcfb}
        .capacity-summary span{font-size:9px;font-weight:700;color:#637169}
        .capacity-summary strong{font-size:20px;line-height:1.05;color:#713da1}
        .capacity-summary small{font-size:8px;line-height:1.35;color:#7a867f}
        .capacity-info{display:grid;gap:4px;padding:10px 12px;border-radius:9px;background:#eef6f2;color:#56685e}
        .capacity-info strong{font-size:9.5px;color:#355646}
        .capacity-info span{font-size:9px;line-height:1.45}
        .company-capacity-actions{margin:0!important;padding:12px 0 0!important;border-top:1px solid #e2e8e4!important;display:flex!important;justify-content:flex-end!important;gap:9px!important}
        .company-capacity-actions button{min-width:112px}
        @media(max-width:620px){
          .capacity-fields,.capacity-summary{grid-template-columns:1fr}
          .company-capacity-company{align-items:flex-start;flex-direction:column}
          .company-capacity-badge{align-self:flex-start}
          .company-capacity-modal{max-height:calc(100vh - 24px);overflow:auto}
        }
      `}</style>
    </div> : null}
  </>;
}
