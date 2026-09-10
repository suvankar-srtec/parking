import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/session";
import { validateParking } from "@/lib/parking";
import { ParkingError, updateBuildingParking } from "@/lib/building-parking";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireSuperAdmin())) {
      return NextResponse.json({ ok: false, message: "Super Admin access required." }, { status: 403 });
    }
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
    if (body && typeof body === "object" && "userId" in body) {
      return NextResponse.json({ ok: false, message: "Building User IDs cannot be changed." }, { status: 400 });
    }
    const parsed = validateParking(body);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, message: parsed.message }, { status: 400 });
    }
    const { id } = await context.params;
    const building = await updateBuildingParking(id, parsed.values);
    revalidatePath("/account");
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/buildings/${id}`);
    return NextResponse.json({ ok: true, message: "Parking values saved.", building });
  } catch (error) {
    if (error instanceof ParkingError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error("UPDATE_BUILDING_PARKING_FAILED");
    return NextResponse.json({ ok: false, message: "Unable to save parking values. Please try again." }, { status: 500 });
  }
}
