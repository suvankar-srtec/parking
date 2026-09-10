import { timingSafeEqual } from "node:crypto";
import { parseRfidReaderMessage, readReaderBody } from "@/lib/rfid-reader";
import { processReaderScan } from "@/lib/rfid-access";
import { prisma } from "@/lib/prisma";

function reply(code: string) {
  return new Response("code=" + code, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
function validToken(value: string | null) {
  const expected = process.env.RFID_HTTP_TOKEN;
  if (!expected) return value === null;
  const a = Buffer.from(value || "");
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function handleRfidPost(request: Request, path?: { key: string; deviceNumber: string }) {
  const suppliedToken = path?.key || request.headers.get("x-reader-token") || new URL(request.url).searchParams.get("token");
  if (!validToken(suppliedToken)) return reply("1004");
  let parsed;
  try {
    parsed = parseRfidReaderMessage(await readReaderBody(request), request.headers.get("content-type")?.includes("application/x-www-form-urlencoded"));
  } catch { return reply("1002"); }
  if (!parsed || (path && path.deviceNumber !== parsed.deviceNumber)) return reply("1002");
  try { return reply(await processReaderScan(parsed)); }
  catch { console.error("RFID_SCAN_FAILED"); return reply("1003"); }
}

export async function handleRfidHeartbeat(request: Request, path: { key: string; deviceNumber: string }) {
  if (!validToken(path.key) || !/^[a-zA-Z0-9_-]{1,64}$/.test(path.deviceNumber)) return reply("1004");
  try {
    await prisma.rfidReader.upsert({
      where: { deviceNumber: path.deviceNumber },
      create: { deviceNumber: path.deviceNumber, name: "Reader " + path.deviceNumber, lastSeenAt: new Date() },
      update: { lastSeenAt: new Date() },
    });
    return reply("0000");
  } catch { return reply("1003"); }
}
