"use client";

import { useState } from "react";
import BuildingCredentialsEditor from "@/components/BuildingCredentialsEditor";
import { Spinner } from "@/components/LoadingIndicator";

type Credentials = {
  buildingId: string;
  userId: string;
  buildingName: string;
  password: string;
};

export default function AdminCredentialsPopup() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Credentials | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  return <>
    <button type="button" className="sidebar-role-pill sidebar-role-button" onClick={() => void show()}>
      ADMIN
    </button>

    {open ? <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !loading) setOpen(false);
    }}>
      <section className="modal-card admin-credentials-modal" role="dialog" aria-modal="true" aria-labelledby="admin-credentials-title">
        <div className="modal-head">
          <div>
            <div className="section-kicker">ADMIN ACCOUNT</div>
            <h2 id="admin-credentials-title">Admin credentials</h2>
          </div>
          <button type="button" className="modal-close" aria-label="Close" onClick={() => setOpen(false)}>×</button>
        </div>
        <div className="modal-divider" />

        {loading ? <div className="admin-credentials-loading"><Spinner /> Loading credentials…</div> : null}
        {error ? <div className="parking-feedback parking-feedback-error">{error}</div> : null}
        {data ? <BuildingCredentialsEditor
          buildingId={data.buildingId}
          userId={data.userId}
          buildingName={data.buildingName}
          initialPassword={data.password}
        /> : null}
      </section>
    </div> : null}

    <style>{`
      .sidebar-role-button{border:0;cursor:pointer;text-align:left}
      .sidebar-role-button:hover{filter:brightness(.96)}
      .admin-credentials-modal{width:min(760px,96vw)}
      .admin-credentials-modal .building-credentials-editor{margin:0}
      .admin-credentials-loading{display:flex;align-items:center;gap:9px;padding:18px 4px;color:#5f6c64;font-size:13px}
    `}</style>
  </>;
}
