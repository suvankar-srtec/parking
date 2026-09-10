"use client";

import { useState, type FormEvent } from "react";
import { validateParking, parkingFields, type ParkingValues } from "@/lib/parking";
import { checkForm, requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { ActionButton } from "./LoadingIndicator";
import ParkingInputs from "./ParkingInputs";

export default function BuildingParkingEditor({ buildingId, initialValues }: {
  buildingId: string; initialValues: ParkingValues;
}) {
  const { notify, refresh } = useFeedback();
  const { pending, execute } = useMutation();
  const [fields, setFields] = useState(() => parkingFields(initialValues));
  const [saved, setSaved] = useState(initialValues);
  const changed = (Object.keys(fields) as Array<keyof ParkingValues>).some((field) => fields[field] !== String(saved[field]));

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
    void execute(async () => {
      const data = await requestJson<{ ok: boolean; message: string; building: ParkingValues }>(
        `/api/buildings/${buildingId}`, "PATCH", parsed.values,
      );
      setSaved(data.building);
      setFields(parkingFields(data.building));
      notify("Parking allocation updated successfully.");
      refresh();
    });
  }

  return <form className="parking-editor" aria-label="Building parking settings" aria-busy={pending} noValidate onSubmit={save}>
    <ParkingInputs fields={fields} onChange={setFields} disabled={pending} />
    <div className="parking-editor-footer">
      <div className="parking-edit-actions">
        <button type="button" className="secondary-button" disabled={pending || !changed} onClick={() => {
          setFields(parkingFields(saved));
          notify("Unsaved changes discarded.");
        }}>Discard changes</button>
        <ActionButton type="submit" className="primary-button" disabled={!changed} pending={pending} pendingText="Updating parking…">Update parking</ActionButton>
      </div>
    </div>
  </form>;
}
