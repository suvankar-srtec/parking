"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "@/components/FeedbackProvider";
import { ActionButton } from "@/components/LoadingIndicator";

export type VisitorTableRow = {
  id: string;
  dateTime: string;
  name: string;
  phoneNumber: string;
  email: string;
  vehicleNumber: string;
  accessory: string;
  validFrom: string;
  validUntil: string;
  validFromIso: string;
  validUntilIso: string;
};

type EditDraft = {
  name: string;
  phoneNumber: string;
  email: string;
  vehicleNumber: string;
  accessory: string;
  validFrom: string;
  validUntil: string;
};

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function formatVisitorTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export default function VisitorTable({ visitors }: { visitors: VisitorTableRow[] }) {
  const [rows, setRows] = useState(visitors);
  const [query, setQuery] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [editingVisitor, setEditingVisitor] = useState<VisitorTableRow | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const { notify, refresh } = useFeedback();
  const { pending: sending, execute: executeSend } = useMutation();
  const { pending: updating, execute: executeUpdate } = useMutation();
  const search = query.trim().toLowerCase();

  useEffect(() => {
    setRows(visitors);
  }, [visitors]);

  useEffect(() => {
    if (!editingVisitor) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !updating) {
        setEditingVisitor(null);
        setDraft(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingVisitor, updating]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    return rows.filter((visitor) => [
      visitor.dateTime,
      visitor.name,
      visitor.phoneNumber,
      visitor.email,
      visitor.vehicleNumber,
      visitor.accessory,
      visitor.validFrom,
      visitor.validUntil,
    ].some((value) => value.toLowerCase().includes(search)));
  }, [rows, search]);

  function sendQr(visitor: VisitorTableRow) {
    if (sending || updating) return;
    setSendingId(visitor.id);
    void executeSend(async () => {
      try {
        const result = await requestJson<{ ok: true; message: string }>(
          `/api/visitors/${visitor.id}/send-qr`,
          "POST",
        );
        notify(result.message || `QR sent to ${visitor.email}.`);
      } finally {
        setSendingId(null);
      }
    });
  }

  async function downloadQr(visitor: VisitorTableRow) {
    if (sending || updating || downloadingId) return;
    setDownloadingId(visitor.id);
    try {
      const response = await fetch(`/api/visitors/${visitor.id}/download-qr`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.message || "Unable to download the visitor QR.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const safeName = visitor.name.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "visitor";
      anchor.href = url;
      anchor.download = `visitor-qr-${safeName}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      notify("Visitor QR downloaded successfully.");
      refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to download the visitor QR.", "error");
    } finally {
      setDownloadingId(null);
    }
  }

  function openEdit(visitor: VisitorTableRow) {
    if (updating) return;
    setEditingVisitor(visitor);
    setDraft({
      name: visitor.name,
      phoneNumber: visitor.phoneNumber,
      email: visitor.email,
      vehicleNumber: visitor.vehicleNumber,
      accessory: visitor.accessory,
      validFrom: toDateTimeLocal(visitor.validFromIso),
      validUntil: toDateTimeLocal(visitor.validUntilIso),
    });
  }

  function closeEdit() {
    if (updating) return;
    setEditingVisitor(null);
    setDraft(null);
  }

  function changeDraft(field: keyof EditDraft, value: string) {
    setDraft((current) => current ? { ...current, [field]: value } : current);
  }

  function saveVisitor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingVisitor || !draft || updating) return;

    const validFrom = new Date(draft.validFrom);
    const validUntil = new Date(draft.validUntil);
    if (!draft.name.trim() || !draft.phoneNumber.trim() || !draft.email.trim() || !draft.accessory.trim()) {
      notify("Name, Phone Number, Mail, and Accessory are required.", "error");
      return;
    }
    if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validUntil.getTime())) {
      notify("Valid From and Valid Until are required.", "error");
      return;
    }
    if (validUntil <= validFrom) {
      notify("Valid Until must be later than Valid From.", "error");
      return;
    }

    void executeUpdate(async () => {
      const result = await requestJson<{
        ok: true;
        message: string;
        visitor: {
          id: string;
          name: string;
          phoneNumber: string;
          email: string;
          vehicleNumber: string | null;
          accessory: string;
          validFrom: string;
          validUntil: string;
        };
      }>(
        `/api/visitors/${editingVisitor.id}`,
        "PATCH",
        {
          name: draft.name.trim(),
          phoneNumber: draft.phoneNumber.trim(),
          email: draft.email.trim(),
          vehicleNumber: draft.vehicleNumber.trim(),
          accessory: draft.accessory.trim(),
          validFrom: validFrom.toISOString(),
          validUntil: validUntil.toISOString(),
        },
      );

      setRows((current) => current.map((row) => row.id === editingVisitor.id ? {
        ...row,
        name: result.visitor.name,
        phoneNumber: result.visitor.phoneNumber,
        email: result.visitor.email,
        vehicleNumber: result.visitor.vehicleNumber || "",
        accessory: result.visitor.accessory,
        validFrom: formatVisitorTime(result.visitor.validFrom),
        validUntil: formatVisitorTime(result.visitor.validUntil),
        validFromIso: result.visitor.validFrom,
        validUntilIso: result.visitor.validUntil,
      } : row));

      setEditingVisitor(null);
      setDraft(null);
      notify(result.message || "Visitor details updated successfully.");
      refresh();
    });
  }

  return <>
    <div className="visitor-list-heading">
      <div>
        <div className="section-kicker">VISITOR LIST</div>
        <h2>Visitors</h2>
      </div>

      <div className="visitor-list-tools">
        <label className="visitor-search">
          <span className="sr-only">Search visitors</span>
          <span className="visitor-search-icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search visitors"
            autoComplete="off"
          />
        </label>
        <span className="visitor-count">{rows.length} {rows.length === 1 ? "visitor" : "visitors"}</span>
      </div>
    </div>

    <div className="portfolio-divider" />

    {rows.length === 0 ? <div className="visitor-empty">No visitors added yet.</div>
      : filtered.length === 0 ? <div className="visitor-empty">No visitors match “{query}”.</div>
      : <div className="visitor-table-wrap">
        <table className="visitor-table">
          <thead>
            <tr>
              <th>Date &amp; Time</th>
              <th>Name</th>
              <th>Phone Number</th>
              <th>Mail</th>
              <th>Vehicle Number</th>
              <th>Accessory</th>
              <th>Valid From</th>
              <th>Valid Until</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((visitor) => <tr key={visitor.id}>
              <td className="visitor-date">{visitor.dateTime}</td>
              <td><strong>{visitor.name}</strong></td>
              <td>{visitor.phoneNumber}</td>
              <td>{visitor.email}</td>
              <td>{visitor.vehicleNumber || "—"}</td>
              <td>{visitor.accessory}</td>
              <td className="visitor-date">{visitor.validFrom}</td>
              <td className="visitor-date">{visitor.validUntil}</td>
              <td>
                <div className="visitor-actions">
                  <ActionButton
                    type="button"
                    className="visitor-send-qr"
                    pending={sending && sendingId === visitor.id}
                    pendingText="Sending..."
                    disabled={sending || updating || Boolean(downloadingId)}
                    onClick={() => sendQr(visitor)}
                  >
                    Send QR
                  </ActionButton>
                  <button
                    type="button"
                    className="visitor-download-qr"
                    disabled={sending || updating || Boolean(downloadingId)}
                    onClick={() => void downloadQr(visitor)}
                  >
                    {downloadingId === visitor.id ? "Downloading..." : "Download QR"}
                  </button>
                  <button
                    type="button"
                    className="visitor-edit-button"
                    disabled={sending || updating}
                    onClick={() => openEdit(visitor)}
                  >
                    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                    </svg>
                    Edit
                  </button>
                </div>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>}

    {editingVisitor && draft ? <div className="visitor-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) closeEdit();
    }}>
      <section className="visitor-edit-modal" role="dialog" aria-modal="true" aria-labelledby="visitor-edit-title">
        <button type="button" className="visitor-modal-close" onClick={closeEdit} disabled={updating} aria-label="Close edit visitor form">×</button>
        <div className="visitor-modal-heading">
          <div className="section-kicker">EDIT VISITOR</div>
          <h2 id="visitor-edit-title">Edit visitor details</h2>
          <p>Update the visitor information and QR validity window.</p>
        </div>

        <form className="visitor-edit-form" onSubmit={saveVisitor}>
          <fieldset disabled={updating}>
            <div className="visitor-edit-grid">
              <label>
                <span>Name</span>
                <input type="text" value={draft.name} onChange={(event) => changeDraft("name", event.target.value)} maxLength={120} required />
              </label>
              <label>
                <span>Phone Number</span>
                <input type="tel" value={draft.phoneNumber} onChange={(event) => changeDraft("phoneNumber", event.target.value)} minLength={7} maxLength={30} required />
              </label>
              <label>
                <span>Mail</span>
                <input type="email" value={draft.email} onChange={(event) => changeDraft("email", event.target.value)} maxLength={180} required />
              </label>
              <label>
                <span>Vehicle Number <small>(if any)</small></span>
                <input type="text" value={draft.vehicleNumber} onChange={(event) => changeDraft("vehicleNumber", event.target.value)} maxLength={40} />
              </label>
              <label>
                <span>Accessory</span>
                <input type="text" value={draft.accessory} onChange={(event) => changeDraft("accessory", event.target.value)} maxLength={250} required />
              </label>
              <label>
                <span>Valid From</span>
                <input type="datetime-local" value={draft.validFrom} onChange={(event) => changeDraft("validFrom", event.target.value)} required />
              </label>
              <label>
                <span>Valid Until</span>
                <input type="datetime-local" value={draft.validUntil} onChange={(event) => changeDraft("validUntil", event.target.value)} required />
              </label>
            </div>
          </fieldset>

          <div className="visitor-modal-actions">
            <button type="button" className="secondary-button" onClick={closeEdit} disabled={updating}>Cancel</button>
            <ActionButton type="submit" className="primary-button" pending={updating} pendingText="Saving changes...">
              Update Visitor
            </ActionButton>
          </div>
        </form>
      </section>
    </div> : null}

    <style>{`
      .visitor-list-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .visitor-list-heading h2{margin:3px 0 0!important;font-size:18px!important}
      .visitor-list-tools{display:flex;align-items:center;justify-content:flex-end;gap:8px;min-width:0}
      .visitor-search{position:relative;display:block;width:190px;min-width:0}
      .visitor-search-icon{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:#6f7d75;font-size:14px;line-height:1;pointer-events:none}
      .visitor-search input{width:100%;height:30px;padding:5px 9px 5px 29px;border:1px solid #cad6cf;border-radius:7px;background:#fff;color:#17231d;outline:0;font-size:10px;font-weight:600}
      .visitor-search input:focus{border-color:#7c46ac;box-shadow:0 0 0 3px rgba(124,70,172,.09)}
      .visitor-search input::placeholder{color:#8a968f;font-weight:500}
      .visitor-count{display:inline-flex;align-items:center;min-height:26px;padding:4px 9px;border-radius:999px;background:#f0e8f6;color:#73409e;font-size:10px;font-weight:800;white-space:nowrap}
      .visitor-list-card .portfolio-divider{margin:10px 0 0}
      .visitor-table-wrap{width:100%;overflow-x:auto}
      .visitor-table{width:100%;border-collapse:collapse;table-layout:auto;font-size:11px}
      .visitor-table th{padding:9px 10px;border-bottom:1px solid #cbd6d0;background:#f3f6f4;color:#0a0d0b;font-size:10px;font-weight:900;letter-spacing:.15px;text-align:left;white-space:nowrap}
      .visitor-table td{padding:9px 10px;border-bottom:1px solid #e2e8e4;color:#45564d;line-height:1.35;vertical-align:middle}
      .visitor-table tbody tr:last-child td{border-bottom:0}
      .visitor-table tbody tr:hover{background:#faf8fc}
      .visitor-table td strong{color:#111713;font-size:11px;font-weight:900}
      .visitor-actions{display:grid;gap:5px;min-width:78px}
      .visitor-send-qr,.visitor-download-qr,.visitor-edit-button{width:100%;min-height:28px;padding:5px 8px;border-radius:6px;font-size:9px;font-weight:900;white-space:nowrap}
      .visitor-send-qr{border:1px solid #1769c2;background:#1769c2;color:#fff}
      .visitor-send-qr:hover:not(:disabled){background:#0f4f97}
      .visitor-download-qr{border:1px solid #8db9e8;background:#eef6ff;color:#0f4f97;cursor:pointer}
      .visitor-download-qr:hover:not(:disabled){background:#e4f0ff}
      .visitor-download-qr:disabled{opacity:.55;cursor:not-allowed}
      .visitor-edit-button{display:flex;align-items:center;justify-content:center;gap:4px;border:1px solid #bcd4ec;background:#fff;color:#1769c2;cursor:pointer}
      .visitor-edit-button:hover:not(:disabled){background:#eef6ff}
      .visitor-edit-button:disabled{opacity:.55;cursor:not-allowed}
      .visitor-date{white-space:nowrap;color:#5f6d65!important;font-size:10px}
      .visitor-empty{padding:22px 12px;text-align:center;color:#78847d;font-size:11px}

      .visitor-modal-backdrop{position:fixed;inset:0;z-index:1400;display:grid;place-items:center;padding:20px;background:rgba(20,31,25,.52);backdrop-filter:blur(3px)}
      .visitor-edit-modal{position:relative;width:min(820px,calc(100vw - 32px));max-height:calc(100vh - 40px);overflow:auto;border:1px solid #d4ddd8;border-radius:14px;background:#fff;padding:20px;box-shadow:0 28px 80px rgba(18,31,24,.28)}
      .visitor-modal-close{position:absolute;right:11px;top:9px;width:30px;height:30px;border:0;border-radius:50%;background:transparent;color:#65736b;font-size:22px;line-height:1;cursor:pointer}
      .visitor-modal-close:hover:not(:disabled){background:#f0f3f1;color:#17251d}
      .visitor-modal-heading{padding-right:34px}
      .visitor-modal-heading h2{margin:4px 0 3px;font-size:21px}
      .visitor-modal-heading p{margin:0;color:#6f7b74;font-size:11px}
      .visitor-edit-form{margin-top:15px}
      .visitor-edit-form fieldset{margin:0;padding:0;border:0}
      .visitor-edit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
      .visitor-edit-grid label{display:grid;gap:5px;color:#31453a;font-size:10.5px;font-weight:800}
      .visitor-edit-grid label span{display:flex;align-items:baseline;gap:4px}
      .visitor-edit-grid small{color:#7a867f;font-size:8.5px;font-weight:600}
      .visitor-edit-grid input{width:100%;height:38px;padding:7px 9px;border:1px solid #cbd7cf;border-radius:7px;background:#fff;color:#24332b;font-size:11px;font-weight:600;outline:none}
      .visitor-edit-grid input:focus{border-color:#7c46ac;box-shadow:0 0 0 3px rgba(124,70,172,.10)}
      .visitor-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;padding-top:13px;border-top:1px solid #e0e6e2}
      .visitor-modal-actions button{min-height:35px;padding:7px 13px;font-size:10.5px}

      @media(max-width:760px){
        .visitor-list-heading{align-items:flex-start}
        .visitor-list-tools{width:min(235px,60%);display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px}
        .visitor-search{width:100%}
        .visitor-search input{height:29px;font-size:9px}
        .visitor-count{min-height:24px;padding:3px 7px;font-size:8px}
        .visitor-table{min-width:1080px}
        .visitor-edit-modal{padding:16px}
        .visitor-edit-grid{grid-template-columns:1fr}
      }
      @media(max-width:520px){
        .visitor-list-heading{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px}
        .visitor-list-tools{width:100%;max-width:235px;justify-self:end}
        .visitor-list-heading h2{font-size:17px!important}
        .visitor-modal-backdrop{padding:10px}
        .visitor-edit-modal{width:calc(100vw - 20px);max-height:calc(100vh - 20px);border-radius:11px;padding:14px}
        .visitor-modal-actions{width:100%}
        .visitor-modal-actions button{flex:1}
      }
    `}</style>
  </>;
}
