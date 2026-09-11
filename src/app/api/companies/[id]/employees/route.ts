import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { claimUserId, UserIdError } from "@/lib/user-id-reservations";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: companyId } = await context.params;
    const owner = await getCurrentUser();
    if (!owner || owner.role !== "COMPANY_ADMIN" || owner.companyId !== companyId) {
      return NextResponse.json({ ok: false, message: "Only this company's user can create employees or company owners." }, { status: 403 });
    }
    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
    const name = String(body?.name ?? "").trim();
    const reservationId = String(body?.reservationId ?? "");
    const category = String(body?.category ?? "EMPLOYEE").toUpperCase();
    const parkingLimit = Number(body?.parkingLimit ?? 1);
    if (!name || !reservationId) {
      return NextResponse.json({ ok: false, message: "Name and generated User ID are required." }, { status: 400 });
    }
    if (!["EMPLOYEE", "OWNER"].includes(category)) {
      return NextResponse.json({ ok: false, message: "Choose Employee or Company Owner." }, { status: 400 });
    }
    if (!Number.isInteger(parkingLimit) || parkingLimit < 1) {
      return NextResponse.json({ ok: false, message: "Parking limit must be at least 1." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({ where: { id: companyId }, select: { parkingAllocation: true } });
      if (!company) throw new UserIdError("Company not found.", 404);
      const totals = await tx.employee.aggregate({ where: { companyId }, _sum: { parkingLimit: true } });
      const assigned = totals._sum.parkingLimit ?? 0;
      if (assigned + parkingLimit > company.parkingAllocation) {
        throw new UserIdError(`Only ${Math.max(company.parkingAllocation - assigned, 0)} parking spaces remain for employees and company owners.`, 400);
      }
      const claimedUserId = await claimUserId(tx, { ownerId: owner.id, reservationId, kind: "employee", scopeId: companyId, name });
      return tx.employee.create({ data: { name, userId: claimedUserId, companyId, category, parkingLimit } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10000, timeout: 15000 });

    revalidatePath("/dashboard");
    return NextResponse.json({
      ok: true,
      message: `${result.category === "OWNER" ? "Company owner" : "Employee"} created with ${result.parkingLimit} parking space${result.parkingLimit === 1 ? "" : "s"}.`,
      employee: { id: result.id, name: result.name, userId: result.userId, category: result.category, parkingLimit: result.parkingLimit },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof UserIdError) return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: false, message: "This generated User ID is already in use." }, { status: 409 });
    }
    console.error("CREATE_EMPLOYEE_FAILED", error);
    return NextResponse.json({ ok: false, message: "Unable to create employee or company owner." }, { status: 500 });
  }
}
