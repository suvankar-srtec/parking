"use client";

import { FormEvent, useEffect, useState } from "react";
import { requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "./FeedbackProvider";
import PasswordInput from "./PasswordInput";
import { ActionButton } from "./LoadingIndicator";

type SuperAdminRow = {
  id: string;
  userId: string;
  username: string;
  createdAt: string;
  _count: { ownedBuildings: number };
};

export default function SuperAdminManager() {
  const { notify } = useFeedback();
  const { pending, execute } = useMutation();
  const [open, setOpen] = useState(false);
  const [editAdmin, setEditAdmin] = useState<SuperAdminRow | null>(null);
  const [editName, setEditName] = useState("");
  const [admins, setAdmins] = useState<SuperAdminRow[]>([]);

  async function load() {
    const result = await requestJson<{ ok: true; admins: SuperAdminRow[] }>("/api/super-admins");
    setAdmins(result.admins);
  }

  useEffect(() => { void load().catch(() => undefined); }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    if (!username || !password.trim()) {
      notify("Enter the Super Admin name and password.", "error");
      return;
    }
    void execute(async () => {
      const result = await requestJson<{ ok: true; message: string }>("/api/super-admins", "POST", { username, password });
      notify(result.message);
      setOpen(false);
      await load();
    });
  }

  function openEdit(admin: SuperAdminRow) {
    setEditAdmin(admin);
    setEditName(admin.username);
  }

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editAdmin) return;
    const username = editName.trim();
    if (!username) {
      notify("Enter the Super Admin name.", "error");
      return;
    }
    void execute(async () => {
      const result = await requestJson<{ ok: true; message: string }>("/api/super-admins", "PATCH", {
        id: editAdmin.id,
        username,
      });
      notify(result.message);
      setEditAdmin(null);
      setEditName("");
      await load();
    });
  }

  function removeAdmin(admin: SuperAdminRow) {
    if (admin._count.ownedBuildings > 0) {
      notify(`Reassign or remove this Super Admin's ${admin._count.ownedBuildings} building${admin._count.ownedBuildings === 1 ? "" : "s"} before deleting the account.`, "error");
      return;
    }
    if (!window.confirm(`Remove Super Admin ${admin.userId} (${admin.username})? This action cannot be undone.`)) return;

    void execute(async () => {
      const result = await requestJson<{ ok: true; message: string }>("/api/super-admins", "DELETE", { id: admin.id });
      notify(result.message);
      await load();
    });
  }

  function handleAction(admin: SuperAdminRow, action: string) {
    if (action === "edit") openEdit(admin);
    if (action === "remove") removeAdmin(admin);
  }

  return <>
    <section className="portfolio-card building-management super-admin-management-card">
      <div className="portfolio-header super-admin-management-header">
        <div>
          <div className="section-kicker">SUPER ADMIN ACCOUNTS</div>
          <h2>Super Admin management</h2>
          <p>Create isolated Super Admin accounts. Each Super Admin manages only the buildings assigned to their own scope.</p>
        </div>
        <button className="add-building-button" type="button" onClick={() => setOpen(true)}>
          <span className="plus-icon">+</span>Create Super Admin
        </button>
      </div>

      <div className="portfolio-divider" />

      <div className="super-admin-summary-row">
        <div className="super-admin-summary-box"><span>Total Super Admins</span><strong>{admins.length}</strong></div>
        <div className="super-admin-summary-box"><span>Total Buildings</span><strong>{admins.reduce((sum, admin) => sum + admin._count.ownedBuildings, 0)}</strong></div>
      </div>

      <div className="super-admin-table-wrap">
        <table className="super-admin-table">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Name</th>
              <th>Buildings</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {admins.length ? admins.map((admin) => <tr key={admin.id}>
              <td><span className="super-admin-id-badge">{admin.userId}</span></td>
              <td>
                <div className="super-admin-name-cell">
                  <span className="super-admin-avatar">{admin.username.slice(0, 1).toUpperCase()}</span>
                  <div><strong>{admin.username}</strong><small>Super Admin</small></div>
                </div>
              </td>
              <td><span className="super-admin-building-count">{admin._count.ownedBuildings}</span></td>
              <td><span className="super-admin-created">{new Date(admin.createdAt).toLocaleString()}</span></td>
              <td>
                <select
                  className="super-admin-action-select"
                  value=""
                  disabled={pending}
                  aria-label={`Actions for ${admin.username}`}
                  onChange={(event) => {
                    const action = event.target.value;
                    event.target.value = "";
                    handleAction(admin, action);
                  }}
                >
                  <option value="">Select action</option>
                  <option value="edit">Edit name</option>
                  <option value="remove">Remove</option>
                </select>
              </td>
            </tr>) : <tr>
              <td colSpan={5} className="super-admin-empty">No additional Super Admin accounts yet.</td>
            </tr>}
          </tbody>
        </table>
      </div>
    </section>

    {open ? <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !pending) setOpen(false); }}>
      <section className="modal-card small-modal" role="dialog" aria-modal="true">
        <div className="modal-head"><div><div className="section-kicker">ACCOUNT SETUP</div><h2>Create Super Admin</h2><p>User ID is generated automatically and will always be unique.</p></div><button type="button" className="modal-close" disabled={pending} onClick={() => setOpen(false)}>×</button></div>
        <div className="modal-divider" />
        <form className="modal-form" onSubmit={submit}>
          <label>Super Admin name<input name="username" required placeholder="e.g. Regional Admin" /></label>
          <PasswordInput label="Password" name="password" required autoComplete="new-password" placeholder="Password" disabled={pending} />
          <div className="modal-actions"><button type="button" className="secondary-button" disabled={pending} onClick={() => setOpen(false)}>Cancel</button><ActionButton type="submit" className="primary-button" pending={pending} pendingText="Creating…">Create Super Admin</ActionButton></div>
        </form>
      </section>
    </div> : null}

    {editAdmin ? <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !pending) setEditAdmin(null); }}>
      <section className="modal-card small-modal" role="dialog" aria-modal="true" aria-label="Edit Super Admin name">
        <div className="modal-head">
          <div>
            <div className="section-kicker">EDIT SUPER ADMIN</div>
            <h2>Edit name</h2>
            <p>User ID {editAdmin.userId}. Only the name can be changed.</p>
          </div>
          <button type="button" className="modal-close" disabled={pending} onClick={() => setEditAdmin(null)}>×</button>
        </div>
        <div className="modal-divider" />
        <form className="modal-form" onSubmit={saveEdit}>
          <label>User ID<input value={editAdmin.userId} readOnly disabled /></label>
          <label>Super Admin name<input value={editName} onChange={(event) => setEditName(event.target.value)} required maxLength={120} /></label>
          <div className="modal-actions">
            <button type="button" className="secondary-button" disabled={pending} onClick={() => setEditAdmin(null)}>Cancel</button>
            <ActionButton type="submit" className="primary-button" pending={pending} pendingText="Saving…">Save changes</ActionButton>
          </div>
        </form>
      </section>
    </div> : null}

    <style>{`
      .super-admin-management-card{overflow:hidden}
      .super-admin-management-header{align-items:flex-end}
      .super-admin-summary-row{display:grid;grid-template-columns:repeat(2,minmax(160px,220px));gap:12px;margin-bottom:16px}
      .super-admin-summary-box{padding:12px 14px;border:1px solid #d6e0da;border-radius:8px;background:#f8fbf9}
      .super-admin-summary-box span{display:block;color:#6c7971;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.4px}
      .super-admin-summary-box strong{display:block;margin-top:5px;color:#7c46ac;font-size:22px}
      .super-admin-table-wrap{width:100%;overflow-x:auto;border:1px solid #d7e1db;border-radius:9px;background:#fff}
      .super-admin-table{width:100%;border-collapse:separate;border-spacing:0;min-width:820px}
      .super-admin-table thead th{padding:12px 16px;border-bottom:1px solid #d7e1db;background:#f1f6f3;color:#526158;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.45px;text-align:left;white-space:nowrap}
      .super-admin-table tbody td{padding:14px 16px;border-bottom:1px solid #e5ece8;vertical-align:middle;color:#203128;font-size:13px}
      .super-admin-table tbody tr:last-child td{border-bottom:0}
      .super-admin-table tbody tr:hover td{background:#fafcfb}
      .super-admin-id-badge{display:inline-flex;align-items:center;min-height:28px;padding:5px 9px;border-radius:999px;background:#f2edf8;color:#71439b;font-weight:800;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
      .super-admin-name-cell{display:flex;align-items:center;gap:10px}
      .super-admin-avatar{width:34px;height:34px;display:grid;place-items:center;border-radius:50%;background:#e8f5ef;color:#11694f;font-weight:900}
      .super-admin-name-cell strong{display:block;font-size:13px}
      .super-admin-name-cell small{display:block;margin-top:3px;color:#7b8780;font-size:10px}
      .super-admin-building-count{display:inline-grid;place-items:center;min-width:32px;height:28px;padding:0 8px;border-radius:6px;background:#f7f3fb;color:#7c46ac;font-weight:900}
      .super-admin-created{color:#66746c;white-space:nowrap}
      .super-admin-action-select{min-width:140px;padding:8px 34px 8px 11px;border:1px solid #cbd8d1;border-radius:7px;background:#fff;color:#263a30;font-weight:700;cursor:pointer;outline:none}
      .super-admin-action-select:hover:not(:disabled){border-color:#8a5bb4}
      .super-admin-action-select:focus{border-color:#7c46ac;box-shadow:0 0 0 3px rgba(124,70,172,.12)}
      .super-admin-action-select:disabled{opacity:.55;cursor:not-allowed}
      .super-admin-empty{text-align:center;padding:30px 16px!important;color:#738078!important}
      @media(max-width:760px){.super-admin-management-header{align-items:flex-start}.super-admin-summary-row{grid-template-columns:1fr 1fr}.super-admin-table thead th,.super-admin-table tbody td{padding-left:12px;padding-right:12px}}
      @media(max-width:520px){.super-admin-summary-row{grid-template-columns:1fr}}
    `}</style>
  </>;
}
