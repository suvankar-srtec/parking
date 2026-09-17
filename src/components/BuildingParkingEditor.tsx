"use client";

import { useState, type FormEvent } from "react";
import { validateParking, parkingFields, type ParkingValues } from "@/lib/parking";
import { checkForm, requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { ActionButton } from "./LoadingIndicator";
import ParkingInputs from "./ParkingInputs";

type BuildingSettingsValues = ParkingValues & { maximumGate: number };

export default function BuildingParkingEditor({
  buildingId,
  initialValues,
  canEditMaximumGate = true,
}: {
  buildingId: string;
  initialValues: BuildingSettingsValues;
  canEditMaximumGate?: boolean;
}) {
  const { notify, refresh } = useFeedback();
  const { pending, execute } = useMutation();
  const [fields, setFields] = useState(() => parkingFields(initialValues));
  const [maximumGate, setMaximumGate] = useState(String(initialValues.maximumGate));
  const [saved, setSaved] = useState(initialValues);
  const parkingChanged = (Object.keys(fields) as Array<keyof ParkingValues>).some((field) => fields[field] !== String(saved[field]));
  const gateChanged = canEditMaximumGate && maximumGate !== String(saved.maximumGate);
  const changed = parkingChanged || gateChanged;

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formError = checkForm(event.currentTarget);
    if (formError) { notify(formError, "error"); return; }
    const parsed = validateParking({
      totalParking: Number(fields.totalParking),
      ownerParking: Number(fields.ownerParking),
      companyParking: Number(fields.companyParking),
    });
    if (!parsed.ok) { notify(parsed.message, "error"); return; }

    let parsedMaximumGate = saved.maximumGate;
    if (canEditMaximumGate) {
      parsedMaximumGate = Number(maximumGate);
      if (!Number.isInteger(parsedMaximumGate) || parsedMaximumGate < 1 || parsedMaximumGate > 2147483647) {
        notify("Maximum Gate must be a whole number of at least 1.", "error");
        return;
      }
    }

    void execute(async () => {
      const payload = canEditMaximumGate
        ? { ...parsed.values, maximumGate: parsedMaximumGate }
        : parsed.values;
      const data = await requestJson<{ ok: boolean; message: string; building: BuildingSettingsValues }>(
        `/api/buildings/${buildingId}`, "PATCH", payload,
      );
      setSaved(data.building);
      setFields(parkingFields(data.building));
      setMaximumGate(String(data.building.maximumGate));
      notify(canEditMaximumGate ? "Building settings updated successfully." : "Parking allocation updated successfully.");
      refresh();
    });
  }

  return <form className="parking-editor" aria-label={canEditMaximumGate ? "Building parking and gate settings" : "Building parking allocation"} aria-busy={pending} noValidate onSubmit={save}>
    <ParkingInputs fields={fields} onChange={setFields} disabled={pending} />
    {canEditMaximumGate ? <div className="maximum-gate-editor">
      <label className="parking-input-card">
        <span>Maximum Gate</span>
        <div className="parking-input-wrap">
          <input
            type="number"
            aria-label="Maximum Gate"
            name="maximumGate"
            min="1"
            max="2147483647"
            step="1"
            required
            disabled={pending}
            value={maximumGate}
            onChange={(event) => setMaximumGate(event.target.value)}
          />
          <span aria-hidden="true">gates</span>
        </div>
      </label>
    </div> : null}
    <div className="parking-editor-footer">
      <div className="parking-edit-actions">
        <button type="button" className="secondary-button" disabled={pending || !changed} onClick={() => {
          setFields(parkingFields(saved));
          setMaximumGate(String(saved.maximumGate));
          notify("Unsaved changes discarded.");
        }}>Discard changes</button>
        <ActionButton type="submit" className="primary-button" disabled={!changed} pending={pending} pendingText={canEditMaximumGate ? "Updating settings…" : "Updating parking…"}>{canEditMaximumGate ? "Update settings" : "Update parking"}</ActionButton>
      </div>
    </div>
  </form>;
}
