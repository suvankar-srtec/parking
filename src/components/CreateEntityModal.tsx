"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { checkForm, requestJson } from "@/lib/client-request";
import { parkingFields, validateParking } from "@/lib/parking";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { ActionButton } from "./LoadingIndicator";
import ParkingInputs from "./ParkingInputs";
import PasswordInput from "./PasswordInput";

export default function CreateEntityModal({ kind, buildingId, companyId }: { kind: "building" | "company" | "employee"; buildingId?: string; companyId?: string }) {
  const { notify, refresh } = useFeedback();
  const { pending, execute } = useMutation();
  const [open, setOpen] = useState(false);
  const [parking, setParking] = useState(() => parkingFields({ totalParking: 100, ownerParking: 15, companyParking: 85 }));
  const isBuilding = kind === "building";
  const title = isBuilding ? "Create building" : kind === "company" ? "Create company" : "Add person";
  const [name, setName] = useState("");
  const [generatedUserId, setGeneratedUserId] = useState("");
  const [reservationId, setReservationId] = useState("");
  const [generatingUserId, setGeneratingUserId] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [idRefresh, setIdRefresh] = useState(0);
  const requestVersion = useRef(0);
  const reservationRef = useRef("");

  function show() {
    setParking(parkingFields({ totalParking: 100, ownerParking: 15, companyParking: 85 }));
    setName("");
    setGeneratedUserId("");
    setReservationId("");
    reservationRef.current = "";
    setGeneratingUserId(false);
    setGenerationError("");
    setOpen(true);
  }

  useEffect(() => {
    const version = ++requestVersion.current;
    const trimmedName = name.trim();
    if (!open || !trimmedName) {
      setGeneratedUserId("");
      setReservationId("");
      reservationRef.current = "";
      setGeneratingUserId(false);
      setGenerationError("");
      return;
    }
    const controller = new AbortController();
    const scopeId = isBuilding ? "" : kind === "company" ? buildingId : companyId;
    const previousReservationId = reservationRef.current;
    setGeneratedUserId("");
    setReservationId("");
    reservationRef.current = "";
    setGeneratingUserId(true);
    setGenerationError("");
    const timer = window.setTimeout(() => {
      void requestJson<{ ok: true; userId: string; reservationId: string }>("/api/user-ids", "POST", { kind, scopeId, name: trimmedName, previousReservationId }, controller.signal)
        .then((result) => {
          if (requestVersion.current !== version) return;
          setGeneratedUserId(result.userId);
          setReservationId(result.reservationId);
          reservationRef.current = result.reservationId;
          setGeneratingUserId(false);
        })
        .catch((error: unknown) => {
          if (requestVersion.current !== version || controller.signal.aborted) return;
          setGeneratedUserId("");
          setReservationId("");
          setGeneratingUserId(false);
          setGenerationError(error instanceof Error ? error.message : "Unable to generate a User ID.");
        });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, name, kind, buildingId, companyId, isBuilding, idRefresh]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formError = checkForm(event.currentTarget);
    if (formError) { notify(formError, "error"); return; }
    const formData = new FormData(event.currentTarget);
    const entityName = String(formData.get("name") ?? "").trim();
    const credentials = isBuilding || kind === "company" ? {
      name: entityName,
      username: String(formData.get("username") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    } : { name: entityName };
    if (!credentials.name || ("username" in credentials && (!credentials.username || !credentials.password.trim()))) {
      notify(isBuilding || kind === "company" ? "Enter a name, username, and password." : "Enter a name.", "error"); return;
    }
    if (generatingUserId) { notify("Wait for the generated User ID.", "error"); return; }
    if (!generatedUserId || !reservationId) { notify(generationError || "Enter a name and wait for the generated User ID.", "error"); return; }
    let body: Record<string, unknown> = { ...credentials, userId: generatedUserId, reservationId };
    if (isBuilding) {
      delete body.userId;
      const maximumGate = Number(formData.get("maximumGate"));
      if (!Number.isInteger(maximumGate) || maximumGate < 1) {
        notify("Maximum Gate must be at least 1.", "error"); return;
      }
      const parsed = validateParking({
        totalParking: Number(parking.totalParking),
        ownerParking: Number(parking.ownerParking),
        companyParking: Number(parking.companyParking),
      });
      if (!parsed.ok) { notify(parsed.message, "error"); return; }
      body = { ...body, ...parsed.values, maximumGate };
    } else if (kind === "company") {
      body.parkingAllocation = Number(formData.get("parkingAllocation") ?? 0);
    } else {
      body.category = String(formData.get("category") ?? "EMPLOYEE");
      body.parkingLimit = Number(formData.get("parkingLimit") ?? 1);
    }
    void execute(async () => {
      const endpoint = isBuilding ? "/api/buildings" : kind === "company" ? `/api/buildings/${buildingId}/companies` : `/api/companies/${companyId}/employees`;
      const result = await requestJson(endpoint, "POST", body);
      setOpen(false);
      notify(result.message || `${title} created successfully.`);
      refresh();
    });
  }

  return <>
    <button type="button" className={isBuilding ? "create-building-card" : "add-building-button"} onClick={show}>
      <span className={isBuilding ? "create-building-icon" : "plus-icon"} aria-hidden="true">+</span>
      {isBuilding ? "Create building" : kind === "company" ? "New company" : "Add employee / owner"}
    </button>
    {open && <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !pending) setOpen(false);
    }} onKeyDown={(event) => { if (event.key === "Escape" && !pending) setOpen(false); }}>
      <section className={isBuilding ? "modal-card" : "modal-card small-modal"} role="dialog" aria-modal="true" aria-labelledby="entity-modal-title">
        <div className="modal-head">
          <div><div className="section-kicker">ACCOUNT SETUP</div><h2 id="entity-modal-title">{title}</h2>
            <p>{isBuilding ? "Set up the building and its administrator account." : kind === "company" ? "Add a company and its login account." : "Assign parking spaces to an employee or company owner."}</p></div>
          <button type="button" className="modal-close" aria-label="Close form" disabled={pending} onClick={() => setOpen(false)}>×</button>
        </div>
        <form className="modal-form entity-form" aria-busy={pending} noValidate onSubmit={submit}>
          <fieldset className="entity-fields" disabled={pending}>
            <label>{isBuilding ? "Building name" : kind === "company" ? "Company name" : "Name"}<input name="name" autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder={isBuilding ? "e.g. Central Plaza" : kind === "company" ? "e.g. Acme" : "e.g. Alex Smith"} /></label>
            <div className="generated-id-field">
              <label htmlFor="generated-user-id">{isBuilding ? "Building User ID" : "User ID"}</label>
              <div className="generated-id-wrap">
                <input id="generated-user-id" readOnly value={generatedUserId || (generatingUserId ? "Generating..." : "Generated automatically")} aria-invalid={Boolean(generationError)} />
                <button type="button" className="id-refresh" aria-label="Refresh User ID" title="Refresh User ID" disabled={pending || generatingUserId || !name.trim()} onClick={() => setIdRefresh((value) => value + 1)}>
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.7 7A7 7 0 0 1 20 12M4 12a7 7 0 0 0 14.3 5" /></svg>
                </button>
              </div>
            </div>
            {kind !== "employee" && <label>{isBuilding ? "Building username" : "Username"}<input name="username" required autoComplete="off" placeholder="Username" /></label>}
            {kind !== "employee" && <PasswordInput label={isBuilding ? "Building password" : "Password"} name="password" required autoComplete="new-password" placeholder="Password" disabled={pending} />}
            {isBuilding && <label>Maximum Gate<input name="maximumGate" type="number" min="1" step="1" defaultValue="1" required /></label>}
            {kind === "company" && <label>Parking allocation<input name="parkingAllocation" type="number" min="0" step="1" max="2147483647" defaultValue="0" required /></label>}
            {kind === "employee" && <>
              <label>Type<select name="category" defaultValue="EMPLOYEE" required><option value="EMPLOYEE">Employee</option><option value="OWNER">Company Owner</option></select></label>
              <label>Parking lot limit<input name="parkingLimit" type="number" min="1" step="1" defaultValue="1" required /></label>
            </>}
          </fieldset>
          {isBuilding && <ParkingInputs fields={parking} onChange={setParking} disabled={pending} />}
          <div className="modal-actions">
            <button type="button" className="secondary-button" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
            <ActionButton type="submit" className="primary-button" pending={pending} pendingText={`Creating ${kind}…`}>{title}</ActionButton>
          </div>
        </form>
      </section>
    </div>}
  </>;
}
