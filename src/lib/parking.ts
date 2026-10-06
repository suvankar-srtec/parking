export type ParkingValues = {
  totalParking: number;
  ownerParking: number;
  visitorParking: number;
  companyParking: number;
};

export const MAX_PARKING = 2147483647;

export function validateParking(input: unknown):
  | { ok: true; values: ParkingValues }
  | { ok: false; message: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, message: "Enter all parking values." };
  }

  const source = input as Partial<ParkingValues>;
  const values: ParkingValues = {
    totalParking: source.totalParking as number,
    ownerParking: source.ownerParking as number,
    visitorParking: source.visitorParking === undefined ? 0 : source.visitorParking,
    companyParking: source.companyParking as number,
  };

  for (const [field, label] of [
    ["totalParking", "Total parking"],
    ["ownerParking", "Owner parking"],
    ["visitorParking", "Visitor parking"],
    ["companyParking", "Company parking"],
  ] as const) {
    const value = values[field];
    const minimum = field === "totalParking" ? 1 : 0;
    if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > MAX_PARKING) {
      return { ok: false, message: `${label} must be a whole number between ${minimum} and ${MAX_PARKING}.` };
    }
  }

  if (values.ownerParking + values.visitorParking + values.companyParking !== values.totalParking) {
    return { ok: false, message: "Owner parking plus Visitor parking plus Company parking must equal Total parking." };
  }

  return { ok: true, values };
}

export type ParkingFields = Record<keyof ParkingValues, string>;

export function parkingFields(values: ParkingValues): ParkingFields {
  return {
    totalParking: String(values.totalParking),
    ownerParking: String(values.ownerParking),
    visitorParking: String(values.visitorParking),
    companyParking: String(values.companyParking),
  };
}

// Visitor parking is carved specifically out of Owner parking.
// Company parking stays unchanged when Visitor parking changes.
export function syncParkingField(current: ParkingFields, field: keyof ParkingValues, value: string): ParkingFields {
  const next = { ...current, [field]: value };
  if (value.trim() === "" || !Number.isFinite(Number(value))) return next;

  const total = Number(next.totalParking);
  if (!next.totalParking.trim() || !Number.isFinite(total) || total < 0) return next;

  const visitor = Number(next.visitorParking);
  if (field === "visitorParking") {
    next.ownerParking = String(total - Number(next.companyParking) - Number(value));
  } else if (field === "companyParking") {
    next.ownerParking = String(total - visitor - Number(value));
  } else if (field === "ownerParking") {
    next.companyParking = String(total - visitor - Number(value));
  } else {
    const keptVisitor = Math.min(total, Math.max(0, Number(current.visitorParking) || 0));
    const ownerRoom = Math.max(total - keptVisitor, 0);
    const keptOwner = Math.min(ownerRoom, Math.max(0, Number(current.ownerParking) || 0));
    next.visitorParking = String(keptVisitor);
    next.ownerParking = String(keptOwner);
    next.companyParking = String(total - keptVisitor - keptOwner);
  }
  return next;
}
