"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { requestJson } from "@/lib/client-request";
import { defaultPermissionsForRole, type PermissionKey } from "@/lib/permissions";
import { useFeedback, useMutation } from "./FeedbackProvider";
import PermissionChecklist from "./PermissionChecklist";
import PasswordInput from "./PasswordInput";
import { ActionButton } from "./LoadingIndicator";

export default function AdminCompanyModal({ buildingId }: { buildingId: string }) {
  const { notify, refresh } = useFeedback();
  const { pending, execute } = useMutation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");
  const [reservationId, setReservationId] = useState("");
  const [permissions, setPermissions] = useState<PermissionKey[]>(() => defaultPermissionsForRole("COMPANY_ADMIN"));
  const [departmentLimit, setDepartmentLimit] = useState(1);
  const reservationRef = useRef("");

  useEffect(() => {
    if (!open || !name.trim()) {
      setUserId("");
      setReservationId("");
      reservationRef.current = "";
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void requestJson<{ ok: true; userId: string; reservationId: string }>("/api/user-ids", "POST", {
        kind: "company",
        scopeId: buildingId,
        name: name.trim(),
        previousReservationId: reservationRef.current,
      }, controller.signal)
        .then((result) => {
          setUserId(result.userId);
          setReservationId(result.reservationId);
          reservationRef.current = result.reservationId;
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setUserId("");
            setReservationId("");
          }
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, name, buildingId]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) setOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, pending]);

  function openModal() {
    setName("");
    setUserId("");
    setReservationId("");
    reservationRef.current = "";
    setDepartmentLimit(1);
    setPermissions(defaultPermissionsForRole("COMPANY_ADMIN"));
    setOpen(true);
  }

  function closeModal() {
    if (!pending) setOpen(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId || !reservationId) {
      notify("Enter the company name and wait for the generated User ID.", "error");
      return;
    }

    const data = new FormData(event.currentTarget);
    const parkingAllocation = Number(data.get("parkingAllocation"));

    if (!Number.isInteger(parkingAllocation) || parkingAllocation < 0) {
      notify("Company parking must be a whole number of 0 or greater.", "error");
      return;
    }

    void execute(async () => {
      const result = await requestJson(`/api/buildings/${buildingId}/companies`, "POST", {
        name: name.trim(),
        userId,
        reservationId,
        password: String(data.get("password") || ""),
        parkingAllocation,
        maximumDepartments: departmentLimit,
        permissions,
      });

      notify(result.message || "Company created successfully.");
      setOpen(false);
      refresh();
    });
  }

  return <>
    <button type="button" className="add-building-button" onClick={openModal}>
      <span className="plus-icon">+</span>
      New company
    </button>

    {open ? (
      <div
        className="modal-backdrop company-create-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeModal();
        }}
      >
        <section
          className="company-create-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-company-title"
        >
          <div className="company-create-header">
            <div className="company-create-heading">
              <div className="company-create-icon" aria-hidden="true">C</div>
              <div>
                <div className="section-kicker">COMPANY SETUP</div>
                <h2 id="create-company-title">Create new company</h2>
                <p>Create the company account, allocate parking and choose the features this company can access.</p>
              </div>
            </div>

            <button
              type="button"
              className="company-create-close"
              aria-label="Close create company"
              disabled={pending}
              onClick={closeModal}
            >
              ×
            </button>
          </div>

          <form className="company-create-form" onSubmit={submit}>
            <div className="company-create-details">
              <div className="company-create-section-head">
                <div>
                  <span className="company-create-section-icon" aria-hidden="true">01</span>
                  <div>
                    <strong>Company details</strong>
                    <small>Account identity and parking allocation</small>
                  </div>
                </div>
              </div>

              <fieldset className="company-create-fields" disabled={pending}>
                <label className="company-create-field company-name-field">
                  <span>Company name <em>*</em></span>
                  <input
                    required
                    autoFocus
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Acme Pvt Ltd"
                  />
                </label>

                <label className="company-create-field">
                  <span>User ID</span>
                  <div className="company-generated-field">
                    <input
                      readOnly
                      value={userId || "Generated automatically"}
                      aria-label="Generated User ID"
                    />
                    <small>{userId ? "READY" : "AUTO"}</small>
                  </div>
                </label>

                <div className="company-create-field company-password-field">
                  <PasswordInput
                    label="Password"
                    name="password"
                    required
                    autoComplete="new-password"
                    placeholder="Enter password"
                    disabled={pending}
                  />
                </div>

                <label className="company-create-field">
                  <span>Company parking <em>*</em></span>
                  <div className="company-number-field">
                    <input
                      name="parkingAllocation"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue="0"
                      required
                    />
                    <small>spaces</small>
                  </div>
                </label>

                <div className="company-create-field company-department-field">
                  <span>Department limit</span>
                  <div className="company-department-stepper">
                    <button
                      type="button"
                      aria-label="Decrease department limit"
                      onClick={() => setDepartmentLimit((value) => Math.max(1, value - 1))}
                    >
                      −
                    </button>
                    <strong>{departmentLimit}</strong>
                    <button
                      type="button"
                      aria-label="Increase department limit"
                      onClick={() => setDepartmentLimit((value) => Math.min(500, value + 1))}
                    >
                      +
                    </button>
                  </div>
                  <small>Maximum number of departments this company can create.</small>
                </div>
              </fieldset>

              <div className="company-create-info">
                <span aria-hidden="true">i</span>
                <p>The company can divide its allocated parking between owners and employees after the account is created.</p>
              </div>
            </div>

            <aside className="company-create-permissions">
              <div className="company-create-section-head">
                <div>
                  <span className="company-create-section-icon" aria-hidden="true">02</span>
                  <div>
                    <strong>Access permissions</strong>
                    <small>Choose what the company account can manage</small>
                  </div>
                </div>
              </div>

              <div className="company-permission-card">
                <PermissionChecklist
                  role="COMPANY_ADMIN"
                  value={permissions}
                  onChange={setPermissions}
                  disabled={pending}
                  title="Permissions Allowed"
                />
              </div>
            </aside>

            <div className="company-create-footer">
              <div className="company-create-footer-note">
                <span aria-hidden="true">✓</span>
                <small>All settings can be updated later from company management.</small>
              </div>

              <div className="company-create-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={pending}
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <ActionButton
                  type="submit"
                  className="primary-button company-create-submit"
                  pending={pending}
                  pendingText="Creating…"
                >
                  Create company
                </ActionButton>
              </div>
            </div>
          </form>
        </section>
      </div>
    ) : null}

    <style>{`
      .company-create-backdrop{
        z-index:12000;
        padding:24px;
        background:rgba(22,25,31,.52);
        backdrop-filter:blur(4px);
      }

      .company-create-modal{
        width:min(900px,calc(100vw - 36px));
        max-height:92vh;
        overflow:auto;
        border:1px solid #ded8e6;
        border-radius:18px;
        background:#fff;
        box-shadow:0 30px 90px rgba(29,20,38,.28);
      }

      .company-create-header{
        position:sticky;
        top:0;
        z-index:3;
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:24px;
        padding:22px 24px 19px;
        border-bottom:1px solid #ece7f0;
        background:linear-gradient(180deg,#fff 0%,#fcfaff 100%);
      }

      .company-create-heading{
        display:flex;
        align-items:flex-start;
        gap:14px;
        min-width:0;
      }

      .company-create-icon{
        width:42px;
        height:42px;
        flex:0 0 42px;
        display:grid;
        place-items:center;
        border-radius:12px;
        background:linear-gradient(135deg,#7c46ac,#9d69c4);
        color:#fff;
        font-size:18px;
        font-weight:900;
        box-shadow:0 8px 20px rgba(124,70,172,.23);
      }

      .company-create-heading .section-kicker{
        margin-top:1px;
        font-size:10px;
        letter-spacing:.75px;
      }

      .company-create-heading h2{
        margin:3px 0 5px;
        color:#1c2721;
        font-size:23px;
        line-height:1.15;
      }

      .company-create-heading p{
        max-width:610px;
        margin:0;
        color:#6d7771;
        font-size:12px;
        line-height:1.5;
      }

      .company-create-close{
        width:34px;
        height:34px;
        flex:0 0 34px;
        display:grid;
        place-items:center;
        padding:0;
        border:1px solid #f0c3c0;
        border-radius:50%;
        background:#fff8f7;
        color:#df5a50;
        font-size:20px;
        line-height:1;
        transition:background .15s,border-color .15s,transform .15s;
      }

      .company-create-close:hover:not(:disabled){
        background:#ffefed;
        border-color:#e99791;
        transform:rotate(4deg);
      }

      .company-create-form{
        display:grid;
        grid-template-columns:minmax(0,1.05fr) minmax(310px,.95fr);
        gap:18px;
        padding:20px 24px 0;
      }

      .company-create-details,
      .company-create-permissions{
        min-width:0;
      }

      .company-create-section-head{
        margin-bottom:12px;
      }

      .company-create-section-head>div{
        display:flex;
        align-items:center;
        gap:10px;
      }

      .company-create-section-icon{
        width:28px;
        height:28px;
        display:grid;
        place-items:center;
        border-radius:8px;
        background:#f2eaf8;
        color:#73409e;
        font-size:9px;
        font-weight:900;
        letter-spacing:.3px;
      }

      .company-create-section-head strong{
        display:block;
        color:#26352d;
        font-size:13px;
      }

      .company-create-section-head small{
        display:block;
        margin-top:2px;
        color:#7b857f;
        font-size:9px;
      }

      .company-create-fields{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:13px;
        margin:0;
        padding:16px;
        border:1px solid #e3e7e4;
        border-radius:13px;
        background:#fbfcfb;
      }

      .company-create-field{
        display:grid;
        align-content:start;
        gap:7px;
        min-width:0;
        color:#34473d;
        font-size:11px;
        font-weight:800;
      }

      .company-create-field>span{
        display:block;
      }

      .company-create-field em{
        color:#d45757;
        font-style:normal;
      }

      .company-create-field input{
        width:100%;
        height:42px;
        min-width:0;
        padding:0 12px;
        border:1px solid #ccd7d1;
        border-radius:9px;
        background:#fff;
        color:#24332b;
        outline:0;
        font-size:12px;
        font-weight:600;
        transition:border-color .15s,box-shadow .15s,background .15s;
      }

      .company-create-field input:focus{
        border-color:#8b54b4;
        box-shadow:0 0 0 3px rgba(124,70,172,.1);
      }

      .company-create-field input::placeholder{
        color:#a2aaa5;
        font-weight:500;
      }

      .company-name-field{
        grid-column:1/-1;
      }

      .company-generated-field,
      .company-number-field{
        position:relative;
      }

      .company-generated-field input{
        padding-right:58px;
        background:#f5f2f8;
        border-color:#ddd5e4;
        color:#665a70;
      }

      .company-generated-field small{
        position:absolute;
        top:50%;
        right:8px;
        transform:translateY(-50%);
        padding:4px 6px;
        border-radius:5px;
        background:#ebe1f3;
        color:#75449d;
        font-size:8px;
        font-weight:900;
        letter-spacing:.35px;
      }

      .company-number-field input{
        padding-right:54px;
      }

      .company-number-field small{
        position:absolute;
        top:50%;
        right:11px;
        transform:translateY(-50%);
        color:#8a958e;
        font-size:9px;
        font-weight:700;
      }

      .company-password-field :global(.password-field){
        gap:7px;
        color:#34473d;
        font-size:11px;
      }

      .company-password-field :global(.password-input-wrap input){
        height:42px;
        border-radius:9px;
        font-size:12px;
        font-weight:600;
      }

      .company-password-field :global(.password-toggle){
        top:21px;
      }

      .company-department-field{
        grid-column:1/-1;
        grid-template-columns:minmax(0,1fr) auto;
        align-items:center;
        column-gap:12px;
        padding-top:3px;
      }

      .company-department-field>span{
        grid-column:1;
      }

      .company-department-field>small{
        grid-column:1;
        margin-top:-4px;
        color:#87918b;
        font-size:8.5px;
        font-weight:500;
        line-height:1.4;
      }

      .company-department-stepper{
        grid-column:2;
        grid-row:1/3;
        display:grid;
        grid-template-columns:34px 46px 34px;
        align-items:center;
        overflow:hidden;
        border:1px solid #d7d0dd;
        border-radius:9px;
        background:#fff;
        box-shadow:0 2px 6px rgba(42,29,51,.04);
      }

      .company-department-stepper button{
        height:38px;
        border:0;
        background:#f5f1f8;
        color:#72429b;
        font-size:19px;
        font-weight:500;
      }

      .company-department-stepper button:hover:not(:disabled){
        background:#eadef3;
      }

      .company-department-stepper strong{
        display:grid;
        place-items:center;
        height:38px;
        border-left:1px solid #e1dbe5;
        border-right:1px solid #e1dbe5;
        color:#26352d;
        font-size:14px;
      }

      .company-create-info{
        display:flex;
        align-items:flex-start;
        gap:9px;
        margin-top:12px;
        padding:10px 12px;
        border:1px solid #d9e9e1;
        border-radius:10px;
        background:#f5faf7;
      }

      .company-create-info>span{
        width:18px;
        height:18px;
        flex:0 0 18px;
        display:grid;
        place-items:center;
        border-radius:50%;
        background:#dcefe5;
        color:#297257;
        font-size:10px;
        font-weight:900;
      }

      .company-create-info p{
        margin:0;
        color:#5f7167;
        font-size:9px;
        line-height:1.45;
      }

      .company-create-permissions{
        padding-left:18px;
        border-left:1px solid #ece8ef;
      }

      .company-permission-card{
        min-height:100%;
        padding:14px;
        border:1px solid #dfd8e5;
        border-radius:13px;
        background:linear-gradient(180deg,#fdfcff 0%,#faf8fc 100%);
      }

      .company-permission-card :global(.permission-panel){
        gap:9px;
      }

      .company-permission-card :global(.permission-title-row){
        padding-bottom:3px;
        font-size:11px;
      }

      .company-permission-card :global(.permission-title-row>span){
        border-color:#d9cbe3;
        background:#eee5f5;
        color:#6e3d98;
      }

      .company-permission-card :global(.permission-tree){
        height:248px;
        border-color:#d8d1dc;
        border-radius:9px;
        padding:7px;
        background:#fff;
      }

      .company-permission-card :global(.permission-tree-item){
        border-radius:5px;
      }

      .company-permission-card :global(.permission-actions){
        padding-top:3px;
      }

      .company-permission-card :global(.permission-scope-note){
        padding:8px 9px;
        border-radius:7px;
        background:#f0edf3;
        color:#6e6574;
      }

      .company-create-footer{
        position:sticky;
        bottom:0;
        z-index:3;
        grid-column:1/-1;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:16px;
        margin:2px -24px 0;
        padding:14px 24px 16px;
        border-top:1px solid #e9e5eb;
        background:rgba(255,255,255,.97);
        backdrop-filter:blur(8px);
      }

      .company-create-footer-note{
        display:flex;
        align-items:center;
        gap:7px;
        color:#79847e;
      }

      .company-create-footer-note>span{
        width:20px;
        height:20px;
        display:grid;
        place-items:center;
        border-radius:50%;
        background:#e8f6ee;
        color:#25845e;
        font-size:10px;
        font-weight:900;
      }

      .company-create-footer-note small{
        font-size:9px;
      }

      .company-create-actions{
        display:flex;
        align-items:center;
        gap:9px;
        flex-shrink:0;
      }

      .company-create-actions .secondary-button,
      .company-create-actions .primary-button{
        min-height:40px;
        padding:9px 16px;
        border-radius:8px;
      }

      .company-create-submit{
        min-width:138px;
        box-shadow:0 7px 16px rgba(124,70,172,.2);
      }

      @media(max-width:760px){
        .company-create-backdrop{padding:12px}
        .company-create-modal{width:min(100%,680px);max-height:94vh;border-radius:14px}
        .company-create-header{padding:18px}
        .company-create-heading h2{font-size:20px}
        .company-create-heading p{font-size:11px}
        .company-create-form{grid-template-columns:1fr;padding:17px 18px 0}
        .company-create-permissions{padding-left:0;padding-top:3px;border-left:0;border-top:1px solid #ece8ef}
        .company-create-fields{grid-template-columns:1fr;padding:13px}
        .company-name-field{grid-column:auto}
        .company-department-field{grid-column:auto}
        .company-create-footer{margin:2px -18px 0;padding:13px 18px;align-items:flex-end}
        .company-create-footer-note{display:none}
        .company-create-actions{width:100%;justify-content:flex-end}
      }

      @media(max-width:480px){
        .company-create-heading{gap:10px}
        .company-create-icon{width:36px;height:36px;flex-basis:36px;border-radius:10px;font-size:15px}
        .company-create-header{gap:12px;padding:15px}
        .company-create-form{padding:14px 15px 0}
        .company-create-fields{padding:11px}
        .company-department-field{grid-template-columns:1fr}
        .company-department-field>small{grid-column:1}
        .company-department-stepper{grid-column:1;grid-row:auto;justify-self:start;margin-top:3px}
        .company-create-footer{margin:2px -15px 0;padding:12px 15px}
        .company-create-actions{display:grid;grid-template-columns:1fr 1fr}
        .company-create-actions .secondary-button,
        .company-create-actions .primary-button{width:100%}
      }

      @media(prefers-reduced-motion:reduce){
        .company-create-close,
        .company-create-field input{transition:none}
      }
    `}</style>
  </>;
}
