import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    if (!user || user.role !== "BUILDING_ADMIN" || !user.buildingId) {
      return NextResponse.json({ ok: false, message: "Only the Building Admin can change company status." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (typeof body?.enabled !== "boolean") {
      return NextResponse.json({ ok: false, message: "Choose Enable or Disable." }, { status: 400 });
    }

    const company = await prisma.company.findFirst({
      where: { id, buildingId: user.buildingId },
      select: { id: true, name: true },
    });
    if (!company) {
      return NextResponse.json({ ok: false, message: "Company not found in your building." }, { status: 404 });
    }

    await prisma.company.update({
      where: { id },
      data: { enabled: body.enabled },
    });

    revalidatePath("/dashboard");
    revalidatePath("/access-control/register-cards", "layout");
    return NextResponse.json({
      ok: true,
      message: `${company.name} has been ${body.enabled ? "enabled" : "disabled"}.`,
    });
  } catch (error) {
    console.error("UPDATE_COMPANY_STATUS_FAILED", error);
    return NextResponse.json({ ok: false, message: "Unable to update company status." }, { status: 500 });
  }
}
