import type { Prisma } from "@prisma/client";

export class CompanyRosterError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function rosterUserId(companyUserId: string, slot: number) {
  return `${companyUserId}-EMP-${slot}`;
}

export async function syncCompanyRoster(
  tx: Prisma.TransactionClient,
  companyId: string,
  companyUserId: string,
  totalPersons: number,
) {
  const people = await tx.employee.findMany({
    where: { companyId },
    select: { id: true, isPlaceholder: true, slotNumber: true, _count: { select: { vehicles: true } } },
    orderBy: [{ slotNumber: "asc" }, { createdAt: "asc" }],
  });

  const realPeople = people.filter((person) => !person.isPlaceholder);
  if (realPeople.length > totalPersons) {
    throw new CompanyRosterError(`${realPeople.length} named employees already exist. Total Persons cannot be lower than ${realPeople.length}.`);
  }

  const targetPlaceholderCount = totalPersons - realPeople.length;
  const placeholders = people.filter((person) => person.isPlaceholder);

  if (placeholders.length > targetPlaceholderCount) {
    const removable = placeholders
      .filter((person) => person._count.vehicles === 0)
      .sort((a, b) => (b.slotNumber ?? 0) - (a.slotNumber ?? 0));
    const removeCount = placeholders.length - targetPlaceholderCount;
    if (removable.length < removeCount) {
      throw new CompanyRosterError("Some roster slots already have vehicle data and cannot be removed. Remove those allocations before reducing Total Persons.");
    }
    await tx.employee.deleteMany({ where: { id: { in: removable.slice(0, removeCount).map((person) => person.id) } } });
  }

  if (placeholders.length < targetPlaceholderCount) {
    const usedSlots = new Set(people.map((person) => person.slotNumber).filter((value): value is number => value !== null));
    const createCount = targetPlaceholderCount - placeholders.length;
    const data: Prisma.EmployeeCreateManyInput[] = [];
    let slot = 1;
    while (data.length < createCount) {
      if (!usedSlots.has(slot)) {
        data.push({
          companyId,
          name: `EMP-${slot}`,
          userId: rosterUserId(companyUserId, slot),
          category: "EMPLOYEE",
          parkingLimit: 0,
          department: "Unassigned",
          isPlaceholder: true,
          slotNumber: slot,
        });
        usedSlots.add(slot);
      }
      slot += 1;
    }
    await tx.employee.createMany({ data });
  }
}
