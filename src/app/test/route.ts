import { handleRfidPost } from "@/lib/rfid-http";
export const runtime = "nodejs";
export async function GET() { return Response.json({ ok: true, message: "RFID HTTP receiver is active." }); }
export async function POST(request: Request) { return handleRfidPost(request); }
