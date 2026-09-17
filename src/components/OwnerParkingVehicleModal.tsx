"use client";

import { useState, type FormEvent } from "react";
import { checkForm, requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { ActionButton, Spinner } from "./LoadingIndicator";
import CardCapture, { type CapturedCard } from "./CardCapture";
import RemoveParkingAllocationButton from "./RemoveParkingAllocationButton";

const vehicleTypes = ["Two wheeler", "Four wheeler"];

type OwnerVehicle = {
  id: string;
  ownerName: string;
  plateNumber: string;
  vehicleType: string;
  rfidCardNo: string | null;
  isInside: boolean;
};

export default function OwnerParkingVehicleModal({
  buildingId,
  ownerParking,
  registeredVehicles,
}: {
  buildingId: string;
  ownerParking: number;
  registeredVehicles: number;
}) {
  const { notify, refresh } = useFeedback();
  const { pending, execute } = useMutation();
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [vehicles, setVehicles] = useState<OwnerVehicle[]>([]);
  const [card, setCard] = useState<CapturedCard | null>(null);
  const parkingFull = registeredVehicles >= ownerParking;

  async function openManage() {
    setManageOpen(true);
    setLoadingAllocations(true);
    try {
      const result = await requestJson<{ vehicles: OwnerVehicle[] }>(`/api/buildings/${buildingId}/owner-vehicles`, "GET");
      setVehicles(Array.isArray(result.vehicles) ? result.vehicles : []);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to load Owner Parking allocations.", "error");
    } finally {
      setLoadingAllocations(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const error = checkForm(form);
    if (error) { notify(error, "error"); return; }
    const data = new FormData(form);
    const body = {
      ownerName: String(data.get("ownerName") ?? "").trim(),
      plateNumber: String(data.get("plateNumber") ?? "").trim(),
      vehicleType: String(data.get("vehicleType") ?? ""),
      enrollmentId: card?.enrollmentId,
    };
    if (pending) return;

    void execute(async () => {
      const result = await requestJson(`/api/buildings/${buildingId}/owner-vehicles`, "POST", body);
      setOpen(false);
      setCard(null);
      notify(result.message || "Owner Parking vehicle registered successfully.");
      refresh();
    });
  }

  return <>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        className="secondary-button vehicle-add-button"
        disabled={parkingFull || ownerParking <= 0}
        onClick={() => { setCard(null); setOpen(true); }}
      >
        {parkingFull ? "Owner parking full" : "Add vehicle"}
      </button>
      {registeredVehicles > 0 ? <button type="button" className="secondary-button" onClick={() => void openManage()}>Manage allocations</button> : null}
    </div>

    {open && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setOpen(false); }}>
      <section className="modal-card small-modal" role="dialog" aria-modal="true" aria-labelledby="owner-vehicle-modal-title">
        <div className="modal-head">
          <div>
            <div className="section-kicker">OWNER PARKING</div>
            <h2 id="owner-vehicle-modal-title">Add vehicle</h2>
            <p>Register a vehicle against the building&apos;s allotted Owner Parking spaces.</p>
          </div>
          <button type="button" className="modal-close" aria-label="Close form" disabled={pending} onClick={() => setOpen(false)}>×</button>
        </div>

        <form className="modal-form entity-form" noValidate onSubmit={submit}>
          <fieldset className="entity-fields" disabled={pending}>
            <label>Owner Name<input name="ownerName" required placeholder="Enter owner name" /></label>
            <label>Plate Number<input name="plateNumber" required placeholder="e.g. WB 01 AB 1234" /></label>
            <label>Vehicle Type<select name="vehicleType" defaultValue="" required><option value="" disabled>Select vehicle type</option>{vehicleTypes.map((vehicleType) => <option key={vehicleType}>{vehicleType}</option>)}</select></label>
            <CardCapture buildingId={buildingId} ownerParking onCaptured={setCard} />
          </fieldset>

          <div className="modal-actions">
            <button type="button" className="secondary-button" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
            <ActionButton type="submit" className="primary-button" pending={pending} pendingText="Registering...">Register vehicle</ActionButton>
          </div>
        </form>
      </section>
    </div>}

    {manageOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setManageOpen(false); }}>
      <section className="modal-card small-modal" role="dialog" aria-modal="true" aria-labelledby="manage-owner-allocation-title">
        <div className="modal-head">
          <div>
            <div className="section-kicker">OWNER PARKING</div>
            <h2 id="manage-owner-allocation-title">Manage allocations</h2>
            <p>Remove vehicles that no longer need Owner Parking access. Vehicles currently inside must exit first.</p>
          </div>
          <button type="button" className="modal-close" aria-label="Close allocations" onClick={() => setManageOpen(false)}>×</button>
        </div>
        <div className="entity-list" style={{ marginTop: 14 }}>
          {loadingAllocations ? <p><Spinner /> Loading allocations…</p> : vehicles.length ? vehicles.map((vehicle) => <article className="entity-row" key={vehicle.id}>
            <div>
              <strong>{vehicle.ownerName}</strong>
              <span>{vehicle.plateNumber} · {vehicle.vehicleType}{vehicle.rfidCardNo ? ` · RFID ${vehicle.rfidCardNo}` : ""} · {vehicle.isInside ? "Inside" : "Outside"}</span>
            </div>
            <RemoveParkingAllocationButton
              endpoint={`/api/buildings/${buildingId}/owner-vehicles/${vehicle.id}`}
              vehicleLabel={vehicle.plateNumber}
              disabled={vehicle.isInside}
            />
          </article>) : <p className="muted">No Owner Parking allocations found.</p>}
        </div>
      </section>
    </div>}
  </>;
}
