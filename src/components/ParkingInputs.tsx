"use client";

import { MAX_PARKING, type ParkingFields, type ParkingValues, syncParkingField } from "@/lib/parking";

export default function ParkingInputs({ fields, onChange, disabled = false }: {
  fields: ParkingFields;
  onChange: (fields: ParkingFields) => void;
  disabled?: boolean;
}) {
  return <div className="parking-editor-grid">
    {([
      ["totalParking", "Total parking"],
      ["ownerParking", "Owner parking"],
      ["companyParking", "Company parking"],
    ] as Array<[keyof ParkingValues, string]>).map(([field, label]) => (
      <label className={`parking-input-card parking-input-${field}`} key={field}>
        <span>{label}</span>
        <div className="parking-input-wrap">
          <input type="number" aria-label={label} name={field} min={field === "totalParking" ? 1 : 0}
            max={field === "totalParking" ? MAX_PARKING : Number(fields.totalParking) || MAX_PARKING}
            step="1" required disabled={disabled} value={fields[field]}
            onChange={(event) => onChange(syncParkingField(fields, field, event.target.value))} />
          <span aria-hidden="true">spaces</span>
        </div>
      </label>
    ))}
  </div>;
}
