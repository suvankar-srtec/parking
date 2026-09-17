import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { lockBuildingParking, ParkingError } from "@/lib/building-parking";
import { CompanyRosterError, syncCompanyRoster } from "@/lib/company-roster";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    if (!user || user.role !== "BUILDING_ADMIN" || !user.buildingId || !hasPermission(user, "building.allocateCompanyParking")) {
      return NextResponse.json({ ok: false, message: "Only the assigned Building Admin can edit company capacity." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const totalPersons = Number(body?.totalPersons);
    const parkingAllocation = Number(body?.parkingAllocation);
    if (!Number.isInteger(totalPersons) || totalPersons < 1) return NextResponse.json({ ok: false, message: "Total Persons must be at least 1." }, { status: 400 });
    if (!Number.isInteger(parkingAllocation) || parkingAllocation < 0 || parkingAllocation > totalPersons) return NextResponse.json({ ok: false, message: "Company parking must be between 0 and Total Persons." }, { status: 400 });

    const updated = await prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { id },
        select: {
          id: true,
          buildingId: true,
          parkingAllocation: true,
          ownerParkingAllocation: true,
          employeeParkingAllocation: true,
          employees: { select: { id: true, isPlaceholder: true } },
          users: { where: { role: "COMPANY_ADMIN" }, select: { userId: true }, take: 1 },
        },
      });
      if (!company || company.buildingId !== user.buildingId) throw new ParkingError("Company not found in your building.", 404);

      const namedPeople = company.employees.filter((person) => !person.isPlaceholder).length;
      if (totalPersons < namedPeople) throw new ParkingError(`${namedPeople} named employees already exist. Total Persons cannot be lower than ${namedPeople}.`);
      const splitAssigned = company.ownerParkingAllocation + company.employeeParkingAllocation;
      if (parkingAllocation < splitAssigned) throw new ParkingError(`${splitAssigned} parking spaces are already divided between Company Owners and Employees. Company parking cannot be lower than ${splitAssigned}.`);

      const building = await lockBuildingParking(tx, company.buildingId);
      const others = await tx.company.aggregate({ where: { buildingId: company.buildingId, NOT: { id } }, _sum: { parkingAllocation: true } });
      const availableForThisCompany = building.companyParking - (others._sum.parkingAllocation ?? 0);
      if (parkingAllocation > availableForThisCompany) throw new ParkingError(`Only ${availableForThisCompany} parking spaces are available for this company.`);

      const companyUserId = company.users[0]?.userId;
      if (!companyUserId) throw new ParkingError("Company/User account not found.", 404);

      const result = await tx.company.update({
        where: { id },
        data: { totalPersons, parkingAllocation },
        select: { id: true, totalPersons: true, parkingAllocation: true, ownerParkingAllocation: true, employeeParkingAllocation: true },
      });
      await syncCompanyRoster(tx, id, companyUserId, totalPersons);
      return result;
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/company-parking");
    return NextResponse.json({ ok: true, message: `Company capacity updated. Employee roster now contains ${updated.totalPersons} slots.`, company: updated });
  } catch (error) {
    if (error instanceof ParkingError || error instanceof CompanyRosterError) return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    console.error("UPDATE_COMPANY_ADMIN_SETTINGS_FAILED", error);
    return NextResponse.json({ ok: false, message: "Unable to update company capacity." }, { status: 500 });
  }
}
