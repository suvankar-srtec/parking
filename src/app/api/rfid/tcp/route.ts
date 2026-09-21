import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validReaderToken } from "@/lib/rfid-http";

function authorized(request: Request) {
  return validReaderToken(request.headers.get("x-gateway-token"), process.env.RFID_GATEWAY_TOKEN);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 403 });

  const body = await request.json().catch(() => null);
  const { deviceNumber, connectionId, action, readerIp, sourcePort } = body || {};
  if (typeof deviceNumber !== "string" || typeof connectionId !== "string") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!["connect", "alive", "disconnect", "offline"].includes(action)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const reader = await prisma.rfidReader.findUnique({ where: { deviceNumber } });
  if (!reader || reader.connectionType !== "TCP" || reader.readerIp !== readerIp) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  if (action === "connect") {
    await prisma.rfidReader.update({
      where: { id: reader.id },
      data: {
        connectionId,
        sourcePort: Number.isInteger(sourcePort) ? sourcePort : null,
        tcpConnected: true,
        lastGatewaySeenAt: new Date(),
      },
    });
  } else if (action === "offline") {
    await prisma.rfidReader.updateMany({
      where: {
        id: reader.id,
        OR: [
          { tcpConnected: false },
          { lastGatewaySeenAt: { lt: new Date(Date.now() - 45000) } },
          { lastGatewaySeenAt: null },
        ],
      },
      data: { tcpConnected: false, lastGatewaySeenAt: new Date() },
    });
  } else {
    await prisma.rfidReader.updateMany({
      where: { id: reader.id, connectionId, ...(action === "alive" ? { tcpConnected: true } : {}) },
      data: { tcpConnected: action === "alive", lastGatewaySeenAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
