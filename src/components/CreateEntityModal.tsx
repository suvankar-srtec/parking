"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { UserRole } from "@prisma/client";
import { checkForm, requestJson } from "@/lib/client-request";
import { parkingFields, validateParking } from "@/lib/parking";
import { defaultPermissionsForRole, type PermissionKey } from "@/lib/permissions";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { ActionButton } from "./LoadingIndicator";
import DepartmentPicker from "./DepartmentPicker";
import ParkingInputs from "./ParkingInputs";
import PasswordInput from "./PasswordInput";
import PermissionChecklist from "./PermissionChecklist";

type DepartmentOption = { id: string; name: string };
const emptyDepartments: DepartmentOption[] = [];

export default function CreateEntityModal({
  kind,
  buildingId,
  companyId,
  departments = emptyDepartments,
  maximumDepartments = 10,
}: {
  kind: "building" | "company" | "employee";
  buildingId?: string;
  companyId?: string;
  departments?: DepartmentOption[];
  maximumDepartments?: number;
}) {
  const { notify, refresh } = useFeedback();
  const { pending: saving, execute } = useMutation();
  const [departmentBusy, setDepartmentBusy] = useState(false);
  const pending = saving || departmentBusy;
  const [open, setOpen] = useState(false);
  const [parking, setParking] = useState(() => parkingFields({ totalParking: 100, ownerParking: 15, companyParking: 85 }));
  const isBuilding = kind === "building";
  const creationRole: UserRole | null = isBuilding ? "BUILDING_ADMIN" : kind === "company" ? "COMPANY_ADMIN" : null;
  const title = isBuilding ? "Create building" : kind === "company" ? "Create company" : "Add Employee";
  const [permissions, setPermissions] = useState<PermissionKey[]>(() => creationRole ? defaultPermissionsForRole(creationRole) : []);
  const [name, setName] = useState("");
  const [generatedUserId, setGeneratedUserId] = useState("");
  const [reservationId, setReservationId] = useState("");
  const [generatingUserId, setGeneratingUserId] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [idRefresh, setIdRefresh] = useState(0);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentOption[]>(departments);
  const [department, setDepartment] = useState(departments[0]?.name || "");
  const [newDepartment, setNewDepartment] = useState("");
  const [addingDepartment, setAddingDepartment] = useState(false);
  const [departmentLimit, setDepartmentLimit] = useState(1);
  const requestVersion = useRef(0);
  const reservationRef = useRef("");

  useEffect(() => { setDepartmentOptions(departments); }, [departments]);

  function show() {
    setParking(parkingFields({ totalParking: 100, ownerParking: 15, companyParking: 85 }));
    setName("");
    setGeneratedUserId("");
    setReservationId("");
    reservationRef.current = "";
    setGeneratingUserId(false);
    setGenerationError("");
    setDepartmentOptions(departments);
    setDepartment(departments[0]?.name || "");
    setNewDepartment("");
    setDepartmentLimit(1);
    setPermissions(creationRole ? defaultPermissionsForRole(creationRole) : []);
    setOpen(true);
  }

  async function addDepartment() {
    const clean = newDepartment.trim().replace(/\s+/g, " ");
    if (!companyId || !clean) { notify("Enter a department name.", "error"); return; }
    if (departmentOptions.length >= maximumDepartments) { notify(`This company can have a maximum of ${maximumDepartments} departments.`, "error"); return; }
    setAddingDepartment(true);
    try {
      const result = await requestJson<{ ok: true; message: string; department: DepartmentOption }>(`/api/companies/${companyId}/departments`, "POST", { name: clean });
      setDepartmentOptions((current) => [...current.filter((item) => item.id !== result.department.id), result.department].sort((a, b) => a.name.localeCompare(b.name)));
      setDepartment(result.department.name);
      setNewDepartment("");
      notify(result.message);
      refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to add department.", "error");
    } finally { setAddingDepartment(false); }
  }

  useEffect(() => {
    const version = ++requestVersion.current;
    const trimmedName = name.trim();
    if (!open || !trimmedName) {
      setGeneratedUserId(""); setReservationId(""); reservationRef.current = ""; setGeneratingUserId(false); setGenerationError(""); return;
    }
    const controller = new AbortController();
    const scopeId = isBuilding ? "" : kind === "company" ? buildingId : companyId;
    const previousReservationId = reservationRef.current;
    setGeneratedUserId(""); setReservationId(""); reservationRef.current = ""; setGeneratingUserId(true); setGenerationError("");
    const timer = window.setTimeout(() => {
      void requestJson<{ ok: true; userId: string; reservationId: string }>("/api/user-ids", "POST", { kind, scopeId, name: trimmedName, previousReservationId }, controller.signal)
        .then((result) => {
          if (requestVersion.current !== version) return;
          setGeneratedUserId(result.userId); setReservationId(result.reservationId); reservationRef.current = result.reservationId; setGeneratingUserId(false);
        })
        .catch((error: unknown) => {
          if (requestVersion.current !== version || controller.signal.aborted) return;
          setGeneratedUserId(""); setReservationId(""); setGeneratingUserId(false); setGenerationError(error instanceof Error ? error.message : "Unable to generate a User ID.");
        });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, name, kind, buildingId, companyId, isBuilding, idRefresh]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || addingDepartment) return;
    const formError = checkForm(event.currentTarget);
    if (formError) { notify(formError, "error"); return; }
    const formData = new FormData(event.currentTarget);
    const entityName = String(formData.get("name") ?? "").trim();
    const credentials = isBuilding || kind === "company" ? { name: entityName, password: String(formData.get("password") ?? "") } : { name: entityName };
    if (!credentials.name || ("password" in credentials && !credentials.password?.trim())) {
      notify(isBuilding || kind === "company" ? "Enter a name and password." : "Enter a name.", "error"); return;
    }
    if (generatingUserId) { notify("Wait for the generated User ID.", "error"); return; }
    if (!generatedUserId || !reservationId) { notify(generationError || "Enter a name and wait for the generated User ID.", "error"); return; }

    let body: Record<string, unknown> = { ...credentials, userId: generatedUserId, reservationId };
    if (creationRole) body.permissions = permissions;
    if (isBuilding) {
      delete body.userId;
      const maximumGate = Number(formData.get("maximumGate"));
      if (!Number.isInteger(maximumGate) || maximumGate < 1) { notify("Maximum Gate must be at least 1.", "error"); return; }
      const parsed = validateParking({ totalParking: Number(parking.totalParking), ownerParking: Number(parking.ownerParking), companyParking: Number(parking.companyParking) });
      if (!parsed.ok) { notify(parsed.message, "error"); return; }
      body = { ...body, ...parsed.values, maximumGate };
    } else if (kind === "company") {
      body.parkingAllocation = Number(formData.get("parkingAllocation") ?? 0);
      body.maximumDepartments = departmentLimit;
    } else {
      if (!department) { notify("Select or add a department.", "error"); return; }
      body.category = String(formData.get("category") ?? "EMPLOYEE");
      body.parkingLimit = Number(formData.get("parkingLimit") ?? 1);
      body.department = department;
    }

    void execute(async () => {
      const endpoint = isBuilding ? "/api/buildings" : kind === "company" ? `/api/buildings/${buildingId}/companies` : `/api/companies/${companyId}/employees`;
      const result = await requestJson(endpoint, "POST", body);
      setOpen(false);
      notify(result.message || `${title} created successfully.`);
      refresh();
    });
  }

  const accountFields = <fieldset className="entity-fields compact-entity-fields" disabled={pending}>
    <label>{isBuilding ? "Building name" : "Company name"}<input name="name" autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder={isBuilding ? "e.g. Central Plaza" : "e.g. Acme"} /></label>
    <div className="generated-id-field">
      <label htmlFor="generated-user-id">{isBuilding ? "Building User ID" : "User ID"}</label>
      <div className="generated-id-wrap">
        <input id="generated-user-id" readOnly value={generatedUserId || (generatingUserId ? "Generating..." : "Generated automatically")} aria-invalid={Boolean(generationError)} />
        <button type="button" className="id-refresh" aria-label="Refresh User ID" title="Refresh User ID" disabled={pending || generatingUserId || !name.trim()} onClick={() => setIdRefresh((value) => value + 1)}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.7 7A7 7 0 0 1 20 12M4 12a7 7 0 0 0 14.3 5" /></svg>
        </button>
      </div>
    </div>
    <PasswordInput label={isBuilding ? "Building password" : "Password"} name="password" required autoComplete="new-password" placeholder="Password" disabled={pending} />
    {isBuilding ? <label>Maximum Gate<input name="maximumGate" type="number" min="1" step="1" defaultValue="1" required /></label> : <>
      <label>Parking allocation<input name="parkingAllocation" type="number" min="0" step="1" max="2147483647" defaultValue="0" required /></label>
      <div className="department-limit-field"><span>Department</span><div className="department-stepper"><button type="button" aria-label="Decrease department limit" onClick={() => setDepartmentLimit((value) => Math.max(1, value - 1))}>−</button><strong>{departmentLimit}</strong><button type="button" aria-label="Increase department limit" onClick={() => setDepartmentLimit((value) => Math.min(500, value + 1))}>+</button></div></div>
    </>}
  </fieldset>;

  return <>
    <button type="button" className={isBuilding ? "create-building-card" : "add-building-button"} onClick={show}>
      <span className={isBuilding ? "create-building-icon" : "plus-icon"} aria-hidden="true">+</span>
      {isBuilding ? "Create building" : kind === "company" ? "New company" : "Add Employee"}
    </button>
    {open && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape" && !pending) setOpen(false); }}>
      <section className={creationRole ? "modal-card permission-modal" : "modal-card small-modal"} role="dialog" aria-modal="true" aria-labelledby="entity-modal-title">
        <div className="modal-head">
          <div><div className="section-kicker">ACCOUNT SETUP</div><h2 id="entity-modal-title">{title}</h2><p>{isBuilding ? "Set up the building and choose the Admin features this account can access." : kind === "company" ? "Add a company and choose the Company/User features this account can access." : "Create an employee or company owner and assign their department and parking limit."}</p></div>
          <button type="button" className="modal-close" aria-label="Close form" disabled={pending} onClick={() => setOpen(false)}>×</button>
        </div>
        <form className={`modal-form entity-form${creationRole ? " permission-layout-form" : ""}`} aria-busy={pending} noValidate onSubmit={submit}>
          {creationRole ? <>
            <div className="entity-main-column">
              {accountFields}
              {isBuilding && <ParkingInputs fields={parking} onChange={setParking} disabled={pending} />}
            </div>
            <PermissionChecklist role={creationRole} value={permissions} onChange={setPermissions} disabled={pending} title={isBuilding ? "Admin / Building Admin" : "Company / User"} />
          </> : <fieldset className="entity-fields" disabled={pending}>
            <label>Name<input name="name" autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Alex Smith" /></label>
            <div className="generated-id-field"><label htmlFor="generated-user-id">User ID</label><div className="generated-id-wrap"><input id="generated-user-id" readOnly value={generatedUserId || (generatingUserId ? "Generating..." : "Generated automatically")} aria-invalid={Boolean(generationError)} /><button type="button" className="id-refresh" aria-label="Refresh User ID" title="Refresh User ID" disabled={pending || generatingUserId || !name.trim()} onClick={() => setIdRefresh((value) => value + 1)}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.7 7A7 7 0 0 1 20 12M4 12a7 7 0 0 0 14.3 5" /></svg></button></div></div>
            <label>Type<select name="category" defaultValue="EMPLOYEE" required><option value="EMPLOYEE">Employee</option><option value="OWNER">Company Owner</option></select></label>
            <label>Parking lot limit<input name="parkingLimit" type="number" min="1" step="1" defaultValue="1" required /></label>
            <DepartmentPicker companyId={companyId!} departments={departmentOptions} value={department} onChange={setDepartment} disabled={pending || addingDepartment} onBusyChange={setDepartmentBusy} onRemoved={(id) => setDepartmentOptions((current) => current.filter((item) => item.id !== id))} />
            <div className="generated-id-field"><label htmlFor="new-department">Add department <span className="department-count">{departmentOptions.length}/{maximumDepartments}</span></label><div className="generated-id-wrap"><input id="new-department" value={newDepartment} onChange={(event) => setNewDepartment(event.target.value)} placeholder="e.g. Marketing" /><button type="button" className="id-refresh" style={{ width: 68, borderRadius: 7, fontWeight: 800, fontSize: 11 }} disabled={addingDepartment || !newDepartment.trim() || departmentOptions.length >= maximumDepartments} onClick={() => void addDepartment()}>{addingDepartment ? "Adding…" : "+ Add"}</button></div></div>
          </fieldset>}
          <div className="modal-actions">
            <button type="button" className="secondary-button" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
            <ActionButton type="submit" className="primary-button" pending={pending} pendingText={kind === "employee" ? "Adding employee…" : `Creating ${kind}…`}>{title}</ActionButton>
          </div>
        </form>
      </section>
    </div>}
    <style>{`
      .permission-modal{width:min(980px,97vw);padding:17px 18px;max-height:92vh}
      .permission-layout-form{grid-template-columns:minmax(0,1.15fr) minmax(330px,.85fr);align-items:start;gap:12px;margin-top:12px}
      .entity-main-column{display:grid;gap:10px;min-width:0}
      .compact-entity-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px 10px;border:0;padding:0;margin:0}
      .compact-entity-fields label{font-size:10.5px;gap:5px}
      .compact-entity-fields input,.compact-entity-fields select{padding:8px 9px;min-height:36px}
      .permission-layout-form .parking-editor-grid{gap:7px}
      .permission-layout-form .parking-input-card{padding:8px}
      .permission-layout-form .modal-actions{grid-column:1/-1}
      .department-limit-field{display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:700;color:#304238}.department-stepper{height:42px;border:1px solid #cad6cf;border-radius:8px;background:#fff;display:grid;grid-template-columns:44px 1fr 44px;align-items:center;overflow:hidden}.department-stepper button{height:100%;border:0;background:#f6f8f7;color:#6f3da3;font-size:20px;font-weight:900;cursor:pointer}.department-stepper button:hover{background:#efe6f6}.department-stepper strong{text-align:center;font-size:15px;color:#2a3a31}.department-count{font-size:10px;color:#7d8982;font-weight:700}
      @media(max-width:820px){.permission-layout-form{grid-template-columns:1fr}.permission-layout-form .modal-actions{grid-column:auto}.compact-entity-fields{grid-template-columns:1fr 1fr}}
      @media(max-width:560px){.permission-modal{padding:14px}.compact-entity-fields{grid-template-columns:1fr}}
    `}</style>
  </>;
}
