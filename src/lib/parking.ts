export type ParkingValues = {
  totalParking: number;
  ownerParking: number;
  companyParking: number;
};

export const MAX_PARKING = 2147483647;

export function validateParking(input: unknown):
  | { ok: true; values: ParkingValues }
  | { ok: false; message: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, message: "Enter all three parking values." };
  }
  const values = input as ParkingValues;
  for (const [field, label] of [
    ["totalParking", "Total parking"],
    ["ownerParking", "Owner parking"],
    ["companyParking", "Company parking"],
  ] as const) {
    const value = values[field];
    const minimum = field === "totalParking" ? 1 : 0;
    if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > MAX_PARKING) {
      return { ok: false, message: `${label} must be a whole number between ${minimum} and ${MAX_PARKING}.` };
    }
  }
  if (values.ownerParking + values.companyParking !== values.totalParking) {
    return { ok: false, message: "Owner parking plus Company parking must equal Total parking." };
  }
  return { ok: true, values: {
    totalParking: values.totalParking,
    ownerParking: values.ownerParking,
    companyParking: values.companyParking,
  } };
}

export type ParkingFields = Record<keyof ParkingValues, string>;

export function parkingFields(values: ParkingValues): ParkingFields {
  return { totalParking: String(values.totalParking), ownerParking: String(values.ownerParking), companyParking: String(values.companyParking) };
}

// Keep partially typed input editable. Validation still runs before anything is saved.
export function syncParkingField(current: ParkingFields, field: keyof ParkingValues, value: string): ParkingFields {
  const next = { ...current, [field]: value };
  if (value.trim() === "" || !Number.isFinite(Number(value))) return next;
  const total = Number(next.totalParking);
  if (!next.totalParking.trim() || !Number.isFinite(total) || total < 0) return next;
  if (field === "companyParking") next.ownerParking = String(total - Number(value));
  else if (field === "ownerParking") next.companyParking = String(total - Number(value));
  else {
    const owner = Math.min(total, Math.max(0, Number(current.ownerParking) || 0));
    next.ownerParking = String(owner);
    next.companyParking = String(total - owner);
  }
  return next;
}
