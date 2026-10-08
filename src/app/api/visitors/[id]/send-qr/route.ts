import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { renderVisitorPassPng } from "@/lib/visitor-pass";

function formatIndia(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: "Sign in required." }, { status: 403 });
    }

    const isBuildingAdmin = user.role === "BUILDING_ADMIN";
    const isCompanyUser = user.role === "COMPANY_ADMIN" || user.role === "BUILDING_OWNER";
    if (!isBuildingAdmin && !isCompanyUser) {
      return NextResponse.json({ ok: false, message: "Visitor QR sending is available only to Admin and Company accounts." }, { status: 403 });
    }

    const { id } = await context.params;
    const visitor = await prisma.visitor.findUnique({
      where: { id },
      include: {
        building: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
      },
    });

    if (!visitor) {
      return NextResponse.json({ ok: false, message: "Visitor not found." }, { status: 404 });
    }

    const allowed = isBuildingAdmin
      ? visitor.buildingId === user.buildingId && visitor.companyId === null
      : visitor.companyId === user.companyId;

    if (!allowed) {
      return NextResponse.json({ ok: false, message: "You do not have access to this visitor." }, { status: 403 });
    }

    if (visitor.validUntil <= new Date()) {
      return NextResponse.json({ ok: false, message: "This visitor QR validity has expired. Create a new visitor pass with a new time window." }, { status: 409 });
    }

    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    const emailFrom = process.env.EMAIL_FROM?.trim();
    if (!resendApiKey || !emailFrom) {
      return NextResponse.json({
        ok: false,
        message: "Email is not configured. Add RESEND_API_KEY and EMAIL_FROM in Vercel Environment Variables.",
      }, { status: 503 });
    }

    const nextQrToken = randomUUID().replaceAll("-", "");
    const qrPayload = `SRTEC-VISITOR|ID:${visitor.id}|TOKEN:${nextQrToken}`;

    const qrResponse = await fetch("https://quickchart.io/qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: qrPayload,
        size: 500,
        format: "png",
        margin: 2,
        ecLevel: "M",
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!qrResponse.ok) {
      console.error("VISITOR_QR_GENERATION_FAILED", qrResponse.status);
      return NextResponse.json({ ok: false, message: "Unable to generate the visitor QR. Please try again." }, { status: 502 });
    }

    const qrBytes = Buffer.from(await qrResponse.arrayBuffer());
    const qrDataUrl = `data:image/png;base64,${qrBytes.toString("base64")}`;
    const scopeName = visitor.company?.name || visitor.building.name;
    const safeName = escapeHtml(visitor.name);
    const safeScope = escapeHtml(scopeName);
    const safePhone = escapeHtml(visitor.phoneNumber);
    const safeVehicle = escapeHtml(visitor.vehicleNumber || "Not provided");
    const safeAccessory = escapeHtml(visitor.accessory);
    const safeValidFrom = escapeHtml(formatIndia(visitor.validFrom));
    const safeValidUntil = escapeHtml(formatIndia(visitor.validUntil));

    const passBytes = await renderVisitorPassPng({
      visitorName: visitor.name,
      scopeName,
      phoneNumber: visitor.phoneNumber,
      vehicleNumber: visitor.vehicleNumber || "Not provided",
      accessory: visitor.accessory,
      validFrom: formatIndia(visitor.validFrom),
      validUntil: formatIndia(visitor.validUntil),
      qrDataUrl,
    });
    const passBase64 = passBytes.toString("base64");

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [visitor.email],
        subject: `Visitor QR Pass - ${visitor.name}`,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;color:#17221c;line-height:1.5">
            <h2 style="margin:0 0 8px">SRTEC Access Control</h2>
            <p style="margin:0 0 18px">Visitor QR Pass</p>
            <p>Hello <strong>${safeName}</strong>,</p>
            <p>Your complete visitor pass for <strong>${safeScope}</strong> is attached to this email.</p>
            <table style="border-collapse:collapse;margin:16px 0;font-size:14px">
              <tr><td style="padding:5px 14px 5px 0"><strong>Phone</strong></td><td>${safePhone}</td></tr>
              <tr><td style="padding:5px 14px 5px 0"><strong>Vehicle</strong></td><td>${safeVehicle}</td></tr>
              <tr><td style="padding:5px 14px 5px 0"><strong>Accessory</strong></td><td>${safeAccessory}</td></tr>
              <tr><td style="padding:5px 14px 5px 0"><strong>Valid From</strong></td><td>${safeValidFrom}</td></tr>
              <tr><td style="padding:5px 14px 5px 0"><strong>Valid Until</strong></td><td>${safeValidUntil}</td></tr>
            </table>
            <p>This QR allows one entry only. After that entry, it can be used only for the corresponding exit. It cannot be used for another entry.</p>
          </div>
        `,
        attachments: [{
          filename: `visitor-pass-${visitor.id}.png`,
          content: passBase64,
        }],
      }),
      signal: AbortSignal.timeout(20000),
    });

    const emailResult = await emailResponse.json().catch(() => ({}));
    if (!emailResponse.ok) {
      console.error("VISITOR_EMAIL_SEND_FAILED", emailResponse.status, emailResult);
      const providerMessage = typeof emailResult?.message === "string" ? emailResult.message : "";
      return NextResponse.json({
        ok: false,
        message: providerMessage || "Unable to send the visitor QR email. Please check the email configuration and try again.",
      }, { status: 502 });
    }

    await prisma.visitor.update({
      where: { id: visitor.id },
      data: { qrToken: nextQrToken, qrEntryUsed: false },
    });

    return NextResponse.json({
      ok: true,
      message: `New visitor QR sent successfully to ${visitor.email}. Previous QR is now disabled.`,
    });
  } catch (error) {
    console.error("SEND_VISITOR_QR_FAILED", error);
    return NextResponse.json({ ok: false, message: "Unable to send the visitor QR. Please try again." }, { status: 500 });
  }
}
