import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isPrimarySuperAdmin } from "@/lib/super-admin-scope";

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Sign in required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const start = parseDate(url.searchParams.get("start"));
  const end = parseDate(url.searchParams.get("end"));
  const requestedBuildingId = String(url.searchParams.get("buildingId") || "").trim();
  const requestedCompanyId = String(url.searchParams.get("companyId") || "").trim();

  if (!start || !end || start >= end) {
    return NextResponse.json({ ok: false, message: "A valid local-day range is required." }, { status: 400 });
  }

  let buildingId: string | null = null;
  let companyId: string | null = null;

  if (user.role === "EMPLOYEE" || user.role === "BUILDING_ADMIN") {
    buildingId = user.buildingId;
  } else if (user.role === "COMPANY_ADMIN" || user.role === "BUILDING_OWNER") {
    buildingId = user.buildingId;
    companyId = user.companyId;
  } else if (user.role === "SUPER_ADMIN") {
    if (!requestedBuildingId) {
      return NextResponse.json({ ok: false, message: "Select a building to view realtime monitoring." }, { status: 400 });
    }

    const building = await prisma.building.findUnique({
      where: { id: requestedBuildingId },
      select: { id: true, superAdminId: true },
    });
    if (!building) return NextResponse.json({ ok: false, message: "Building not found." }, { status: 404 });
    if (!isPrimarySuperAdmin(user) && building.superAdminId !== user.id) {
      return NextResponse.json({ ok: false, message: "This building is outside your scope." }, { status: 403 });
    }
    buildingId = building.id;
    companyId = requestedCompanyId || null;
  } else {
    return NextResponse.json({ ok: false, message: "Realtime monitor access is not available for this account." }, { status: 403 });
  }

  if (!buildingId) {
    return NextResponse.json({ ok: false, message: "No building is assigned to this account." }, { status: 403 });
  }

  if (companyId) {
    const company = await prisma.company.findFirst({ where: { id: companyId, buildingId }, select: { id: true } });
    if (!company) return NextResponse.json({ ok: false, message: "Company does not belong to the selected building." }, { status: 400 });
  }

  const companyFilter = companyId ? { companyId } : {};
  const vehicleCompanyFilter = companyId ? { id: companyId } : { buildingId };

  const [building, company, totalIn, totalOut, insideVehicles, ownerVehiclesInside, recentEvents, parkingCompanies] = await Promise.all([
    prisma.building.findUnique({ where: { id: buildingId }, select: { name: true } }),
    companyId ? prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }) : Promise.resolve(null),
    prisma.rfidEvent.count({ where: { buildingId, ...companyFilter, action: "ENTRY", createdAt: { gte: start, lt: end } } }),
    prisma.rfidEvent.count({ where: { buildingId, ...companyFilter, action: "EXIT", createdAt: { gte: start, lt: end } } }),
    prisma.vehicle.findMany({
      where: { isInside: true, company: vehicleCompanyFilter },
      select: { department: true },
    }),
    companyId
      ? Promise.resolve(0)
      : prisma.buildingOwnerVehicle.count({ where: { buildingId, isInside: true } }),
    prisma.rfidEvent.findMany({
      where: { buildingId, ...companyFilter, createdAt: { gte: start, lt: end } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        action: true,
        code: true,
        message: true,
        cardNo: true,
        deviceNumber: true,
        createdAt: true,
        vehicle: { select: { plateNumber: true, ownerName: true, department: true } },
        ownerVehicle: { select: { plateNumber: true, ownerName: true } },
        company: { select: { name: true } },
      },
    }),
    prisma.company.findMany({
      where: companyId ? { id: companyId, buildingId } : { buildingId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        employees: {
          where: { category: "EMPLOYEE" },
          select: { parkingLimit: true },
        },
        vehicles: {
          where: { isInside: true, employee: { category: "EMPLOYEE" } },
          select: { id: true },
        },
      },
    }),
  ]);

  const departmentMap = new Map<string, number>();
  for (const vehicle of insideVehicles) {
    const department = vehicle.department?.trim() || "Unassigned";
    departmentMap.set(department, (departmentMap.get(department) || 0) + 1);
  }

  const departments = Array.from(departmentMap, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const employeeParkingByCompany = parkingCompanies.map((parkingCompany) => ({
    companyId: parkingCompany.id,
    companyName: parkingCompany.name,
    spacesAllotted: parkingCompany.employees.reduce((sum, employee) => sum + employee.parkingLimit, 0),
    vehiclesInside: parkingCompany.vehicles.length,
  }));
  const employeeSpacesAllotted = employeeParkingByCompany.reduce((sum, item) => sum + item.spacesAllotted, 0);
  const employeeVehiclesInside = employeeParkingByCompany.reduce((sum, item) => sum + item.vehiclesInside, 0);

  const normalizedRecentEvents = recentEvents.map(({ ownerVehicle, ...event }) => ({
    ...event,
    vehicle: event.vehicle || (ownerVehicle ? {
      plateNumber: ownerVehicle.plateNumber,
      ownerName: ownerVehicle.ownerName,
      department: "-",
    } : null),
    company: event.company || (ownerVehicle ? { name: "Building owner" } : null),
  }));

  return NextResponse.json({
    ok: true,
    buildingName: building?.name || "Assigned building",
    companyName: company?.name || null,
    totalIn,
    totalOut,
    totalOnSite: insideVehicles.length + ownerVehiclesInside,
    employeeSpacesAllotted,
    employeeVehiclesInside,
    employeeParkingByCompany,
    departments,
    recentEvents: normalizedRecentEvents,
    updatedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
