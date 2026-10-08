import { randomUUID } from "node:crypto";
import { renderVisitorPassPng } from "@/lib/visitor-pass-image";

export type VisitorQrMailInput = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  vehicleNumber: string | null;
  accessory: string;
  validFrom: Date;
  validUntil: Date;
  scopeName: string;
};

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

export async function sendVisitorQrEmail(input: VisitorQrMailInput) {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const emailFrom = process.env.EMAIL_FROM?.trim();
  if (!resendApiKey || !emailFrom) {
    throw new Error("Email is not configured. Add RESEND_API_KEY and EMAIL_FROM in Vercel Environment Variables.");
  }

  const qrToken = randomUUID().replaceAll("-", "");
  const qrPayload = `SRTEC-VISITOR|ID:${input.id}|TOKEN:${qrToken}`;

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
    throw new Error("Unable to generate the visitor QR. Please try again.");
  }

  const qrBytes = Buffer.from(await qrResponse.arrayBuffer());
  const qrDataUrl = `data:image/png;base64,${qrBytes.toString("base64")}`;
  const formattedFrom = formatIndia(input.validFrom);
  const formattedUntil = formatIndia(input.validUntil);

  const passBytes = await renderVisitorPassPng({
    visitorName: input.name,
    scopeName: input.scopeName,
    phoneNumber: input.phoneNumber,
    vehicleNumber: input.vehicleNumber || "Not provided",
    accessory: input.accessory,
    validFrom: formattedFrom,
    validUntil: formattedUntil,
    qrDataUrl,
  });

  const safeName = escapeHtml(input.name);
  const safeScope = escapeHtml(input.scopeName);
  const safePhone = escapeHtml(input.phoneNumber);
  const safeVehicle = escapeHtml(input.vehicleNumber || "Not provided");
  const safeAccessory = escapeHtml(input.accessory);
  const safeValidFrom = escapeHtml(formattedFrom);
  const safeValidUntil = escapeHtml(formattedUntil);

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [input.email],
      subject: `Visitor QR Pass - ${input.name}`,
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
        filename: `visitor-pass-${input.id}.png`,
        content: passBytes.toString("base64"),
      }],
    }),
    signal: AbortSignal.timeout(20000),
  });

  const emailResult = await emailResponse.json().catch(() => ({}));
  if (!emailResponse.ok) {
    const providerMessage = typeof emailResult?.message === "string" ? emailResult.message : "";
    throw new Error(providerMessage || "Unable to send the visitor QR email.");
  }

  return { qrToken };
}
