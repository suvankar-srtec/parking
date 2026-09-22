"use client";

import { useEffect, useState, type FormEvent } from "react";
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
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false);
  const [name, setName] = useState("");
  const [parking, setParking] = useState("");

  useEffect(() => {
    if (!disableConfirmOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) setDisableConfirmOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disableConfirmOpen, pending]);

  function disable() {
    setDisableConfirmOpen(true);
  }

  function confirmDisable() {
    void execute(async () => {
      const result = await requestJson<{ ok: true; message: string }>(
        `/api/companies/${companyId}/status`,
        "PATCH",
        { enabled: false },
      );
      notify(result.message);
      setDisableConfirmOpen(false);
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

  const released = parkingAllocation;

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

    {disableConfirmOpen ? (
      <div
        className="warning-dialog-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !pending) setDisableConfirmOpen(false);
        }}
      >
        <section
          className="warning-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={`disable-company-title-${companyId}`}
          aria-describedby={`disable-company-message-${companyId}`}
        >
          <div className="warning-dialog-titlebar">
            <h2 id={`disable-company-title-${companyId}`}>WARNING</h2>
          </div>

          <div className="warning-dialog-body">
            <div className="warning-dialog-icon" aria-hidden="true">
              <svg viewBox="0 0 96 84" focusable="false">
                <path d="M48 4 92 79H4L48 4Z" fill="#ffc52f" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
                <rect x="44" y="26" width="8" height="30" rx="4" fill="#272727" />
                <circle cx="48" cy="67" r="5" fill="#272727" />
              </svg>
            </div>

            <div id={`disable-company-message-${companyId}`} className="warning-dialog-copy">
              <strong>Disable {companyName}?</strong>
              <p>
                Its {released} allotted parking space{released === 1 ? "" : "s"} will move to Owner Parking.
              </p>
            </div>
          </div>

          <div className="warning-dialog-actions">
            <ActionButton
              type="button"
              className="warning-yes-button"
              pending={pending}
              pendingText="Disabling…"
              onClick={confirmDisable}
            >
              Yes
            </ActionButton>
            <button
              type="button"
              className="warning-no-button"
              disabled={pending}
              onClick={() => setDisableConfirmOpen(false)}
            >
              No
            </button>
          </div>
        </section>
      </div>
    ) : null}

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

      .warning-dialog-backdrop{position:fixed;inset:0;z-index:12000;display:grid;place-items:center;padding:20px;background:rgba(17,17,17,.58);backdrop-filter:blur(2px)}
      .warning-dialog{width:min(570px,calc(100vw - 28px));overflow:hidden;border:4px solid #f7bd22;border-radius:12px;background:#3d3d3d;box-shadow:0 24px 70px rgba(0,0,0,.38)}
      .warning-dialog-titlebar{display:flex;align-items:center;justify-content:flex-end;min-height:50px;padding:7px 20px;background:linear-gradient(180deg,#ffd348 0%,#f9bf25 100%);border-bottom:2px solid #2f2f2f}
      .warning-dialog-titlebar h2{margin:0;color:#151515;font-size:26px;font-weight:900;letter-spacing:.8px;line-height:1}
      .warning-dialog-body{display:grid;grid-template-columns:128px minmax(0,1fr);align-items:center;gap:24px;padding:28px 32px 16px}
      .warning-dialog-icon{display:grid;place-items:center}
      .warning-dialog-icon svg{display:block;width:104px;height:auto;filter:drop-shadow(0 4px 3px rgba(0,0,0,.34))}
      .warning-dialog-copy{min-width:0;color:#fff}
      .warning-dialog-copy strong{display:block;margin-bottom:9px;font-size:19px;line-height:1.3}
      .warning-dialog-copy p{margin:0;color:#f4f4f4;font-size:15px;line-height:1.45}
      .warning-dialog-actions{display:flex;justify-content:flex-end;gap:14px;padding:8px 32px 20px}
      .warning-yes-button,.warning-no-button{min-width:108px;min-height:40px;border:1px solid rgba(0,0,0,.55);border-radius:5px;color:#fff;font-size:14px;font-weight:700;box-shadow:0 3px 7px rgba(0,0,0,.28)}
      .warning-yes-button{background:#38a4d6}
      .warning-yes-button:hover:not(:disabled){background:#2c93c3}
      .warning-no-button{background:#fb4d50}
      .warning-no-button:hover:not(:disabled){background:#e53f43}
      .warning-yes-button:focus-visible,.warning-no-button:focus-visible{outline:3px solid #fff;outline-offset:2px}
      .warning-dialog button:disabled{cursor:wait;opacity:.7}

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

      @media(max-width:600px){
        .warning-dialog-titlebar{justify-content:center}
        .warning-dialog-titlebar h2{font-size:22px}
        .warning-dialog-body{grid-template-columns:1fr;gap:12px;padding:22px 22px 14px;text-align:center}
        .warning-dialog-icon svg{width:88px}
        .warning-dialog-copy strong{font-size:17px}
        .warning-dialog-copy p{font-size:13px}
        .warning-dialog-actions{justify-content:center;padding:8px 22px 20px}
        .warning-yes-button,.warning-no-button{flex:1;min-width:0}
      }

      @media(prefers-reduced-motion:reduce){
        .warning-dialog-backdrop{backdrop-filter:none}
      }
    `}</style>
  </>;
}
