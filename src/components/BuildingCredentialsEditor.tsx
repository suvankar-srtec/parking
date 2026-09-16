"use client";

import { useState, type FormEvent } from "react";
import PasswordInput from "@/components/PasswordInput";
import { ActionButton } from "@/components/LoadingIndicator";
import { useFeedback, useMutation } from "@/components/FeedbackProvider";
import { requestJson } from "@/lib/client-request";

export default function BuildingCredentialsEditor({
  buildingId,
  userId,
  initialPassword,
}: {
  buildingId: string;
  userId: string;
  initialPassword: string;
}) {
  const { notify, refresh } = useFeedback();
  const { pending, execute } = useMutation();
  const [password, setPassword] = useState(initialPassword);

  const dirty = password !== initialPassword;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password.trim()) {
      notify("Building password is required.", "error");
      return;
    }

    void execute(async () => {
      const result = await requestJson<{ ok: true; message: string; account: { userId: string } }>(
        `/api/buildings/${buildingId}`,
        "PATCH",
        { password },
      );
      notify(result.message || "Building password updated.");
      refresh();
    });
  }

  return <form className="building-credentials-editor" aria-busy={pending} onSubmit={submit}>
    <div className="building-credentials-head">
      <div>
        <span>BUILDING LOGIN</span>
        <strong>Admin credentials</strong>
      </div>
      <ActionButton type="submit" className="secondary-button credentials-save" pending={pending} pendingText="Saving…" disabled={!dirty || pending}>
        Update password
      </ActionButton>
    </div>
    <p className="building-login-help">Sign in with this User ID and your password. The User ID cannot be changed.</p>
    <div className="building-credentials-grid">
      <label>Building User ID<input value={userId} readOnly autoComplete="username" /></label>
      <PasswordInput
        label="Building password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="new-password"
        disabled={pending}
        required
      />
    </div>
    <style>{`
      .building-credentials-editor{margin:12px 0 2px;padding:12px;border:1px solid #d6dfda;border-radius:10px;background:#f8faf9}
      .building-credentials-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:10px}
      .building-credentials-head>div{display:flex;align-items:baseline;gap:9px;min-width:0}
      .building-credentials-head span{font-size:9px;font-weight:900;letter-spacing:.08em;color:#8241b2}
      .building-credentials-head strong{font-size:13px;color:#17261e}
      .building-login-help{margin:0 0 10px;font-size:12px;color:#627168;line-height:1.5}
      .building-credentials-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
      .building-credentials-grid>label,.building-credentials-grid>.password-field{display:flex;flex-direction:column;gap:6px;font-size:11px;font-weight:800;color:#3d4c44}
      .building-credentials-grid input{width:100%;height:40px;border:1px solid #cbd7d0;border-radius:8px;background:#fff;padding:0 12px;font:inherit;color:#17261e;outline:none}
      .building-credentials-grid input[readonly]{background:#f1edf5;color:#564663}
      .building-credentials-grid input:focus{border-color:#8d4bbb;box-shadow:0 0 0 2px rgba(141,75,187,.10)}
      .building-credentials-grid .password-input-wrap{position:relative}
      .building-credentials-grid .password-input-wrap input{padding-right:44px}
      .building-credentials-grid .password-toggle{position:absolute;right:7px;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:30px;height:30px;border:0;background:transparent;color:#69766f;cursor:pointer}
      .building-credentials-grid .password-toggle:hover{color:#7f3faf}
      .credentials-save{min-width:126px;justify-content:center}
      @media(max-width:720px){.building-credentials-head{align-items:flex-start;flex-direction:column}.building-credentials-grid{grid-template-columns:1fr}.credentials-save{width:100%}}
    `}</style>
  </form>;
}
