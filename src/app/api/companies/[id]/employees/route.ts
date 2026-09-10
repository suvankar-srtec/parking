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
      return NextResponse.json({ ok: false, message: "Only this company's administrator can create employees." }, { status: 403 });
    }
    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
    const name = String(body?.name ?? "").trim();
    const reservationId = String(body?.reservationId ?? "");
    if (!name || !reservationId) {
      return NextResponse.json({ ok: false, message: "Employee name and generated User ID are required." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const claimedUserId = await claimUserId(tx, { ownerId: owner.id, reservationId, kind: "employee", scopeId: companyId, name });
      return tx.employee.create({ data: { name, userId: claimedUserId, companyId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10000, timeout: 15000 });

    revalidatePath("/account");
    return NextResponse.json({
      ok: true,
      message: "Employee created successfully.",
      employee: { id: result.id, name: result.name, userId: result.userId },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof UserIdError) return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: false, message: "This generated User ID or username is already in use." }, { status: 409 });
    }
    console.error("CREATE_EMPLOYEE_FAILED");
    return NextResponse.json({ ok: false, message: "Unable to create employee." }, { status: 500 });
  }
}
