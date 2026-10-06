import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function PATCH(
  request: Request,
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
      return NextResponse.json({ ok: false, message: "Visitor editing is available only to Admin and Company accounts." }, { status: 403 });
    }

    const { id } = await context.params;
    const visitor = await prisma.visitor.findUnique({
      where: { id },
      select: { id: true, buildingId: true, companyId: true },
    });
    if (!visitor) {
      return NextResponse.json({ ok: false, message: "Visitor not found." }, { status: 404 });
    }

    const allowed = isBuildingAdmin
      ? visitor.buildingId === user.buildingId && visitor.companyId === null
      : visitor.companyId === user.companyId;

    if (!allowed) {
      return NextResponse.json({ ok: false, message: "You do not have access to edit this visitor." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase().slice(0, 180);
    if (!email || !validEmail(email)) {
      return NextResponse.json({ ok: false, message: "Enter a valid Mail address." }, { status: 400 });
    }

    const updated = await prisma.visitor.update({
      where: { id },
      data: { email },
      select: { id: true, email: true },
    });

    revalidatePath("/visitor-form");
    return NextResponse.json({
      ok: true,
      message: "Visitor email updated successfully.",
      visitor: updated,
    });
  } catch (error) {
    console.error("UPDATE_VISITOR_EMAIL_FAILED", error);
    return NextResponse.json({ ok: false, message: "Unable to update the visitor email. Please try again." }, { status: 500 });
  }
}
