import { handleRfidPost } from "@/lib/rfid-http";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ key: string; deviceNumber: string }> },
) {
  // Some reader firmware sends both heartbeat traffic and card scans to the
  // same configured HTTP URL. handleRfidPost already distinguishes an empty/
  // heartbeat packet from a real RFID packet, so use it here as well.
  return handleRfidPost(request, await context.params);
}
