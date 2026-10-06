"use client";

import { useEffect, useMemo, useState } from "react";
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
};

export default function VisitorTable({ visitors }: { visitors: VisitorTableRow[] }) {
  const [rows, setRows] = useState(visitors);
  const [query, setQuery] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const { notify } = useFeedback();
  const { pending: sending, execute: executeSend } = useMutation();
  const { pending: updatingEmail, execute: executeEmailUpdate } = useMutation();
  const search = query.trim().toLowerCase();

  useEffect(() => {
    setRows(visitors);
  }, [visitors]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    return rows.filter((visitor) => [
      visitor.dateTime,
      visitor.name,
      visitor.phoneNumber,
      visitor.email,
      visitor.vehicleNumber,
      visitor.accessory,
    ].some((value) => value.toLowerCase().includes(search)));
  }, [rows, search]);

  function sendQr(visitor: VisitorTableRow) {
    if (sending) return;
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

  function startEmailEdit(visitor: VisitorTableRow) {
    if (updatingEmail) return;
    setEditingEmailId(visitor.id);
    setEmailDraft(visitor.email);
  }

  function cancelEmailEdit() {
    if (updatingEmail) return;
    setEditingEmailId(null);
    setEmailDraft("");
  }

  function saveEmail(visitor: VisitorTableRow) {
    const nextEmail = emailDraft.trim().toLowerCase();
    if (!nextEmail) {
      notify("Enter the visitor email address.", "error");
      return;
    }

    void executeEmailUpdate(async () => {
      const result = await requestJson<{ ok: true; message: string; visitor: { id: string; email: string } }>(
        `/api/visitors/${visitor.id}`,
        "PATCH",
        { email: nextEmail },
      );
      setRows((current) => current.map((row) =>
        row.id === visitor.id ? { ...row, email: result.visitor.email } : row
      ));
      setEditingEmailId(null);
      setEmailDraft("");
      notify(result.message || "Visitor email updated successfully.");
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
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((visitor) => <tr key={visitor.id}>
              <td className="visitor-date">{visitor.dateTime}</td>
              <td><strong>{visitor.name}</strong></td>
              <td>{visitor.phoneNumber}</td>
              <td>
                {editingEmailId === visitor.id ? <div className="visitor-email-editor">
                  <input
                    type="email"
                    value={emailDraft}
                    onChange={(event) => setEmailDraft(event.target.value)}
                    disabled={updatingEmail}
                    aria-label={`Edit email for ${visitor.name}`}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        saveEmail(visitor);
                      }
                      if (event.key === "Escape") cancelEmailEdit();
                    }}
                    autoFocus
                  />
                  <button type="button" className="visitor-email-save" disabled={updatingEmail} onClick={() => saveEmail(visitor)} aria-label={`Save email for ${visitor.name}`}>✓</button>
                  <button type="button" className="visitor-email-cancel" disabled={updatingEmail} onClick={cancelEmailEdit} aria-label="Cancel email edit">×</button>
                </div> : <div className="visitor-email-cell">
                  <span>{visitor.email}</span>
                  <button
                    type="button"
                    className="visitor-email-edit"
                    aria-label={`Edit email for ${visitor.name}`}
                    title="Edit email"
                    disabled={updatingEmail}
                    onClick={() => startEmailEdit(visitor)}
                  >
                    <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                    </svg>
                  </button>
                </div>}
              </td>
              <td>{visitor.vehicleNumber}</td>
              <td>{visitor.accessory}</td>
              <td>
                <ActionButton
                  type="button"
                  className="visitor-send-qr"
                  pending={sending && sendingId === visitor.id}
                  pendingText="Sending..."
                  disabled={sending || updatingEmail}
                  onClick={() => sendQr(visitor)}
                >
                  Send QR
                </ActionButton>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>}

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
      .visitor-email-cell{display:flex;align-items:center;gap:6px;min-width:0}
      .visitor-email-cell>span{min-width:0}
      .visitor-email-edit{width:24px;height:24px;flex:0 0 24px;display:grid;place-items:center;padding:0;border:1px solid #d4ddd8;border-radius:5px;background:#fff;color:#6f3da0;cursor:pointer}
      .visitor-email-edit:hover:not(:disabled){background:#f2ebf7;border-color:#c9b2dc}
      .visitor-email-editor{display:flex;align-items:center;gap:4px;min-width:220px}
      .visitor-email-editor input{min-width:0;width:180px;height:29px;padding:5px 7px;border:1px solid #bfcfc6;border-radius:5px;background:#fff;color:#17231d;outline:0;font-size:10px}
      .visitor-email-editor input:focus{border-color:#7c46ac;box-shadow:0 0 0 2px rgba(124,70,172,.09)}
      .visitor-email-save,.visitor-email-cancel{width:27px;height:27px;display:grid;place-items:center;padding:0;border-radius:5px;font-size:12px;font-weight:900}
      .visitor-email-save{border:1px solid #7c46ac;background:#7c46ac;color:#fff}
      .visitor-email-cancel{border:1px solid #ccd7d1;background:#fff;color:#66736c}
      .visitor-send-qr{min-width:76px;min-height:29px;padding:5px 9px;border:1px solid #70409a;border-radius:6px;background:#7c46ac;color:#fff;font-size:9px;font-weight:900;white-space:nowrap}
      .visitor-send-qr:hover:not(:disabled){background:#693492}
      .visitor-date{white-space:nowrap;color:#5f6d65!important;font-size:10px}
      .visitor-empty{padding:22px 12px;text-align:center;color:#78847d;font-size:11px}
      @media(max-width:760px){
        .visitor-list-heading{align-items:flex-start}
        .visitor-list-tools{width:min(235px,60%);display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px}
        .visitor-search{width:100%}
        .visitor-search input{height:29px;font-size:9px}
        .visitor-count{min-height:24px;padding:3px 7px;font-size:8px}
        .visitor-table{min-width:880px}
      }
      @media(max-width:520px){
        .visitor-list-heading{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px}
        .visitor-list-tools{width:100%;max-width:235px;justify-self:end}
        .visitor-list-heading h2{font-size:17px!important}
      }
    `}</style>
  </>;
}
