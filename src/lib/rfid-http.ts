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

export async function handleRfidPost(request: Request, path?: { key: string; deviceNumber: string }) {
  const token = path?.key || request.headers.get("x-reader-token") || new URL(request.url).searchParams.get("token");
  if (!validReaderToken(token)) return reply(false, "Reader is not authorized");

  let raw: string;
  try {
    raw = await readReaderBody(request);
  } catch {
    return reply(false, "Invalid reader packet");
  }

  // A valid HTTPS request proves that the hardware is reachable even before a card packet is parsed.
  // The reader's HeartSet can therefore use the same HttpPara URL with an empty/heartbeat body.
  if (path?.deviceNumber) {
    try {
      const contact = await markHttpContact(path.deviceNumber);
      if (isHeartbeatBody(raw)) {
        // Return a failure code intentionally so heartbeat traffic never triggers SuccessAction/relay/LED.
        return reply(false, contact.count ? "Heartbeat received" : "Reader is not registered");
      }
    } catch {
      return reply(false, "Parking server unavailable");
    }
  }

  let parsed;
  try {
    parsed = parseRfidReaderMessage(raw, request.headers.get("content-type")?.includes("application/x-www-form-urlencoded"));
  } catch {
    return reply(false, "Invalid reader packet");
  }
  if (!parsed || (path && parsed.deviceNumber !== path.deviceNumber)) return reply(false, "Invalid reader packet");

  try {
    const result = await processReaderScan(parsed);
    return reply(result.code === "0000", result.message);
  } catch {
    console.error("RFID_SCAN_FAILED");
    return reply(false, "Parking server unavailable");
  }
}

export async function handleRfidHeartbeat(_request: Request, path: { key: string; deviceNumber: string }) {
  if (!validReaderToken(path.key)) return reply(false, "Reader is not authorized");
  try {
    const result = await markHttpContact(path.deviceNumber);
    // Heartbeats never trigger the hardware SuccessAction.
    return reply(false, result.count ? "Heartbeat received" : "Reader is not registered");
  } catch {
    return reply(false, "Parking server unavailable");
  }
}
