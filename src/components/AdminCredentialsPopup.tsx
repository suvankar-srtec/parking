"use client";

import { useState, type FormEvent } from "react";
import { requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "@/components/FeedbackProvider";
import { ActionButton } from "@/components/LoadingIndicator";
import PasswordInput from "@/components/PasswordInput";

type Credentials = {
  buildingId: string;
  userId: string;
  buildingName: string;
};

export default function AdminCredentialsPopup() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Credentials | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { notify } = useFeedback();
  const { pending, execute } = useMutation();

  async function show() {
    setOpen(true);
    if (data || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/account/admin-credentials", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to load Admin credentials.");
      setData(result.credentials);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Admin credentials.");
    } finally {
      setLoading(false);
    }
  }

  function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || pending) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (!password.trim()) {
      notify("Enter a new Admin password.", "error");
      return;
    }

    void execute(async () => {
      const result = await requestJson<{ ok: true; message: string }>(
        `/api/buildings/${data.buildingId}`,
        "PATCH",
        { password },
      );
      notify(result.message || "Admin password updated.");
      event.currentTarget.reset();
    });
  }

  return <>
    <button type="button" className="sidebar-role-pill sidebar-role-button" onClick={() => void show()}>
      ADMIN
    </button>

    {open ? <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !pending) setOpen(false);
    }}>
      <section className="modal-card admin-credentials-modal" role="dialog" aria-modal="true" aria-labelledby="admin-credentials-title">
        <div className="modal-head">
          <div>
            <h2 id="admin-credentials-title">Admin credentials</h2>
          </div>
          <button type="button" className="modal-close" aria-label="Close" disabled={pending} onClick={() => setOpen(false)}>×</button>
        </div>
        <div className="modal-divider" />

        {loading ? <p>Loading credentials…</p> : null}
        {error ? <div className="parking-feedback parking-feedback-error">{error}</div> : null}

        {data ? <>
          <div className="admin-credentials-grid">
            <div><span>Admin User ID</span><strong>{data.userId}</strong></div>
            <div><span>Building</span><strong>{data.buildingName}</strong></div>
          </div>
          <div className="admin-password-status">
            <span>Current password</span>
            <strong>••••••••</strong>
          </div>
          <form className="admin-password-form" onSubmit={updatePassword}>
            <PasswordInput label="Change password" name="password" autoComplete="new-password" required disabled={pending} />
            <ActionButton type="submit" className="primary-button" pending={pending} pendingText="Updating…">
              Update password
            </ActionButton>
          </form>
        </> : null}
      </section>
    </div> : null}

    <style>{`
      .sidebar-role-button{border:0;cursor:pointer;text-align:left}
      .sidebar-role-button:hover{filter:brightness(.96)}
      .admin-credentials-modal{width:min(620px,96vw);padding:22px}
      .admin-credentials-modal .modal-head{align-items:center}
      .admin-credentials-modal .modal-head h2{margin:0;font-size:24px}
      .admin-credentials-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .admin-credentials-grid>div{padding:14px 15px;border:1px solid #d7e0db;border-radius:11px;background:#f8faf9}
      .admin-credentials-grid span,.admin-password-status span{display:block;color:#6b7770;font-size:12px;font-weight:800}
      .admin-credentials-grid strong{display:block;margin-top:7px;color:#1769c2;font-size:16px}
      .admin-password-status{margin-top:12px;padding:14px 15px;border:1px solid #ddd5e5;border-radius:11px;background:#fbf8fd}
      .admin-password-status strong{display:block;margin-top:7px;color:#7040a2;font-size:18px;letter-spacing:3px}
      .admin-password-form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end;margin-top:12px}
      .admin-password-form .password-field{min-width:0}
      .admin-password-form .password-input-wrap input{height:42px}
      .admin-password-form .primary-button{min-height:42px;white-space:nowrap}
      @media(max-width:560px){.admin-credentials-grid,.admin-password-form{grid-template-columns:1fr}.admin-password-form .primary-button{width:100%}}
    `}</style>
  </>;
}
