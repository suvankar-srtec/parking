import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";

class EmployeeUpdateError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function canEditEmployee(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  employee: { companyId: string; company: { buildingId: string; building: { superAdminId: string | null } } },
) {
  if (!user) return false;
  if (user.role === "COMPANY_ADMIN" || user.role === "BUILDING_OWNER") return user.companyId === employee.companyId && hasPermission(user, "company.managePeople");
  if (user.role === "BUILDING_ADMIN") return user.buildingId === employee.company.buildingId;
  if (user.role === "SUPER_ADMIN") return !user.createdBySuperAdminId || employee.company.building.superAdminId === user.id;
  return false;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; employeeId: string }> },
) {
  try {
    const { id: companyId, employeeId } = await context.params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, message: "Sign in to edit this person." }, { status: 401 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

    const name = String(body?.name ?? "").trim();
    const category = String(body?.category ?? "EMPLOYEE").toUpperCase();
    const parkingLimit = Number(body?.parkingLimit);
    const department = String(body?.department ?? "").trim();
    if (!name) return NextResponse.json({ ok: false, message: "Enter the employee or company owner name." }, { status: 400 });
    if (!["EMPLOYEE", "OWNER"].includes(category)) return NextResponse.json({ ok: false, message: "Choose Employee or Company Owner." }, { status: 400 });
    if (!department) return NextResponse.json({ ok: false, message: "Select a department." }, { status: 400 });
    if (!Number.isInteger(parkingLimit) || parkingLimit < 1) return NextResponse.json({ ok: false, message: "Parking limit must be at least 1." }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({ where: { id: employeeId, companyId }, include: { company: { include: { building: { select: { superAdminId: true } } } }, _count: { select: { vehicles: true } } } });
      if (!employee) throw new EmployeeUpdateError("Employee or company owner not found.", 404);
      if (!canEditEmployee(user, employee)) throw new EmployeeUpdateError("You do not have permission to edit this person.", 403);
      if ((user.role === "COMPANY_ADMIN" || user.role === "BUILDING_OWNER") && parkingLimit !== employee.parkingLimit && !hasPermission(user, "company.allocateEmployeeParking")) {
        throw new EmployeeUpdateError("Employee parking allocation is not assigned to this Company/User account.", 403);
      }

      const departmentExists = await tx.companyDepartment.findFirst({ where: { companyId, name: department }, select: { id: true } });
      if (!departmentExists) throw new EmployeeUpdateError("Select a department created for this company.");
      if (parkingLimit < employee._count.vehicles) throw new EmployeeUpdateError(`Parking limit cannot be lower than ${employee._count.vehicles} because this person already has ${employee._count.vehicles} registered vehicle${employee._count.vehicles === 1 ? "" : "s"}.`);

      const otherTotals = await tx.employee.aggregate({ where: { companyId, id: { not: employeeId } }, _sum: { parkingLimit: true } });
      const otherAssigned = otherTotals._sum.parkingLimit ?? 0;
      const availableForThisPerson = Math.max(employee.company.parkingAllocation - otherAssigned, 0);
      if (parkingLimit > availableForThisPerson) throw new EmployeeUpdateError(`This parking limit is too high. A maximum of ${availableForThisPerson} space${availableForThisPerson === 1 ? "" : "s"} can be assigned to this person.`);

      const updated = await tx.employee.update({ where: { id: employeeId }, data: { name, category, parkingLimit, department } });
      if (name !== employee.name || department !== employee.department) await tx.vehicle.updateMany({ where: { employeeId }, data: { ownerName: name, department } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10000, timeout: 15000 });

    revalidatePath("/dashboard");
    return NextResponse.json({ ok: true, message: `${result.category === "OWNER" ? "Company owner" : "Employee"} updated successfully.`, employee: { id: result.id, name: result.name, userId: result.userId, category: result.category, parkingLimit: result.parkingLimit, department: result.department } });
  } catch (error) {
    if (error instanceof EmployeeUpdateError) return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    console.error("UPDATE_EMPLOYEE_FAILED", error);
    return NextResponse.json({ ok: false, message: "Unable to update employee or company owner." }, { status: 500 });
  }
}
