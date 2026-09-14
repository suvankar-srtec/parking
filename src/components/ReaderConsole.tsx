"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "@/components/AppLink";
import { readerStatus, type ReaderConnection } from "@/lib/reader-status";
import { requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { ActionButton, Spinner } from "./LoadingIndicator";

type Reader = ReaderConnection & {
  id: string;
  name: string;
  deviceNumber: string;
  mode: string;
  enabled: boolean;
  buildingId: string | null;
  readerIp: string | null;
  sourcePort: number | null;
  hasRegistrationQr?: boolean;
  hasEntryExitQr?: boolean;
};

type ReaderData = {
  readers: Reader[];
  availableReaders: Reader[];
  buildings: { id: string; name: string }[];
  canManage: boolean;
  canAddReaders: boolean;
};

type Activity = { inside: number };

const MAX_QR_FILE_BYTES = 1_100_000;

function readQrImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/i)) {
      reject(new Error("Please select a PNG, JPG, or WEBP QR image."));
      return;
    }
    if (file.size > MAX_QR_FILE_BYTES) {
      reject(new Error("QR image is too large. Please use an image smaller than 1 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("The QR image could not be read."));
    reader.readAsDataURL(file);
  });
}

function normalizedMode(mode: string) {
  return mode === "REGISTER" ? "REGISTER" : "ENTRY_EXIT";
}

function modeLabel(mode: string) {
  return mode === "REGISTER" ? "Registration" : "Entry / Exit";
}

function qrKindForMode(mode: string) {
  return mode === "REGISTER" ? "registration" : "entryExit";
}

function hasQrForMode(reader: Reader, mode: string) {
  return mode === "REGISTER" ? Boolean(reader.hasRegistrationQr) : Boolean(reader.hasEntryExitQr);
}

function storedQrUrl(reader: Reader, mode: string, revision: number) {
  const kind = qrKindForMode(mode);
  return `/api/rfid/readers/${encodeURIComponent(reader.deviceNumber)}/qr?kind=${kind}&v=${revision}`;
}

