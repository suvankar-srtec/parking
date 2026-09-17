import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { claimUserId, UserIdError } from "@/lib/user-id-reservations";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: companyId } = await context.params;
    const owner = await getCurrentUser();
    if (!owner || owner.role !== "COMPANY_ADMIN" || owner.companyId !== companyId || !hasPermission(owner, "company.managePeople")) {
      return NextResponse.json({ ok: false, message: "People management is not assigned to this Company/User account." }, { status: 403 });
    }
    if (!hasPermission(owner, "company.allocateEmployeeParking")) {
      return NextResponse.json({ ok: false, message: "Employee parking allocation is not assigned to this Company/User account." }, { status: 403 });
    }
    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
    const name = String(body?.name ?? "").trim();
    const reservationId = String(body?.reservationId ?? "");
    const category = String(body?.category ?? "EMPLOYEE").toUpperCase();
    const parkingLimit = 1;
    const department = String(body?.department ?? "").trim();
    if (!name || !reservationId || !department) return NextResponse.json({ ok: false, message: "Name, generated User ID, and department are required." }, { status: 400 });
    if (!["EMPLOYEE", "OWNER"].includes(category)) return NextResponse.json({ ok: false, message: "Choose Employee or Company Owner." }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: {
          totalPersons: true,
          ownerParkingAllocation: true,
          employeeParkingAllocation: true,
        },
      });
      if (!company) throw new UserIdError("Company not found.", 404);
      const departmentExists = await tx.companyDepartment.findFirst({ where: { companyId, name: department }, select: { id: true } });
      if (!departmentExists) throw new UserIdError("Select a department created for this company.", 400);

      const currentPeople = await tx.employee.count({ where: { companyId } });
      if (currentPeople >= company.totalPersons) {
        throw new UserIdError(`The Admin set Total Persons to ${company.totalPersons}. No more people can be added to this company.`, 400);
      }

      const categoryCount = await tx.employee.count({
        where: { companyId, category: category === "OWNER" ? "OWNER" : { not: "OWNER" } },
      });
      const categoryLimit = category === "OWNER" ? company.ownerParkingAllocation : company.employeeParkingAllocation;
      const categoryLabel = category === "OWNER" ? "Company Owner" : "Employee";
      if (categoryCount >= categoryLimit) {
        throw new UserIdError(`No ${categoryLabel} parking space remains. Update the Company parking split first.`, 400);
      }

      const claimedUserId = await claimUserId(tx, { ownerId: owner.id, reservationId, kind: "employee", scopeId: companyId, name });
      return tx.employee.create({ data: { name, userId: claimedUserId, companyId, category, parkingLimit, department } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10000, timeout: 15000 });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/company-parking");
    return NextResponse.json({ ok: true, message: `${result.category === "OWNER" ? "Company owner" : "Employee"} created with 1 parking space.`, employee: { id: result.id, name: result.name, userId: result.userId, category: result.category, parkingLimit: result.parkingLimit, department: result.department } }, { status: 201 });
  } catch (error) {
    if (error instanceof UserIdError) return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ ok: false, message: "This generated User ID is already in use." }, { status: 409 });
    console.error("CREATE_EMPLOYEE_FAILED", error);
    return NextResponse.json({ ok: false, message: "Unable to create employee or company owner." }, { status: 500 });
  }
}
