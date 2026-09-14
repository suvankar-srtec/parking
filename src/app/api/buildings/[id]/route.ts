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
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, message: "Building settings are required." }, { status: 400 });
    }
    if ("userId" in body) {
      return NextResponse.json({ ok: false, message: "Building User IDs cannot be changed." }, { status: 400 });
    }

    const parsed = validateParking(body);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, message: parsed.message }, { status: 400 });
    }

    const maximumGate = Number((body as Record<string, unknown>).maximumGate);
    if (!Number.isInteger(maximumGate) || maximumGate < 1 || maximumGate > 2147483647) {
      return NextResponse.json({ ok: false, message: "Maximum Gate must be a whole number of at least 1." }, { status: 400 });
    }

    const { id } = await context.params;
    const building = await updateBuildingParking(id, parsed.values, maximumGate);
    revalidatePath("/account");
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/buildings/${id}`);
    return NextResponse.json({ ok: true, message: "Building settings saved.", building });
  } catch (error) {
    if (error instanceof ParkingError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error("UPDATE_BUILDING_PARKING_FAILED");
    return NextResponse.json({ ok: false, message: "Unable to save building settings. Please try again." }, { status: 500 });
  }
}
