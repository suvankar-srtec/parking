import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "EMPLOYEE") {
    return NextResponse.json({ ok: false, message: "Supervisor access required." }, { status: 403 });
  }
  if (!user.buildingId) {
    return NextResponse.json({ ok: false, message: "No building is assigned to this Supervisor." }, { status: 403 });
  }

  const url = new URL(request.url);
  const start = parseDate(url.searchParams.get("start"));
  const end = parseDate(url.searchParams.get("end"));
  if (!start || !end || start >= end) {
    return NextResponse.json({ ok: false, message: "A valid local-day range is required." }, { status: 400 });
  }

  const [building, totalIn, totalOut, insideVehicles] = await Promise.all([
    prisma.building.findUnique({ where: { id: user.buildingId }, select: { name: true } }),
    prisma.rfidEvent.count({ where: { buildingId: user.buildingId, action: "ENTRY", createdAt: { gte: start, lt: end } } }),
    prisma.rfidEvent.count({ where: { buildingId: user.buildingId, action: "EXIT", createdAt: { gte: start, lt: end } } }),
    prisma.vehicle.findMany({
      where: { isInside: true, company: { buildingId: user.buildingId } },
      select: { department: true },
    }),
  ]);

  const departmentMap = new Map<string, number>();
  for (const vehicle of insideVehicles) {
    const department = vehicle.department?.trim() || "Unassigned";
    departmentMap.set(department, (departmentMap.get(department) || 0) + 1);
  }

  const departments = Array.from(departmentMap, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return NextResponse.json({
    ok: true,
    buildingName: building?.name || "Assigned building",
    totalIn,
    totalOut,
    totalOnSite: insideVehicles.length,
    departments,
    updatedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
