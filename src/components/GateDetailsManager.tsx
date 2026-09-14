"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client-request";
import { useFeedback } from "./FeedbackProvider";

type GateDirection = "SELECT" | "ENTRY" | "EXIT" | "ENTRY_EXIT";

type GateRow = {
  gateNumber: number;
  direction: GateDirection;
  readerId: string | null;
};

type GateReader = {
  id: string;
  name: string;
  deviceNumber: string;
  mode: string;
  enabled: boolean;
  readerIp: string | null;
};

type BuildingGateRow = {
  id: string;
  name: string;
  maximumGate: number;
  gates: GateRow[];
  readers: GateReader[];
};

function directionLabel(direction: GateDirection) {
  if (direction === "ENTRY") return "Entry";
  if (direction === "EXIT") return "Exit";
  if (direction === "ENTRY_EXIT") return "Entry / Exit";
  return "Not configured";
}

function readerModeLabel(mode: string) {
  if (mode === "REGISTER") return "Registration";
  if (mode === "ENTRY_EXIT") return "Entry / Exit";
  if (mode === "EXIT") return "Exit";
  if (mode === "ENTRY") return "Entry";
  return mode || "Not set";
}

export default function GateDetailsManager({ buildings }: { buildings: BuildingGateRow[] }) {
  const { notify } = useFeedback();
  const [rows, setRows] = useState(buildings);
  const [savingKey, setSavingKey] = useState("");
  const [search, setSearch] = useState("");

  const normalizedSearch = search.trim().toLowerCase();
  const visibleRows = normalizedSearch
    ? rows.filter((building) => building.name.toLowerCase().includes(normalizedSearch))
    : rows;

  function updateGateLocal(buildingId: string, gateNumber: number, patch: Partial<GateRow>) {
    setRows((current) => current.map((building) => building.id !== buildingId ? building : {
      ...building,
      gates: building.gates.map((gate) => gate.gateNumber === gateNumber ? { ...gate, ...patch } : gate),
    }));
  }

  async function updateDirection(buildingId: string, gateNumber: number, direction: GateDirection) {
    const key = `${buildingId}:${gateNumber}`;
    const previous = rows;
    updateGateLocal(buildingId, gateNumber, direction === "SELECT" ? { direction, readerId: null } : { direction });
    setSavingKey(key);

    try {
      const result = await requestJson<{ ok: boolean; message: string }>(
        `/api/gates/${buildingId}/${gateNumber}`,
        "PATCH",
        { direction },
      );
      notify(result.message || `Gate ${gateNumber} updated successfully.`);
    } catch (error) {
      setRows(previous);
      notify(error instanceof Error ? error.message : "Unable to update gate direction.", "error");
    } finally {
      setSavingKey("");
    }
  }

  async function updateReader(buildingId: string, gateNumber: number, readerId: string) {
    const building = rows.find((item) => item.id === buildingId);
    const gate = building?.gates.find((item) => item.gateNumber === gateNumber);
    if (!building || !gate) return;
    if (gate.direction === "SELECT" && readerId) {
      notify("Select the gate direction before allotting a reader.", "error");
      return;
    }

    const key = `${buildingId}:${gateNumber}:reader`;
    const previous = rows;
    updateGateLocal(buildingId, gateNumber, { readerId: readerId || null });
    setSavingKey(key);

    try {
      const result = await requestJson<{ ok: boolean; message: string }>(
        `/api/gates/${buildingId}/${gateNumber}`,
        "PATCH",
        { readerId: readerId || null },
      );
      notify(result.message || (readerId ? `Reader allotted to Gate ${gateNumber}.` : `Reader removed from Gate ${gateNumber}.`));
    } catch (error) {
      setRows(previous);
      notify(error instanceof Error ? error.message : "Unable to update reader allocation.", "error");
    } finally {
      setSavingKey("");
    }
  }

  async function addGate(buildingId: string) {
    const building = rows.find((item) => item.id === buildingId);
    if (!building || building.gates.length >= building.maximumGate) {
      notify(`Maximum Gate limit reached (${building?.maximumGate ?? 0}).`, "error");
      return;
    }
    const key = `${buildingId}:add`;
    setSavingKey(key);
    try {
      const result = await requestJson<{ ok: boolean; message: string; gate: { gateNumber: number; direction: GateDirection } }>(`/api/gates/${buildingId}`, "POST");
      const nextGate: GateRow = { gateNumber: result.gate.gateNumber, direction: result.gate.direction, readerId: null };
      setRows((current) => current.map((item) => item.id !== buildingId ? item : {
        ...item,
        gates: [...item.gates.filter((gate) => gate.gateNumber !== nextGate.gateNumber), nextGate].sort((a, b) => a.gateNumber - b.gateNumber),
      }));
      notify(result.message || `Gate ${nextGate.gateNumber} added.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to add gate.", "error");
    } finally {
      setSavingKey("");
    }
  }

  async function removeGate(buildingId: string, gateNumber: number) {
    const building = rows.find((item) => item.id === buildingId);
    if (!building || building.gates.length <= 1) {
      notify("At least one gate must remain visible for the building.", "error");
      return;
    }
    const key = `${buildingId}:${gateNumber}:remove`;
    setSavingKey(key);
    try {
      const result = await requestJson<{ ok: boolean; message: string }>(`/api/gates/${buildingId}/${gateNumber}`, "DELETE");
      setRows((current) => current.map((item) => item.id !== buildingId ? item : {
        ...item,
        gates: item.gates.filter((gate) => gate.gateNumber !== gateNumber),
      }));
      notify(result.message || `Gate ${gateNumber} removed.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to remove gate.", "error");
    } finally {
      setSavingKey("");
    }
  }

  return <div className="gate-manager">
    <div className="gate-manager-toolbar">
      <div><div className="section-kicker">BUILDING GATES</div><h2>Gate direction management</h2></div>
      <label className="gate-search" aria-label="Search building">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search building name" autoComplete="off" />
      </label>
    </div>
    <div className="gate-manager-divider" />

    {!rows.length ? <p className="gate-empty">No buildings are available for this account.</p> :
      !visibleRows.length ? <div className="gate-empty-search"><strong>No building found</strong><span>No building matches “{search.trim()}”.</span></div> :
      <div className="gate-building-list">
        {visibleRows.map((building) => {
          const assignedIds = new Set(building.gates.map((gate) => gate.readerId).filter((id): id is string => Boolean(id)));
          const selectableReaders = building.readers.filter((reader) => reader.enabled && reader.mode !== "REGISTER");

          return <section className="gate-building-card" key={building.id}>
            <div className="gate-building-head">
              <div className="gate-building-title"><div className="section-kicker">BUILDING</div><h3>{building.name}</h3></div>
              <div className="gate-reader-summary"><span>Allotted Readers</span><strong>{assignedIds.size}</strong></div>
            </div>

            <div className="gate-table-wrap">
              <table className="gate-table">
                <thead><tr><th>Gate</th><th>Direction</th><th>Reader</th><th>Status</th><th className="manage-heading">Manage</th></tr></thead>
                <tbody>
                  {building.gates.map((gate, index) => {
                    const key = `${building.id}:${gate.gateNumber}`;
                    const saving = savingKey.startsWith(key);
                    const isLast = index === building.gates.length - 1;
                    const canAdd = isLast && building.gates.length < building.maximumGate;
                    const canRemove = building.gates.length > 1;
                    const currentReader = gate.readerId ? building.readers.find((reader) => reader.id === gate.readerId) : null;
                    const readerOptions = selectableReaders.filter((reader) => reader.id === gate.readerId || !assignedIds.has(reader.id));
                    const configured = gate.direction !== "SELECT" && Boolean(gate.readerId);

                    return <tr key={gate.gateNumber}>
                      <td><span className="gate-number">Gate {gate.gateNumber}</span></td>
                      <td>
                        <div className="gate-select-shell">
                          <select aria-label={`${building.name} Gate ${gate.gateNumber} direction`} value={gate.direction} disabled={saving} onChange={(event) => void updateDirection(building.id, gate.gateNumber, event.target.value as GateDirection)}>
                            <option value="SELECT">Select</option><option value="ENTRY">Entry</option><option value="EXIT">Exit</option><option value="ENTRY_EXIT">Entry / Exit</option>
                          </select><span aria-hidden="true">⌄</span>
                        </div>
                      </td>
                      <td>
                        <div className="reader-select-shell">
                          <select aria-label={`${building.name} Gate ${gate.gateNumber} reader`} value={gate.readerId || ""} disabled={saving || gate.direction === "SELECT"} onChange={(event) => void updateReader(building.id, gate.gateNumber, event.target.value)}>
                            <option value="">{gate.direction === "SELECT" ? "Select direction first" : "Select reader"}</option>
                            {readerOptions.map((reader) => <option key={reader.id} value={reader.id}>{reader.name} · {reader.deviceNumber}</option>)}
                          </select><span aria-hidden="true">⌄</span>
                        </div>
                        {currentReader ? <div className="reader-meta"><i className={currentReader.enabled ? "online" : "offline"} />{readerModeLabel(currentReader.mode)}{currentReader.readerIp ? ` · ${currentReader.readerIp}` : ""}</div> : null}
                      </td>
                      <td><span className={`gate-status-pill ${saving ? "saving" : configured ? "ready" : "unconfigured"}`}>{saving ? "Saving…" : configured ? directionLabel(gate.direction) : gate.direction === "SELECT" ? "Not configured" : "Reader required"}</span></td>
                      <td><div className="gate-row-actions">
                        {canRemove ? <button type="button" className="gate-icon-button remove" aria-label={`Remove Gate ${gate.gateNumber}`} disabled={Boolean(savingKey)} onClick={() => void removeGate(building.id, gate.gateNumber)}>−</button> : <span className="gate-icon-placeholder" />}
                        {canAdd ? <button type="button" className="gate-icon-button add" aria-label={`Add gate to ${building.name}`} disabled={Boolean(savingKey)} onClick={() => void addGate(building.id)}>+</button> : null}
                      </div></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </section>;
        })}
      </div>}

    <style>{`
      .gate-manager{width:100%}.gate-manager-toolbar{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:0 0 11px}.gate-manager-toolbar h2{margin:3px 0 0;font-size:19px;line-height:1.2}.gate-search{width:min(300px,38%);height:36px;display:flex;align-items:center;gap:8px;padding:0 11px;border:1px solid #ccd8d1;border-radius:8px;background:#fff}.gate-search:focus-within{border-color:#8249b4;box-shadow:0 0 0 3px rgba(130,73,180,.09)}.gate-search svg{width:16px;height:16px;fill:none;stroke:#77837c;stroke-width:1.8;stroke-linecap:round;flex:0 0 auto}.gate-search input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:#24362c;font:inherit;font-size:12px;font-weight:600}.gate-search input::placeholder{color:#8a958f;font-weight:500}.gate-manager-divider{height:1px;background:#dce4df;margin:0 0 10px}.gate-empty{margin:14px 0;color:#738078}.gate-empty-search{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:130px;border:1px dashed #d5ded9;border-radius:9px;background:#fafcfb;color:#6f7c75;text-align:center}.gate-empty-search strong{color:#2a3b32;font-size:13px}.gate-empty-search span{font-size:11px}.gate-building-list{display:grid;gap:10px}.gate-building-card{border:1px solid #d9e3dd;border-radius:9px;background:#fff;overflow:hidden}.gate-building-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:9px 13px}.gate-building-title{display:flex;align-items:center;gap:10px;min-width:0}.gate-building-title .section-kicker{margin:0;font-size:8px;letter-spacing:.5px;white-space:nowrap}.gate-building-head h3{margin:0;font-size:15px;line-height:1.2}.gate-reader-summary{display:flex;align-items:center;gap:7px;padding:4px 8px;border:1px solid #d8e2dc;border-radius:7px;background:#f7faf8;white-space:nowrap}.gate-reader-summary span{font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:.35px;color:#69766e}.gate-reader-summary strong{font-size:13px;line-height:1;color:#176b4d}.gate-table-wrap{overflow-x:auto;border-top:1px solid #e1e8e4}.gate-table{width:100%;border-collapse:collapse;min-width:760px;table-layout:fixed}.gate-table th{padding:7px 10px;background:#f3f7f5;color:#5c6962;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.35px;text-align:left;white-space:nowrap}.gate-table th:nth-child(1){width:11%}.gate-table th:nth-child(2){width:21%}.gate-table th:nth-child(3){width:39%}.gate-table th:nth-child(4){width:17%}.gate-table th:nth-child(5){width:12%}.gate-table td{padding:8px 10px;border-top:1px solid #e9eeeb;vertical-align:middle;font-size:11.5px}.gate-table tbody tr:first-child td{border-top:0}.gate-table tbody tr:hover td{background:#fbfdfc}.gate-number{font-weight:800;color:#17261e;white-space:nowrap;font-size:12px}.gate-select-shell,.reader-select-shell{position:relative;width:100%;max-width:210px}.reader-select-shell{max-width:320px}.gate-select-shell select,.reader-select-shell select{width:100%;height:31px;appearance:none;border:1px solid #cbd8d0;border-radius:7px;background:#fff;padding:5px 28px 5px 10px;font:inherit;font-size:11.5px;font-weight:700;color:#25372d;outline:none;cursor:pointer}.gate-select-shell select:focus,.reader-select-shell select:focus{border-color:#8249b4;box-shadow:0 0 0 2px rgba(130,73,180,.1)}.gate-select-shell select:disabled,.reader-select-shell select:disabled{cursor:not-allowed;background:#f4f5f4;color:#8a918d}.gate-select-shell>span,.reader-select-shell>span{position:absolute;right:9px;top:50%;transform:translateY(-53%);pointer-events:none;color:#68766e;font-size:11px;font-weight:900}.reader-meta{display:flex;align-items:center;gap:5px;margin-top:4px;color:#748078;font-size:8.5px}.reader-meta i{width:6px;height:6px;border-radius:50%;background:#d69d1c}.reader-meta i.online{background:#18a66d}.gate-status-pill{display:inline-flex;align-items:center;justify-content:center;min-width:78px;padding:4px 7px;border-radius:999px;font-size:9px;font-weight:800;white-space:nowrap}.gate-status-pill.ready{background:#edf8f2;color:#186b4e;border:1px solid #cce8d9}.gate-status-pill.saving{background:#f5effa;color:#71439b;border:1px solid #e2d5ed}.gate-status-pill.unconfigured{background:#f4f5f4;color:#7c8781;border:1px solid #e1e5e3}.manage-heading{text-align:center!important}.gate-row-actions{display:flex;align-items:center;justify-content:center;gap:5px;min-width:60px}.gate-icon-button{width:26px;height:26px;border-radius:6px;border:1px solid #ced9d2;background:#fff;font-size:17px;line-height:1;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}.gate-icon-button.add{color:#6f3da3;border-color:#cbb5df;background:#f8f3fb}.gate-icon-button.remove{color:#ad3636;border-color:#ebcaca;background:#fff8f8}.gate-icon-button:disabled{opacity:.45;cursor:not-allowed}.gate-icon-placeholder{display:inline-block;width:26px;height:26px}@media(max-width:760px){.gate-manager-toolbar{align-items:stretch;flex-direction:column;gap:9px}.gate-search{width:100%}.gate-building-head{padding:9px 11px}.gate-reader-summary span{display:none}.gate-table th,.gate-table td{padding-left:8px;padding-right:8px}}
    `}</style>
  </div>;
}
