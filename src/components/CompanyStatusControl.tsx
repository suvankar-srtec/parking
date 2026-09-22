"use client";

import { useState, type FormEvent } from "react";
import { requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { ActionButton } from "./LoadingIndicator";

export default function CompanyStatusControl({
  companyId,
  companyName,
  enabled,
  parkingAllocation,
}: {
  companyId: string;
  companyName: string;
  enabled: boolean;
  parkingAllocation: number;
}) {
  const { notify, refresh } = useFeedback();
  const { pending, execute } = useMutation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [parking, setParking] = useState("");

  function disable() {
    const released = parkingAllocation;
    if (!window.confirm(
      `Disable ${companyName}? Its ${released} allotted parking space${released === 1 ? "" : "s"} will move to Owner Parking.`,
    )) return;

    void execute(async () => {
      const result = await requestJson<{ ok: true; message: string }>(
        `/api/companies/${companyId}/status`,
        "PATCH",
        { enabled: false },
      );
      notify(result.message);
      refresh();
    });
  }

  function showEnable() {
    setName("");
    setParking("");
    setOpen(true);
  }

  function enable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    const parkingAllocation = Number(parking);

    if (!cleanName) {
      notify("Enter the company name before enabling.", "error");
      return;
    }
    if (!Number.isInteger(parkingAllocation) || parkingAllocation < 1) {
      notify("Enter a parking allocation of at least 1 space.", "error");
      return;
    }

    void execute(async () => {
      const result = await requestJson<{ ok: true; message: string }>(
        `/api/companies/${companyId}/status`,
        "PATCH",
        { enabled: true, name: cleanName, parkingAllocation },
      );
      notify(result.message);
      setOpen(false);
      refresh();
    });
  }

  return <>
    <div className="company-status-control">
      <span className={enabled ? "enabled" : "disabled"}>{enabled ? "Enabled" : "Disabled"}</span>
      <ActionButton
        type="button"
        className="secondary-button"
        pending={pending}
        pendingText={enabled ? "Disabling…" : "Enabling…"}
        onClick={enabled ? disable : showEnable}
      >
        {enabled ? "Disable" : "Enable"}
      </ActionButton>
    </div>

    {open ? <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) setOpen(false);
      }}
    >
      <section className="modal-card company-enable-modal" role="dialog" aria-modal="true" aria-labelledby={`enable-company-${companyId}`}>
        <div className="modal-head">
          <div>
            <div className="section-kicker">ENABLE COMPANY</div>
            <h2 id={`enable-company-${companyId}`}>Set company details again</h2>
            <p>Previous company: <strong>{companyName}</strong>. Enter the company name and assign fresh parking before enabling.</p>
          </div>
          <button type="button" className="modal-close" aria-label="Close" disabled={pending} onClick={() => setOpen(false)}>×</button>
        </div>

        <form className="company-enable-form" onSubmit={enable}>
          <label>
            <span>Company name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter company name"
              disabled={pending}
              autoFocus
              required
            />
          </label>

          <label>
            <span>Parking allocation</span>
            <div className="company-enable-parking">
              <input
                type="number"
                min="1"
                step="1"
                value={parking}
                onChange={(event) => setParking(event.target.value)}
                placeholder="0"
                disabled={pending}
                required
              />
              <small>spaces</small>
            </div>
          </label>

          <div className="company-enable-note">
            Parking assigned here is transferred from Owner Parking back to Company Parking.
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
            <ActionButton type="submit" className="primary-button" pending={pending} pendingText="Enabling…">Enable company</ActionButton>
          </div>
        </form>
      </section>
    </div> : null}

    <style>{`
      .company-status-control{display:flex;align-items:center;gap:8px}
      .company-status-control>span{display:inline-flex;align-items:center;min-height:24px;padding:4px 8px;border-radius:999px;font-size:9px;font-weight:800}
      .company-status-control>span.enabled{background:#e8f7ef;color:#18714f}
      .company-status-control>span.disabled{background:#fdeceb;color:#b33a35}
      .company-status-control .secondary-button{min-width:86px}
      .company-enable-modal{width:min(560px,calc(100vw - 30px))}
      .company-enable-modal .modal-head p{margin:5px 0 0;color:#68756e;font-size:11px}
      .company-enable-form{display:grid;gap:13px;padding:16px 20px 18px}
      .company-enable-form label{display:grid;gap:6px;color:#304238;font-size:11px;font-weight:800}
      .company-enable-form label>input,.company-enable-parking{min-height:42px;border:1px solid #ccd7d1;border-radius:8px;background:#fff}
      .company-enable-form label>input{width:100%;padding:0 11px;font:inherit;color:#1e2d25}
      .company-enable-parking{display:flex;align-items:center;padding:0 10px}
      .company-enable-parking input{width:100%;height:40px;border:0;outline:0;background:transparent;color:#7440a0;font-size:18px;font-weight:900}
      .company-enable-parking small{color:#77847d;font-size:9px;white-space:nowrap}
      .company-enable-note{padding:10px 12px;border-radius:8px;background:#eef6f2;color:#486157;font-size:9px;line-height:1.45}
    `}</style>
  </>;
}
