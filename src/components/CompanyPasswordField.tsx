"use client";

import { useState } from "react";

export default function CompanyPasswordField({ password }: { password: string }) {
  const [visible, setVisible] = useState(false);

  return <div className="company-password-box">
    <span className="company-password-label">Password</span>
    <div className="company-password-value">
      <strong>{visible ? password : "••••••••"}</strong>
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
    <style>{`
      .company-password-box{flex:0 0 190px;min-width:170px;display:grid;align-content:center;gap:4px;padding:8px 12px;border:1px solid #e0ddec;border-radius:9px;background:#fbf9fd}
      .company-password-label{margin:0;font-size:9px;line-height:1.2;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#7a6a8e}
      .company-password-value{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
      .company-password-value strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:1.2;color:#4d3a5e;font-weight:800;font-family:inherit}
      .company-password-toggle{display:grid;place-items:center;flex:0 0 28px;width:28px;height:28px;border:0;border-radius:6px;background:transparent;color:#74657f;cursor:pointer;padding:5px}
      .company-password-toggle:hover{background:#f0eaf5;color:#7440a0}
      .company-password-toggle svg{width:17px;height:17px}
      @media(max-width:900px){.company-password-box{flex:0 0 170px;min-width:150px}}
      @media(max-width:700px){.company-password-box{flex:none;width:100%}}
    `}</style>
  </div>;
}
