import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { validateParking } from "@/lib/parking";
import { lockBuildingParking, ParkingError, updateBuildingParking } from "@/lib/building-parking";
import { isPrimarySuperAdmin } from "@/lib/super-admin-scope";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || !["SUPER_ADMIN", "BUILDING_ADMIN"].includes(user.role)) {
      return NextResponse.json({ ok: false, message: "Super Admin or Building Admin access required." }, { status: 403 });
    }

    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, message: "Building settings are required." }, { status: 400 });
    }
    if ("userId" in body) {
      return NextResponse.json({ ok: false, message: "Building User IDs cannot be changed." }, { status: 400 });
    }

    const { id } = await context.params;
    const building = await prisma.building.findUnique({
      where: { id },
      select: { id: true, maximumGate: true, superAdminId: true },
    });
    if (!building) {
      return NextResponse.json({ ok: false, message: "Building not found." }, { status: 404 });
    }

    const allowed = user.role === "BUILDING_ADMIN"
      ? user.buildingId === id
      : isPrimarySuperAdmin(user) || building.superAdminId === user.id;
    if (!allowed) {
      return NextResponse.json({ ok: false, message: "You do not have permission to update this building." }, { status: 403 });
    }

    const bodyRecord = body as Record<string, unknown>;
    const hasCredentialField = "username" in bodyRecord || "password" in bodyRecord;
    if (hasCredentialField) {
      const allowedKeys = new Set(["username", "password"]);
      if (Object.keys(bodyRecord).some((key) => !allowedKeys.has(key))) {
        return NextResponse.json({ ok: false, message: "Send only building username and password when updating login credentials." }, { status: 400 });
      }

      const username = typeof bodyRecord.username === "string" ? bodyRecord.username.trim() : "";
      const password = typeof bodyRecord.password === "string" ? bodyRecord.password : "";
      if (!username || !password.trim()) {
        return NextResponse.json({ ok: false, message: "Building username and password are required." }, { status: 400 });
      }

      const account = await prisma.user.findFirst({
        where: { role: "BUILDING_ADMIN", buildingId: id },
        select: { id: true, userId: true },
      });
      if (!account) {
        return NextResponse.json({ ok: false, message: "Building administrator account not found." }, { status: 404 });
      }

      if (user.role === "BUILDING_ADMIN" && account.id !== user.id) {
        return NextResponse.json({ ok: false, message: "You can update only your own building login credentials." }, { status: 403 });
      }

      const updatedAccount = await prisma.user.update({
        where: { id: account.id },
        data: { username, password },
        select: { userId: true, username: true },
      });

      revalidatePath("/dashboard");
      revalidatePath(`/dashboard/buildings/${id}`);
      return NextResponse.json({ ok: true, message: "Building login credentials updated.", account: updatedAccount });
    }

    if ("enabled" in bodyRecord) {
      if (user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ ok: false, message: "Only a Super Admin can enable or disable buildings." }, { status: 403 });
      }
      if (typeof bodyRecord.enabled !== "boolean" || Object.keys(bodyRecord).some((key) => key !== "enabled")) {
        return NextResponse.json({ ok: false, message: "Send only a boolean enabled setting." }, { status: 400 });
      }
      const enabled = bodyRecord.enabled;
      const updated = await prisma.$transaction(async (tx) => {
        await lockBuildingParking(tx, id);
        return tx.building.update({ where: { id }, data: { enabled }, select: { id: true, enabled: true } });
      }, { maxWait: 10000, timeout: 20000 });
      revalidatePath("/dashboard", "layout");
      revalidatePath("/account");
      revalidatePath("/access-control", "layout");
      return NextResponse.json({ ok: true, message: enabled ? "Building enabled." : "Building disabled. Existing vehicles can still exit.", building: updated });
    }

    const parsed = validateParking(bodyRecord);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, message: parsed.message }, { status: 400 });
    }

    const requestedMaximumGate = Number(bodyRecord.maximumGate);
    const maximumGate = user.role === "SUPER_ADMIN" ? requestedMaximumGate : building.maximumGate;

    if (user.role === "SUPER_ADMIN") {
      if (!Number.isInteger(maximumGate) || maximumGate < 1 || maximumGate > 2147483647) {
        return NextResponse.json({ ok: false, message: "Maximum Gate must be a whole number of at least 1." }, { status: 400 });
      }
    } else if ("maximumGate" in bodyRecord && requestedMaximumGate !== building.maximumGate) {
      return NextResponse.json({ ok: false, message: "Only a Super Admin can change Maximum Gate." }, { status: 403 });
    }

    const updated = await updateBuildingParking(id, parsed.values, maximumGate);
    revalidatePath("/account");
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/buildings/${id}`);
    revalidatePath("/access-control/gate-details");
    return NextResponse.json({ ok: true, message: "Building settings saved.", building: updated });
  } catch (error) {
    if (error instanceof ParkingError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error("UPDATE_BUILDING_PARKING_FAILED");
    return NextResponse.json({ ok: false, message: "Unable to save building settings. Please try again." }, { status: 500 });
  }
}

// Building records are permanent for every application role, including Super Admin.
export async function DELETE() {
  return NextResponse.json({ ok: false, message: "Buildings cannot be deleted. A Super Admin can disable the building instead." }, { status: 405, headers: { Allow: "PATCH" } });
}
