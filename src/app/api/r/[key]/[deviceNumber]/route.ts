import { handleRfidPost } from "@/lib/rfid-http";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ key: string; deviceNumber: string }> }) {
  return handleRfidPost(request, await context.params);
}
