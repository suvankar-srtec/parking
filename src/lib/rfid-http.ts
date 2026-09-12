import { timingSafeEqual } from "node:crypto";
import { parseRfidReaderMessage, readReaderBody, readerReply } from "@/lib/rfid-reader";
import { processReaderScan } from "@/lib/rfid-access";
import { prisma } from "@/lib/prisma";

export function validReaderToken(value: string | null, secret = process.env.RFID_HTTP_TOKEN) {
  const received = String(value || "").trim();
  const configured = String(secret || "").trim();
  if (!configured || !received) return false;
  const a = Buffer.from(received), b = Buffer.from(configured);
  return a.length === b.length && timingSafeEqual(a, b);
}

function reply(success: boolean, message: string) {
  return new Response(readerReply(success, message), {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function markHttpContact(deviceNumber: string) {
  return prisma.rfidReader.updateMany({
    where: { deviceNumber },
    data: { lastSeenAt: new Date(), connectionType: "HTTP", tcpConnected: false },
  });
}

function isHeartbeatBody(raw: string) {
  const value = raw.trim().toLowerCase();
  return value === "" || value === "heartbeat" || value === "heart" || value === "keepalive" || value === "ping";
}

function cleanCard(value: unknown) {
  const card = String(value ?? "").trim();
  return /^[a-zA-Z0-9_-]{1,128}$/.test(card) ? card : "";
}

function parsePathBoundReaderMessage(raw: string, deviceNumber: string, formEncoded: boolean) {
  const normal = parseRfidReaderMessage(raw, formEncoded);
  if (normal) return normal.deviceNumber === deviceNumber ? normal : null;

  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 4096) return null;

  // Some HTTP/HTTPS firmware variants omit devicenumber from the body because
  // it is already part of the configured URL. In that case the authenticated
  // path device number is authoritative.
  try {
    const params = new URLSearchParams(trimmed.replace(/&&/g, "&"));
    const paramCard = cleanCard(
      params.get("vgdecoderresult") ||
      params.get("vgdecoderesult") ||
      params.get("card") ||
      params.get("cardno") ||
      params.get("uid"),
    );
    if (paramCard) return { decodedResult: paramCard, deviceNumber };
  } catch {
    // Continue through the firmware-specific fallbacks below.
  }

  try {
    const json = JSON.parse(trimmed) as Record<string, unknown>;
    const jsonCard = cleanCard(
      json.vgdecoderresult ?? json.vgdecoderesult ?? json.card ?? json.cardNo ?? json.uid,
    );
    const bodyDevice = cleanCard(json.devicenumber ?? json.deviceNumber);
    if (jsonCard && (!bodyDevice || bodyDevice === deviceNumber)) {
      return { decodedResult: jsonCard, deviceNumber };
    }
  } catch {
    // Not JSON.
  }

  // Accept compact firmware packets such as:
  // vgdecoderesultD9E07D0E, vgdecoderesult=D9E07D0E, or a bare UID.
  const compact = /vgdecoder(?:r?esult|result)\s*=?\s*([a-zA-Z0-9_-]{1,128})/i.exec(trimmed);
  if (compact) {
    const card = cleanCard(compact[1]);
    if (card) return { decodedResult: card, deviceNumber };
  }

  const bareCard = cleanCard(trimmed);
  if (bareCard && !/^(heartbeat|heart|keepalive|ping)$/i.test(bareCard)) {
    return { decodedResult: bareCard, deviceNumber };
  }

  return null;
}

export async function handleRfidPost(request: Request, path?: { key: string; deviceNumber: string }) {
  const token = path?.key || request.headers.get("x-reader-token") || new URL(request.url).searchParams.get("token");
  if (!validReaderToken(token)) return reply(false, "Reader is not authorized");

  let raw: string;
  try {
    raw = await readReaderBody(request);
  } catch {
    return reply(false, "Invalid reader packet");
  }

  if (path?.deviceNumber) {
    try {
      const contact = await markHttpContact(path.deviceNumber);
      if (isHeartbeatBody(raw)) {
        return reply(false, contact.count ? "Heartbeat received" : "Reader is not registered");
      }
    } catch {
      return reply(false, "Parking server unavailable");
    }
  }

  let parsed;
  try {
    const formEncoded = Boolean(request.headers.get("content-type")?.includes("application/x-www-form-urlencoded"));
    parsed = path?.deviceNumber
      ? parsePathBoundReaderMessage(raw, path.deviceNumber, formEncoded)
      : parseRfidReaderMessage(raw, formEncoded);
  } catch {
    return reply(false, "Invalid reader packet");
  }

  if (!parsed) {
    console.warn("RFID_HTTP_INVALID_PACKET", {
      deviceNumber: path?.deviceNumber || null,
      contentType: request.headers.get("content-type") || null,
      bodyLength: raw.length,
      bodyPreview: raw.slice(0, 180).replace(/[\r\n\u0000-\u001f]/g, " "),
    });
    return reply(false, "Invalid reader packet");
  }

  try {
    const result = await processReaderScan(parsed);
    return reply(result.code === "0000", result.message);
  } catch {
    console.error("RFID_SCAN_FAILED", { deviceNumber: parsed.deviceNumber });
    return reply(false, "Parking server unavailable");
  }
}

export async function handleRfidHeartbeat(_request: Request, path: { key: string; deviceNumber: string }) {
  if (!validReaderToken(path.key)) return reply(false, "Reader is not authorized");
  try {
    const result = await markHttpContact(path.deviceNumber);
    return reply(false, result.count ? "Heartbeat received" : "Reader is not registered");
  } catch {
    return reply(false, "Parking server unavailable");
  }
}
