"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client-request";
import { useFeedback } from "./FeedbackProvider";

type GateDirection = "SELECT" | "ENTRY" | "EXIT" | "ENTRY_EXIT";

type GateRow = {
  gateNumber: number;
  direction: GateDirection;
};

type BuildingGateRow = {
  id: string;
  name: string;
  maximumGate: number;
  gates: GateRow[];
};

function directionLabel(direction: GateDirection) {
  if (direction === "ENTRY") return "Entry";
  if (direction === "EXIT") return "Exit";
  if (direction === "ENTRY_EXIT") return "Entry / Exit";
  return "Not configured";
}

export default function GateDetailsManager({ buildings }: { buildings: BuildingGateRow[] }) {
  const { notify } = useFeedback();
  const [rows, setRows] = useState(buildings);
  const [savingKey, setSavingKey] = useState("");

  async function updateDirection(buildingId: string, gateNumber: number, direction: GateDirection) {
    const key = `${buildingId}:${gateNumber}`;
    const previous = rows;
    setRows((current) => current.map((building) => building.id !== buildingId ? building : {
      ...building,
      gates: building.gates.map((gate) => gate.gateNumber === gateNumber ? { ...gate, direction } : gate),
    }));
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

  async function addGate(buildingId: string) {
    const building = rows.find((item) => item.id === buildingId);
    if (!building || building.gates.length >= building.maximumGate) {
      notify(`Maximum Gate limit reached (${building?.maximumGate ?? 0}).`, "error");
      return;
    }
    const key = `${buildingId}:add`;
    setSavingKey(key);
    try {
      const result = await requestJson<{ ok: boolean; message: string; gate: GateRow }>(`/api/gates/${buildingId}`, "POST");
      setRows((current) => current.map((item) => item.id !== buildingId ? item : {
        ...item,
        gates: [...item.gates.filter((gate) => gate.gateNumber !== result.gate.gateNumber), result.gate].sort((a, b) => a.gateNumber - b.gateNumber),
      }));
      notify(result.message || `Gate ${result.gate.gateNumber} added.`);
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

  if (!rows.length) return <p className="muted">No buildings are available for this account.</p>;

  return <div className="gate-building-list">
    {rows.map((building) => <section className="gate-building-card" key={building.id}>
      <div className="gate-building-head">
        <div className="gate-building-title">
          <div className="section-kicker">BUILDING</div>
          <h3>{building.name}</h3>
        </div>
        <div className="gate-limit-badge"><span>Max Gates</span><strong>{building.maximumGate}</strong></div>
      </div>

      <div className="gate-table-wrap">
        <table className="gate-table">
          <thead>
            <tr>
              <th>Gate</th>
              <th>Direction</th>
              <th>Entry</th>
              <th>Exit</th>
              <th>Status</th>
              <th className="manage-heading">Manage</th>
            </tr>
          </thead>
          <tbody>
            {building.gates.map((gate, index) => {
              const key = `${building.id}:${gate.gateNumber}`;
              const saving = savingKey === key || savingKey === `${key}:remove`;
              const entryActive = gate.direction === "ENTRY" || gate.direction === "ENTRY_EXIT";
              const exitActive = gate.direction === "EXIT" || gate.direction === "ENTRY_EXIT";
              const isLast = index === building.gates.length - 1;
              const canAdd = isLast && building.gates.length < building.maximumGate;
              const canRemove = building.gates.length > 1;
              return <tr key={gate.gateNumber}>
                <td><span className="gate-number">Gate {gate.gateNumber}</span></td>
                <td>
                  <div className="gate-select-shell">
                    <select
                      aria-label={`${building.name} Gate ${gate.gateNumber} direction`}
                      value={gate.direction}
                      disabled={saving}
                      onChange={(event) => void updateDirection(building.id, gate.gateNumber, event.target.value as GateDirection)}
                    >
                      <option value="SELECT">Select</option>
                      <option value="ENTRY">Entry</option>
                      <option value="EXIT">Exit</option>
                      <option value="ENTRY_EXIT">Entry / Exit</option>
                    </select>
                    <span aria-hidden="true">⌄</span>
                  </div>
                </td>
                <td>
                  <label className={`gate-radio-state ${entryActive ? "active" : "faded"}`}>
                    <input type="radio" checked={entryActive} readOnly tabIndex={-1} aria-label="Entry enabled" />
                    <span>Entry</span>
                  </label>
                </td>
                <td>
                  <label className={`gate-radio-state ${exitActive ? "active" : "faded"}`}>
                    <input type="radio" checked={exitActive} readOnly tabIndex={-1} aria-label="Exit enabled" />
                    <span>Exit</span>
                  </label>
                </td>
                <td><span className={`gate-status-pill ${saving ? "saving" : gate.direction === "SELECT" ? "unconfigured" : "ready"}`}>{saving ? "Saving…" : directionLabel(gate.direction)}</span></td>
                <td>
                  <div className="gate-row-actions">
                    {canRemove ? <button type="button" className="gate-icon-button remove" aria-label={`Remove Gate ${gate.gateNumber}`} disabled={Boolean(savingKey)} onClick={() => void removeGate(building.id, gate.gateNumber)}>−</button> : <span className="gate-icon-placeholder" />}
                    {canAdd ? <button type="button" className="gate-icon-button add" aria-label={`Add gate to ${building.name}`} disabled={Boolean(savingKey)} onClick={() => void addGate(building.id)}>+</button> : null}
                  </div>
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>)}

    <style>{`
      .gate-building-list{display:grid;gap:10px}
      .gate-building-card{border:1px solid #d9e3dd;border-radius:9px;background:#fff;overflow:hidden;box-shadow:0 1px 2px rgba(31,51,40,.025)}
      .gate-building-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 14px;background:#fff}
      .gate-building-title{display:flex;align-items:center;gap:10px;min-width:0}
      .gate-building-title .section-kicker{margin:0;font-size:8px;letter-spacing:.5px;white-space:nowrap}
      .gate-building-head h3{margin:0;font-size:16px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .gate-limit-badge{display:flex;align-items:center;gap:8px;padding:5px 9px;border:1px solid #d8e2dc;border-radius:7px;background:#f7faf8;white-space:nowrap}
      .gate-limit-badge span{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:#69766e}
      .gate-limit-badge strong{font-size:15px;line-height:1;color:#7c46ac}
      .gate-table-wrap{overflow-x:auto;border-top:1px solid #e1e8e4}
      .gate-table{width:100%;border-collapse:collapse;min-width:700px;table-layout:fixed}
      .gate-table th{padding:7px 10px;background:#f3f7f5;color:#5c6962;font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.38px;text-align:left;white-space:nowrap}
      .gate-table th:nth-child(1){width:12%}
      .gate-table th:nth-child(2){width:25%}
      .gate-table th:nth-child(3),.gate-table th:nth-child(4){width:14%}
      .gate-table th:nth-child(5){width:20%}
      .gate-table th:nth-child(6){width:15%}
      .gate-table td{padding:8px 10px;border-top:1px solid #e9eeeb;vertical-align:middle;font-size:12px}
      .gate-table tbody tr:first-child td{border-top:0}
      .gate-table tbody tr:hover td{background:#fbfdfc}
      .gate-number{font-weight:800;color:#17261e;white-space:nowrap;font-size:12.5px}
      .gate-select-shell{position:relative;width:100%;max-width:190px}
      .gate-select-shell select{width:100%;height:32px;appearance:none;border:1px solid #cbd8d0;border-radius:7px;background:#fff;padding:5px 28px 5px 10px;font:inherit;font-size:12px;font-weight:700;color:#25372d;outline:none;cursor:pointer}
      .gate-select-shell select:hover{border-color:#aebfb5}
      .gate-select-shell select:focus{border-color:#8249b4;box-shadow:0 0 0 2px rgba(130,73,180,.1)}
      .gate-select-shell select:disabled{cursor:wait;background:#f4f5f4;color:#8a918d}
      .gate-select-shell>span{position:absolute;right:9px;top:50%;transform:translateY(-53%);pointer-events:none;color:#68766e;font-size:11px;font-weight:900}
      .gate-radio-state{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;transition:opacity .2s ease;white-space:nowrap}
      .gate-radio-state input{width:14px;height:14px;margin:0;accent-color:#7c46ac;pointer-events:none}
      .gate-radio-state.active{opacity:1;color:#273a30}
      .gate-radio-state.faded{opacity:.22;color:#9aa39e}
      .gate-status-pill{display:inline-flex;align-items:center;justify-content:center;min-width:76px;padding:4px 7px;border-radius:999px;font-size:9px;font-weight:800;white-space:nowrap}
      .gate-status-pill.ready{background:#edf8f2;color:#186b4e;border:1px solid #cce8d9}
      .gate-status-pill.saving{background:#f5effa;color:#71439b;border:1px solid #e2d5ed}
      .gate-status-pill.unconfigured{background:#f4f5f4;color:#7c8781;border:1px solid #e1e5e3}
      .manage-heading{text-align:center!important}
      .gate-row-actions{display:flex;align-items:center;justify-content:center;gap:5px;min-width:60px}
      .gate-icon-button{width:26px;height:26px;border-radius:6px;border:1px solid #ced9d2;background:#fff;font-size:17px;line-height:1;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:.15s ease}
      .gate-icon-button.add{color:#6f3da3;border-color:#cbb5df;background:#f8f3fb}
      .gate-icon-button.remove{color:#ad3636;border-color:#ebcaca;background:#fff8f8}
      .gate-icon-button:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 3px 8px rgba(33,55,43,.08)}
      .gate-icon-button:disabled{opacity:.45;cursor:not-allowed}
      .gate-icon-placeholder{display:inline-block;width:26px;height:26px}
      @media(max-width:760px){
        .gate-building-head{padding:9px 11px}
        .gate-building-title{gap:7px}
        .gate-limit-badge span{display:none}
        .gate-table th,.gate-table td{padding-left:8px;padding-right:8px}
      }
    `}</style>
  </div>;
}
