export type ParsedRfidReaderMessage = { decodedResult: string; deviceNumber: string };
export const READER_MODES = ["REGISTER", "ENTRY_EXIT", "ENTRY", "EXIT"] as const;
export const SCAN_DEBOUNCE_MS = 3000;

export function normalizeCard(value: string) { return value.trim().toUpperCase(); }

export function parseRfidReaderMessage(raw: string, formEncoded = false): ParsedRfidReaderMessage | null {
  if (!raw || raw.length > 4096) return null;
  const fields = new Map<string, string>();
  try {
    for (const part of raw.trim().split(/&+/)) {
      if (!part.trim()) continue;
      const equals = part.indexOf("=");
      if (equals < 0) return null;
      const key = part.slice(0, equals).trim().toLowerCase();
      if (key !== "vgdecoderresult" && key !== "devicenumber") continue;
      if (fields.has(key)) return null;
      let value = part.slice(equals + 1).trim();
      if (formEncoded) value = value.replace(/\+/g, " ");
      value = decodeURIComponent(value).trim();
      if (!value || /[\u0000-\u001f\u007f]/.test(value)) return null;
      fields.set(key, value);
    }
  } catch { return null; }
  const decodedResult = fields.get("vgdecoderresult");
  const deviceNumber = fields.get("devicenumber");
  if (!decodedResult || decodedResult.length > 128 || !deviceNumber || !/^[a-zA-Z0-9_-]{1,64}$/.test(deviceNumber)) return null;
  return { decodedResult, deviceNumber };
}

export async function readReaderBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  let size = 0;
  let body = "";
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new Error("Payload too large"); }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally { reader.releaseLock(); }
}
