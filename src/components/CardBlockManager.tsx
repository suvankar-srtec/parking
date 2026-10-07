"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "@/components/FeedbackProvider";
import { ActionButton } from "@/components/LoadingIndicator";

export type CardBlockRow = {
  id: string;
  type: "company" | "owner";
  cardNo: string;
  vehicleNumber: string;
  personName: string;
  personType: string;
  companyName: string;
  entryTime: string | null;
  blocked: boolean;
};

export default function CardBlockManager({ cards }: { cards: CardBlockRow[] }) {
  const router = useRouter();
  const { notify } = useFeedback();
  const { pending, execute } = useMutation();
  const [rows, setRows] = useState(cards);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => setRows(cards), [cards]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible" && !pending) router.refresh();
    };
    const interval = window.setInterval(refresh, 4000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [router, pending]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return rows;
    return rows.filter((row) => [
      row.cardNo,
      row.vehicleNumber,
      row.personName,
      row.personType,
      row.companyName,
      row.blocked ? "blocked" : "active",
    ].some((value) => value.toLowerCase().includes(search)));
  }, [rows, query]);

  function updateBlock(row: CardBlockRow, blocked: boolean) {
    if (pending) return;
    setBusyId(row.id);
    void execute(async () => {
      try {
        const result = await requestJson<{
          ok: true;
          message: string;
          card: { id: string; blocked: boolean };
        }>(
          `/api/access-control/card-block/${row.type}/${row.id}`,
          "PATCH",
          { blocked },
        );
        setRows((current) => current.map((item) =>
          item.id === row.id && item.type === row.type ? { ...item, blocked: result.card.blocked } : item
        ));
        notify(result.message);
      } finally {
        setBusyId(null);
      }
    });
  }

  return <>
    <div className="card-block-toolbar">
      <label className="card-block-search">
        <span>Search entry cards</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="RFID, vehicle, person or company" />
      </label>
      <div className="card-block-count">
        <span>Entry cards</span>
        <strong>{rows.length}</strong>
      </div>
    </div>

    {rows.length === 0 ? <div className="card-block-empty">No RFID cards are currently inside.</div>
      : filtered.length === 0 ? <div className="card-block-empty">No entry cards match your search.</div>
      : <div className="card-block-table-wrap">
        <table className="card-block-table">
          <thead>
            <tr>
              <th>Entry Time</th>
              <th>RFID Card</th>
              <th>Vehicle Number</th>
              <th>Person</th>
              <th>Type</th>
              <th>Company / Owner</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => <tr key={`${row.type}:${row.id}`}>
              <td>{row.entryTime ? new Date(row.entryTime).toLocaleString() : "-"}</td>
              <td><strong>{row.cardNo}</strong></td>
              <td>{row.vehicleNumber}</td>
              <td>{row.personName}</td>
              <td>{row.personType}</td>
              <td>{row.companyName}</td>
              <td><span className={`card-block-status ${row.blocked ? "is-blocked" : "is-active"}`}>{row.blocked ? "Blocked" : "Active"}</span></td>
              <td>
                {row.blocked
                  ? <ActionButton type="button" className="card-unblock-button" pending={pending && busyId === row.id} pendingText="Unblocking..." disabled={pending} onClick={() => updateBlock(row, false)}>Unblock Card</ActionButton>
                  : <ActionButton type="button" className="card-block-button" pending={pending && busyId === row.id} pendingText="Blocking..." disabled={pending} onClick={() => updateBlock(row, true)}>Block Card</ActionButton>}
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>}

    <style>{`
      .card-block-toolbar{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:12px}
      .card-block-search{display:grid;gap:5px;width:min(340px,100%)}
      .card-block-search>span{color:#526158;font-size:9px;font-weight:900;letter-spacing:.35px;text-transform:uppercase}
      .card-block-search input{height:34px;padding:7px 10px;border:1px solid #cbd7cf;border-radius:7px;background:#fff;color:#24332b;font-size:10px;outline:none}
      .card-block-search input:focus{border-color:#7c46ac;box-shadow:0 0 0 3px rgba(124,70,172,.09)}
      .card-block-count{display:flex;align-items:center;gap:8px;padding:6px 9px;border:1px solid #d8e0dc;border-radius:8px;background:#f8faf9;color:#607067;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.3px}
      .card-block-count strong{color:#7c46ac;font-size:16px}
      .card-block-table-wrap{width:100%;overflow:auto}
      .card-block-table{width:100%;min-width:920px;border-collapse:collapse;font-size:10.5px}
      .card-block-table th{padding:9px 10px;border-bottom:1px solid #cbd6d0;background:#f3f6f4;color:#0a0d0b;font-size:9px;font-weight:900;text-align:left;white-space:nowrap}
      .card-block-table td{padding:9px 10px;border-bottom:1px solid #e2e8e4;color:#45564d;vertical-align:middle;white-space:nowrap}
      .card-block-table tbody tr:last-child td{border-bottom:0}
      .card-block-table td strong{color:#142019;font-weight:900}
      .card-block-status{display:inline-flex;align-items:center;justify-content:center;min-width:58px;padding:4px 7px;border-radius:999px;font-size:8.5px;font-weight:900}
      .card-block-status.is-active{background:#eaf7ef;color:#16824f}
      .card-block-status.is-blocked{background:#fdecec;color:#c63838}
      .card-block-button,.card-unblock-button{min-width:86px;min-height:29px;padding:5px 8px;border-radius:6px;font-size:9px;font-weight:900;white-space:nowrap}
      .card-block-button{border:1px solid #d85757;background:#fff2f2;color:#b72828}
      .card-block-button:hover:not(:disabled){background:#ffe4e4}
      .card-unblock-button{border:1px solid #6d9f7d;background:#edf8f1;color:#17713a}
      .card-unblock-button:hover:not(:disabled){background:#ddf2e5}
      .card-block-empty{padding:30px 12px;text-align:center;color:#748078;font-size:11px}
      @media(max-width:700px){.card-block-toolbar{align-items:stretch;flex-direction:column}.card-block-search{width:100%}.card-block-count{align-self:flex-start}}
    `}</style>
  </>;
}
