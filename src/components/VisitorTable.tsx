"use client";

import { useMemo, useState } from "react";
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
  const [query, setQuery] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const { notify } = useFeedback();
  const { pending, execute } = useMutation();
  const search = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!search) return visitors;
    return visitors.filter((visitor) => [
      visitor.dateTime,
      visitor.name,
      visitor.phoneNumber,
      visitor.email,
      visitor.vehicleNumber,
      visitor.accessory,
    ].some((value) => value.toLowerCase().includes(search)));
  }, [visitors, search]);

  function sendQr(visitor: VisitorTableRow) {
    if (pending) return;
    setSendingId(visitor.id);
    void execute(async () => {
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
        <span className="visitor-count">{visitors.length} {visitors.length === 1 ? "visitor" : "visitors"}</span>
      </div>
    </div>

    <div className="portfolio-divider" />

    {visitors.length === 0 ? <div className="visitor-empty">No visitors added yet.</div>
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
              <td>{visitor.email}</td>
              <td>{visitor.vehicleNumber}</td>
              <td>{visitor.accessory}</td>
              <td>
                <ActionButton
                  type="button"
                  className="visitor-send-qr"
                  pending={pending && sendingId === visitor.id}
                  pendingText="Sending..."
                  disabled={pending}
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
