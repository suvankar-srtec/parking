"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "@/components/FeedbackProvider";
import { ActionButton } from "@/components/LoadingIndicator";

export default function CompanyPasswordField({
  companyId,
  password: initialPassword,
}: {
  companyId: string;
  password: string;
}) {
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState(initialPassword);
  const { notify, refresh } = useFeedback();
  const { pending, execute } = useMutation();
  const dirty = password !== initialPassword;

  function save() {
    if (!password.trim()) {
      notify("Company password is required.", "error");
      return;
    }

    void execute(async () => {
      const result = await requestJson<{ ok: true; message: string }>(
        `/api/companies/${companyId}/password`,
        "PATCH",
        { password },
      );
      notify(result.message || "Company password updated.");
      refresh();
    });
  }

  return <div className="company-password-box">
    <span className="company-password-label">Password</span>
    <div className="company-password-value">
      <input
        type={visible ? "text" : "password"}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        disabled={pending}
        aria-label="Company password"
        autoComplete="new-password"
      />
      <button
        type="button"
        className="company-password-toggle"
        aria-label={visible ? "Hide company password" : "Show company password"}
        title={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.8 10.8 0 0112 4c5.5 0 9.5 5.2 9.5 5.2a14.6 14.6 0 01-2.7 3.2M6.2 6.2C3.9 7.7 2.5 9.2 2.5 9.2S6.5 14.5 12 14.5c1 0 2-.2 2.9-.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2.5 12S6.5 6.5 12 6.5 21.5 12 21.5 12 17.5 17.5 12 17.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8"/>
          </svg>
        )}
      </button>
    </div>
    <ActionButton
      type="button"
      className="company-password-save"
      pending={pending}
      pendingText="Saving…"
      disabled={!dirty || pending}
      onClick={save}
    >
      Save
    </ActionButton>
    <style>{`
      .company-password-box{flex:0 0 220px;min-width:200px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-content:center;gap:5px 8px;padding:8px 10px;border:1px solid #e0ddec;border-radius:9px;background:#fbf9fd}
      .company-password-label{grid-column:1/-1;margin:0;font-size:9px;line-height:1.2;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#7a6a8e}
      .company-password-value{display:flex;align-items:center;gap:6px;min-width:0;border:1px solid #d8d2e1;border-radius:7px;background:#fff;padding:0 4px 0 8px}
      .company-password-value input{width:100%;min-width:0;height:30px;border:0;background:transparent;outline:none;font:inherit;font-size:12px;font-weight:700;color:#4d3a5e}
      .company-password-toggle{display:grid;place-items:center;flex:0 0 27px;width:27px;height:27px;border:0;border-radius:6px;background:transparent;color:#74657f;cursor:pointer;padding:5px}
      .company-password-toggle:hover{background:#f0eaf5;color:#7440a0}
      .company-password-toggle svg{width:16px;height:16px}
      .company-password-save{min-width:54px;height:32px;padding:0 10px;border:1px solid #d0bfdc;border-radius:7px;background:#fff;color:#6f3da3;font-size:10px;font-weight:800;cursor:pointer;align-self:end}
      .company-password-save:hover:not(:disabled){background:#f2eaf7}
      .company-password-save:disabled{opacity:.45;cursor:not-allowed}
      @media(max-width:900px){.company-password-box{flex:0 0 200px;min-width:180px}}
      @media(max-width:700px){.company-password-box{flex:none;width:100%}}
    `}</style>
  </div>;
}
