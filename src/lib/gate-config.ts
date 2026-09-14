export type GateDirection = "SELECT" | "ENTRY" | "EXIT" | "ENTRY_EXIT";

const DIRECTIONS = new Set<GateDirection>(["SELECT", "ENTRY", "EXIT", "ENTRY_EXIT"]);
const READER_SEPARATOR = "::READER::";

export function isGateDirection(value: unknown): value is GateDirection {
  return typeof value === "string" && DIRECTIONS.has(value as GateDirection);
}

export function parseGateConfig(value: unknown): { direction: GateDirection; readerId: string | null } {
  const raw = String(value ?? "").trim();
  if (!raw) return { direction: "SELECT", readerId: null };

  const separatorIndex = raw.indexOf(READER_SEPARATOR);
  const directionText = separatorIndex >= 0 ? raw.slice(0, separatorIndex) : raw;
  const readerText = separatorIndex >= 0 ? raw.slice(separatorIndex + READER_SEPARATOR.length).trim() : "";

  return {
    direction: isGateDirection(directionText) ? directionText : "SELECT",
    readerId: readerText || null,
  };
}

export function serializeGateConfig(direction: GateDirection, readerId?: string | null) {
  if (direction === "SELECT" || !readerId) return direction;
  return `${direction}${READER_SEPARATOR}${readerId.trim()}`;
}
