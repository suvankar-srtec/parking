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
  return new Response(readerReply(success, message), { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function handleRfidPost(request: Request, path?: { key: string; deviceNumber: string }) {
  const token = path?.key || request.headers.get("x-reader-token") || new URL(request.url).searchParams.get("token");
  if (!validReaderToken(token)) return reply(false, "Reader is not authorized");
  let parsed;
  try { parsed = parseRfidReaderMessage(await readReaderBody(request), request.headers.get("content-type")?.includes("application/x-www-form-urlencoded")); }
  catch { return reply(false, "Invalid reader packet"); }
  if (!parsed || (path && parsed.deviceNumber !== path.deviceNumber)) return reply(false, "Invalid reader packet");
  try {
    const result = await processReaderScan(parsed);
    return reply(result.code === "0000", result.message);
  } catch { console.error("RFID_SCAN_FAILED"); return reply(false, "Parking server unavailable"); }
}

export async function handleRfidHeartbeat(_request: Request, path: { key: string; deviceNumber: string }) {
  if (!validReaderToken(path.key)) return reply(false, "Reader is not authorized");
  try {
    const result = await prisma.rfidReader.updateMany({
      where: { deviceNumber: path.deviceNumber },
      data: { lastSeenAt: new Date(), connectionType: "HTTP", tcpConnected: false },
    });
    // Heartbeats never trigger the hardware SuccessAction.
    return reply(false, result.count ? "Heartbeat received" : "Reader is not registered");
  } catch { return reply(false, "Parking server unavailable"); }
}
