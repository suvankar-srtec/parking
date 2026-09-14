import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { validateParking } from "@/lib/parking";
import { ParkingError, updateBuildingParking } from "@/lib/building-parking";
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

    const parsed = validateParking(body);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, message: parsed.message }, { status: 400 });
    }

    const requestedMaximumGate = Number((body as Record<string, unknown>).maximumGate);
    const maximumGate = user.role === "SUPER_ADMIN" ? requestedMaximumGate : building.maximumGate;

    if (user.role === "SUPER_ADMIN") {
      if (!Number.isInteger(maximumGate) || maximumGate < 1 || maximumGate > 2147483647) {
        return NextResponse.json({ ok: false, message: "Maximum Gate must be a whole number of at least 1." }, { status: 400 });
      }
    } else if ("maximumGate" in body && requestedMaximumGate !== building.maximumGate) {
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