export default function ReaderConsole({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<ReaderData | null>(null);
  const [activity, setActivity] = useState<Activity>({ inside: 0 });
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<Reader | null>(null);
  const [editingMode, setEditingMode] = useState("ENTRY_EXIT");
  const [showAvailable, setShowAvailable] = useState(false);
  const [setupStep, setSetupStep] = useState<1 | 2>(1);
  const [selectedReader, setSelectedReader] = useState<Reader | null>(null);
  const [setupMode, setSetupMode] = useState("ENTRY_EXIT");
  const [registrationQr, setRegistrationQr] = useState("");
  const [entryExitQr, setEntryExitQr] = useState("");
  const [revision, setRevision] = useState(0);
  const { notify } = useFeedback();
  const { pending, execute } = useMutation();

  useEffect(() => {
    let stopped = false;
    let failed = false;
    let timer: ReturnType<typeof setTimeout>;

    async function load() {
      try {
        const response = await fetch("/api/rfid/readers", {
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
        const devices = await response.json();
        if (!response.ok) throw new Error(devices.message || "Reader status unavailable.");

        let inside = 0;
        if (!compact) {
          const activityResponse = await fetch("/api/rfid/events", {
            cache: "no-store",
            signal: AbortSignal.timeout(10000),
          });
          const activityData = await activityResponse.json();
          if (activityResponse.ok) inside = Number(activityData.inside || 0);
        }

        if (!stopped) {
          setData(devices);
          setActivity({ inside });
          setError(false);
          failed = false;
        }
      } catch (cause) {
        if (!stopped) {
          setError(true);
          if (!compact && !failed) notify(cause instanceof Error ? cause.message : "Reader status unavailable.", "error");
          failed = true;
        }
      }
      if (!stopped) timer = setTimeout(load, 5000);
    }

    void load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [compact, revision, notify]);

  function openAddReader() {
    setSelectedReader(null);
    setRegistrationQr("");
    setEntryExitQr("");
    setSetupMode("ENTRY_EXIT");
    setSetupStep(1);
    setShowAvailable(true);
  }

  function closeAddReader() {
    if (pending) return;
    setShowAvailable(false);
    setSelectedReader(null);
    setRegistrationQr("");
    setEntryExitQr("");
    setSetupMode("ENTRY_EXIT");
    setSetupStep(1);
  }

  function openConfigure(reader: Reader) {
    setEditing(reader);
    setEditingMode(normalizedMode(reader.mode));
  }

  async function pickQr(event: ChangeEvent<HTMLInputElement>, kind: "registration" | "entryExit") {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readQrImage(file);
      if (kind === "registration") setRegistrationQr(dataUrl);
      else setEntryExitQr(dataUrl);
    } catch (cause) {
      event.target.value = "";
      notify(cause instanceof Error ? cause.message : "Unable to read the QR image.", "error");
    }
  }

  if (compact) {
    return <div className="reader-panel">
      <Link href="/access-control" className="reader-heading">RFID readers</Link>
      {error ? <p>Status unavailable</p> : !data ? <p>Loading readers…</p> : !data.readers.length ? <p>No readers configured</p> : data.readers.map((reader) => {
        const state = readerStatus(reader);
        return <div className="reader-line" key={reader.id}>
          <i className={"reader-dot " + state.tone} />
          <span>{reader.name} · {reader.deviceNumber}<small>{state.label}</small></span>
        </div>;
      })}
    </div>;
  }

  function saveExisting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void execute(async () => {
      const result = await requestJson("/api/rfid/readers", "POST", {
        deviceNumber: editing!.deviceNumber,
        name: form.get("name"),
        buildingId: form.get("buildingId"),
        mode: editingMode,
        enabled: form.get("enabled") === "on",
        heartbeatSeconds: editing!.heartbeatSeconds,
      });
      notify(result.message || "Reader saved.");
      setEditing(null);
      setRevision((n) => n + 1);
    });
  }

  function allowReader(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!selectedReader || !registrationQr || !entryExitQr) {
      notify("Select a reader and upload both QR images before allowing the reader.", "error");
      return;
    }
    void execute(async () => {
      const result = await requestJson("/api/rfid/readers", "POST", {
        deviceNumber: selectedReader.deviceNumber,
        name: form.get("name"),
        buildingId: form.get("buildingId"),
        mode: setupMode,
        enabled: true,
        heartbeatSeconds: selectedReader.heartbeatSeconds,
        registrationQrData: registrationQr,
        entryExitQrData: entryExitQr,
      });
      notify(result.message || "Reader added successfully.");
      setShowAvailable(false);
      setSelectedReader(null);
      setRegistrationQr("");
      setEntryExitQr("");
      setSetupMode("ENTRY_EXIT");
      setSetupStep(1);
      setRevision((n) => n + 1);
    });
  }

  function removeReader(reader: Reader) {
    if (!window.confirm(`Remove ${reader.name} (${reader.deviceNumber})? It will return to the available reader list.`)) return;
    void execute(async () => {
      const result = await requestJson("/api/rfid/readers", "POST", {
        action: "reset",
        deviceNumber: reader.deviceNumber,
      });
      notify(result.message || "Reader removed.");
      setRevision((n) => n + 1);
    });
  }

  const setupQr = setupMode === "REGISTER" ? registrationQr : entryExitQr;

  return <>
    <section className="portfolio-card">
      <div className="portfolio-header">
        <div>
          <div className="section-kicker">ACCESS CONTROL</div>
          <h2>Reader configuration</h2>
          <p>Readers communicate with Vercel through HTTPS. Assign a building and operating mode.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {data?.canAddReaders && <button className="secondary-button" type="button" onClick={openAddReader}>+ Add reader</button>}
          <strong>{activity.inside} vehicles inside</strong>
        </div>
      </div>

      {!data ? <p><Spinner /> Loading readers…</p> : <div className="reader-grid">
        {data.readers.map((reader) => {
          const state = error ? { tone: "unknown", label: "Status unavailable" } : readerStatus(reader);
          return <article className="reader-card" key={reader.id}>
            <h3>{reader.name}</h3>
            <p>{reader.deviceNumber} · {reader.readerIp || "IP not detected"}</p>
            <div className="reader-line"><i className={"reader-dot " + state.tone} />{state.label}</div>
            <p>{data.buildings.find((building) => building.id === reader.buildingId)?.name || "Building not assigned"} · {modeLabel(normalizedMode(reader.mode))}</p>
            <p className="muted">{reader.enabled ? "Approved" : "Disabled"} · Last contact: {reader.lastSeenAt ? new Date(reader.lastSeenAt).toLocaleString() : "None"}</p>
            <p className="muted">Setup QR: {reader.hasRegistrationQr ? "Registration ✓" : "Registration missing"} · {reader.hasEntryExitQr ? "Entry / Exit ✓" : "Entry / Exit missing"}</p>
            {data.canManage && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="secondary-button" onClick={() => openConfigure(reader)}>Configure reader</button>
              {data.canAddReaders && <button className="secondary-button" disabled={pending} onClick={() => removeReader(reader)}>Remove reader</button>}
            </div>}
          </article>;
        })}
      </div>}
      <p className="muted">HTTPS readers are green after recent scan/heartbeat activity. The hardware red LED is separate and belongs to a successful scan response.</p>
    </section>

    {showAvailable && <div className="modal-backdrop">
      <section className="modal-card reader-selector-modal" role="dialog" aria-modal="true" aria-label="Add RFID reader">
        <div className="modal-head reader-selector-head">
          <div>
            <div className="section-kicker">ADD RFID READER · STEP {setupStep} OF 2</div>
            <h2>{setupStep === 1 ? "Select reader" : "Set up reader"}</h2>
            <p>{setupStep === 1 ? "Choose an available reader to continue." : "Upload both setup QR codes, assign the reader, then scan the QR shown for the selected operating mode."}</p>
          </div>
          <button className="modal-close" disabled={pending} aria-label="Close add reader" onClick={closeAddReader}>×</button>
        </div>

        {setupStep === 1 && <>
          {!data?.availableReaders?.length ? <p className="muted reader-selector-empty">No unassigned readers are currently available. Power on a reader and make sure its HTTPS URL is pointing to this application.</p> : <div className="reader-selector-list">
            {data.availableReaders.map((reader) => {
              const state = readerStatus(reader);
              const selected = selectedReader?.id === reader.id;
              return <button type="button" className={`reader-selector-row${selected ? " selected" : ""}`} key={reader.id} onClick={() => setSelectedReader(reader)}>
                <div className="reader-selector-main">
                  <div className="reader-selector-title">
                    <i className={"reader-dot " + state.tone} />
                    <strong>Device {reader.deviceNumber}</strong>
                  </div>
                  <div className="reader-selector-meta">
                    <span><b>IP</b>{reader.readerIp || "Not detected"}</span>
                    <span><b>Status</b>{state.label}</span>
                    <span><b>Last contact</b>{reader.lastSeenAt ? new Date(reader.lastSeenAt).toLocaleString() : "None"}</span>
                  </div>
                </div>
                <span className="reader-selector-action">{selected ? "Selected ✓" : "Select"}</span>
              </button>;
            })}
          </div>}
          <div className="modal-actions reader-selector-actions">
            <button type="button" className="secondary-button" onClick={closeAddReader}>Cancel</button>
            <button type="button" className="primary-button" disabled={!selectedReader} onClick={() => setSetupStep(2)}>Next</button>
          </div>
        </>}

        {setupStep === 2 && selectedReader && <form className="modal-form entity-form" onSubmit={allowReader}>
          <div className="reader-card" style={{ marginBottom: 14 }}>
            <strong>Device {selectedReader.deviceNumber}</strong>
            <p>IP address: {selectedReader.readerIp || "Not detected"}</p>
          </div>

          <fieldset className="entity-fields" disabled={pending}>
            <label>Name<input name="name" defaultValue={selectedReader.name || `Reader ${selectedReader.deviceNumber}`} required /></label>
            <label>Building<select name="buildingId" defaultValue="" required><option value="">Select building</option>{data?.buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}</select></label>
            <label>Operating mode<select name="mode" value={setupMode} onChange={(event) => setSetupMode(event.target.value)}><option value="ENTRY_EXIT">Entry / Exit</option><option value="REGISTER">Registration</option></select></label>
          </fieldset>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 14 }}>
            <label className="reader-card" style={{ display: "block" }}>
              <strong>Registration QR</strong>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void pickQr(event, "registration")} style={{ display: "block", marginTop: 8, width: "100%" }} />
              {registrationQr && <img src={registrationQr} alt="Registration QR preview" style={{ width: 130, height: 130, objectFit: "contain", marginTop: 10, border: "1px solid #ddd", borderRadius: 8 }} />}
            </label>
            <label className="reader-card" style={{ display: "block" }}>
              <strong>Entry / Exit QR</strong>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void pickQr(event, "entryExit")} style={{ display: "block", marginTop: 8, width: "100%" }} />
              {entryExitQr && <img src={entryExitQr} alt="Entry and Exit QR preview" style={{ width: 130, height: 130, objectFit: "contain", marginTop: 10, border: "1px solid #ddd", borderRadius: 8 }} />}
            </label>
          </div>

          <div className="reader-card" style={{ marginTop: 14, textAlign: "center" }}>
            <div className="section-kicker">QR FOR SELECTED MODE</div>
            <h3>{modeLabel(setupMode)}</h3>
            {setupQr ? <>
              <img src={setupQr} alt={`${modeLabel(setupMode)} configuration QR`} style={{ width: 210, height: 210, objectFit: "contain", margin: "8px auto", display: "block", border: "1px solid #ddd", borderRadius: 10 }} />
              <p className="muted">Scan this QR with the physical reader to configure it for {modeLabel(setupMode)}.</p>
            </> : <p className="muted">Upload the {setupMode === "REGISTER" ? "Registration" : "Entry / Exit"} QR to preview the configuration QR for this mode.</p>}
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" disabled={pending} onClick={() => setSetupStep(1)}>Back</button>
            <ActionButton type="submit" className="primary-button" pending={pending} pendingText="Adding…" disabled={!registrationQr || !entryExitQr}>Allow reader</ActionButton>
          </div>
        </form>}
      </section>
    </div>}

    {editing && <div className="modal-backdrop">
      <section className="modal-card small-modal" role="dialog" aria-modal="true" aria-label="Configure reader">
        <div className="modal-head">
          <div><h2>Configure {editing.deviceNumber}</h2><p>{editing.readerIp || "IP not detected"}</p></div>
          <button className="modal-close" disabled={pending} aria-label="Close reader settings" onClick={() => setEditing(null)}>×</button>
        </div>
        <form className="modal-form entity-form" onSubmit={saveExisting}>
          <fieldset className="entity-fields" disabled={pending}>
            <label>Device number<input value={editing.deviceNumber} readOnly /></label>
            <label>Name<input name="name" defaultValue={editing.name} required /></label>
            <label>Building<select name="buildingId" defaultValue={editing.buildingId || ""} required><option value="">Select building</option>{data?.buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}</select></label>
            <label>Operating mode<select name="mode" value={editingMode} onChange={(event) => setEditingMode(event.target.value)}><option value="ENTRY_EXIT">Entry / Exit</option><option value="REGISTER">Registration</option></select></label>
            <label className="reader-enabled"><input type="checkbox" name="enabled" defaultChecked={editing.enabled} />Approved / enabled</label>
          </fieldset>

          <div className="reader-card" style={{ marginTop: 14, textAlign: "center" }}>
            <div className="section-kicker">READER CONFIGURATION QR</div>
            <h3>{modeLabel(editingMode)}</h3>
            {hasQrForMode(editing, editingMode) ? <>
              <img src={storedQrUrl(editing, editingMode, revision)} alt={`${modeLabel(editingMode)} reader configuration QR`} style={{ width: 220, height: 220, objectFit: "contain", margin: "8px auto", display: "block", border: "1px solid #ddd", borderRadius: 10 }} />
              <p className="muted">Scan this QR with the physical reader, then save the selected mode below.</p>
            </> : <p className="muted">The {editingMode === "REGISTER" ? "Registration" : "Entry / Exit"} QR has not been uploaded for this reader.</p>}
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" disabled={pending} onClick={() => setEditing(null)}>Cancel</button>
            <ActionButton type="submit" className="primary-button" pending={pending} pendingText="Saving…">Save reader</ActionButton>
          </div>
        </form>
      </section>
    </div>}

    <style>{`
      .reader-selector-modal{width:min(620px,94vw);padding:17px 18px 16px;border-radius:11px;box-shadow:0 24px 70px rgba(20,34,27,.22)}
      .reader-selector-head{align-items:flex-start;padding-bottom:12px;border-bottom:1px solid #e0e7e3}
      .reader-selector-head h2{font-size:17px;margin:3px 0 3px}
      .reader-selector-head p{font-size:11px;line-height:1.45}
      .reader-selector-list{display:grid;gap:7px;margin-top:12px;max-height:315px;overflow:auto;padding:1px}
      .reader-selector-row{width:100%;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 11px;border:1px solid #d7e1db;border-radius:8px;background:#fbfdfc;color:#25372e;text-align:left;cursor:pointer;transition:border-color .15s ease,background .15s ease,box-shadow .15s ease,transform .15s ease}
      .reader-selector-row:hover{border-color:#b9c9c0;background:#fff;box-shadow:0 5px 15px rgba(31,52,40,.06);transform:translateY(-1px)}
      .reader-selector-row.selected{border-color:#8b50b9;background:#faf7fc;box-shadow:0 0 0 2px rgba(139,80,185,.10)}
      .reader-selector-main{min-width:0;flex:1}
      .reader-selector-title{display:flex;align-items:center;gap:7px}
      .reader-selector-title strong{font-size:12.5px;line-height:1.2}
      .reader-selector-title .reader-dot{width:7px;height:7px;flex:0 0 auto}
      .reader-selector-meta{display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap;margin-top:6px;color:#738078;font-size:9.5px;line-height:1.25}
      .reader-selector-meta span{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
      .reader-selector-meta b{color:#536159;font-size:8px;text-transform:uppercase;letter-spacing:.35px}
      .reader-selector-action{flex:0 0 auto;min-width:70px;padding:6px 8px;border:1px solid #d7dfda;border-radius:6px;background:#fff;color:#53645b;font-size:10px;font-weight:800;text-align:center}
      .reader-selector-row.selected .reader-selector-action{border-color:#d4bee5;background:#eee5f5;color:#6d3998}
      .reader-selector-empty{margin:14px 0 2px;padding:14px;border:1px dashed #d7dfda;border-radius:8px;background:#fafcfb;font-size:11px;text-align:center}
      .reader-selector-actions{margin-top:12px;padding-top:12px}
      .reader-selector-actions .secondary-button,.reader-selector-actions .primary-button{min-width:70px;padding:8px 12px;font-size:11px}
      @media(max-width:600px){
        .reader-selector-modal{padding:15px}
        .reader-selector-row{align-items:flex-start}
        .reader-selector-meta{display:grid;gap:4px}
        .reader-selector-action{min-width:62px}
      }
    `}</style>
  </>;
}
