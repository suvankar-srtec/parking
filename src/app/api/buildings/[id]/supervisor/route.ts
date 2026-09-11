import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: buildingId } = await context.params;
    const user = await getCurrentUser();
    if (!user || !["SUPER_ADMIN", "BUILDING_ADMIN"].includes(user.role)) {
      return NextResponse.json({ ok: false, message: "Only Super Admin or Admin can manage a supervisor." }, { status: 403 });
    }
    if (user.role === "BUILDING_ADMIN" && user.buildingId !== buildingId) {
      return NextResponse.json({ ok: false, message: "You can only manage your own building supervisor." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const userId = String(body?.userId ?? "").trim();
    const password = String(body?.password ?? "");
    if (!userId || !password.trim()) {
      return NextResponse.json({ ok: false, message: "Supervisor User ID and password are required." }, { status: 400 });
    }

    const building = await prisma.building.findUnique({ where: { id: buildingId }, select: { id: true, name: true } });
    if (!building) return NextResponse.json({ ok: false, message: "Building not found." }, { status: 404 });

    const current = await prisma.user.findFirst({ where: { role: "EMPLOYEE", buildingId, companyId: null }, orderBy: { createdAt: "asc" } });
    const conflict = await prisma.user.findUnique({ where: { userId }, select: { id: true } });
    if (conflict && conflict.id !== current?.id) {
      return NextResponse.json({ ok: false, message: "This User ID is already in use." }, { status: 409 });
    }

    const supervisor = current
      ? await prisma.user.update({
          where: { id: current.id },
          data: { userId, username: userId, password, role: "EMPLOYEE", buildingId, companyId: null },
          select: { id: true, userId: true, username: true },
        })
      : await prisma.user.create({
          data: { userId, username: userId, password, role: "EMPLOYEE", buildingId },
          select: { id: true, userId: true, username: true },
        });

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/buildings/${buildingId}`);
    return NextResponse.json({ ok: true, message: `Supervisor account saved for ${building.name}.`, supervisor });
  } catch (error) {
    console.error("SAVE_SUPERVISOR_FAILED", error);
    return NextResponse.json({ ok: false, message: "Unable to save supervisor account." }, { status: 500 });
  }
}
