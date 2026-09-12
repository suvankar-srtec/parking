import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rfidUser } from "@/lib/rfid-access";
import { ParkingError } from "@/lib/building-parking";
import { isPrimarySuperAdmin } from "@/lib/super-admin-scope";

function decodeDataUrl(value: string) {
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([a-zA-Z0-9+/=\r\n]+)$/.exec(value.trim());
  if (!match) throw new ParkingError("Stored QR image is invalid.", 500);
  const subtype = match[1] === "jpg" ? "jpeg" : match[1];
  return { contentType: `image/${subtype}`, body: Buffer.from(match[2], "base64") };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ deviceNumber: string }> },
) {
  try {
    const user = await rfidUser();
    const { deviceNumber } = await context.params;
    const kind = new URL(request.url).searchParams.get("kind") === "registration" ? "registration" : "entryExit";

    const reader = await prisma.rfidReader.findUnique({
      where: { deviceNumber },
      include: { building: { select: { superAdminId: true } } },
    });
    if (!reader) throw new ParkingError("Reader not found.", 404);

    const primarySuperAdmin = user.role === "SUPER_ADMIN" && isPrimarySuperAdmin(user);
    const allowed = primarySuperAdmin ||
      (user.role === "SUPER_ADMIN" && reader.building?.superAdminId === user.id) ||
      (user.role !== "SUPER_ADMIN" && Boolean(user.buildingId) && reader.buildingId === user.buildingId);
    if (!allowed) throw new ParkingError("You do not have access to this reader.", 403);

    const data = kind === "registration" ? reader.registrationQrData : reader.entryExitQrData;
    if (!data) throw new ParkingError(`${kind === "registration" ? "Registration" : "Entry / Exit"} QR has not been uploaded.`, 404);

    const decoded = decodeDataUrl(data);
    return new NextResponse(decoded.body, {
      status: 200,
      headers: {
        "Content-Type": decoded.contentType,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const status = error instanceof ParkingError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unable to load reader QR.";
    return NextResponse.json({ ok: false, message }, { status });
  }
}
