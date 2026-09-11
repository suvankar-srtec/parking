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
      const result = await requestJson<{ message: string }>("/api/super-admins", "POST", { username, password });
      notify(result.message);
      setOpen(false);
      await load();
    });
  }

  return <>
    <section className="portfolio-card building-management">
      <div className="portfolio-header">
        <div>
          <div className="section-kicker">SUPER ADMIN ACCOUNTS</div>
          <h2>Super Admin management</h2>
          <p>Create isolated Super Admin accounts. Each new Super Admin starts with no buildings and only sees buildings they create.</p>
        </div>
        <button className="add-building-button" type="button" onClick={() => setOpen(true)}><span className="plus-icon">+</span>Create Super Admin</button>
      </div>
      <div className="portfolio-divider" />
      <div className="table-wrap"><table><thead><tr><th>User ID</th><th>Name</th><th>Buildings</th><th>Created</th></tr></thead><tbody>
        {admins.length ? admins.map((admin) => <tr key={admin.id}><td><strong>{admin.userId}</strong></td><td>{admin.username}</td><td>{admin._count.ownedBuildings}</td><td>{new Date(admin.createdAt).toLocaleString()}</td></tr>) : <tr><td colSpan={4}>No additional Super Admin accounts yet.</td></tr>}
      </tbody></table></div>
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
  </>;
}
