import { prisma } from "@/lib/prisma";

export async function nextSupervisorUserId() {
  const prefix = "SUP";
  const [users, employees] = await Promise.all([
    prisma.user.findMany({
      where: { userId: { startsWith: prefix, mode: "insensitive" } },
      select: { userId: true },
    }),
    prisma.employee.findMany({
      where: { userId: { startsWith: prefix, mode: "insensitive" } },
      select: { userId: true },
    }),
  ]);

  const used = new Set(
    [...users, ...employees]
      .map((item) => item.userId.trim().toUpperCase())
      .filter(Boolean),
  );

  for (let number = 1; number <= 9999; number += 1) {
    const candidate = `${prefix}${String(number).padStart(2, "0")}`;
    if (!used.has(candidate)) return candidate;
  }

  throw new Error("No Supervisor User ID is available.");
}
