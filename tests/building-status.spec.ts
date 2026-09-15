import { test, expect } from "@playwright/test";
import { PrismaClient, type UserRole } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import { createHmac, randomBytes } from "node:crypto";

loadEnvConfig(process.cwd());
const prisma = new PrismaClient({ log: [] });
test.afterAll(async () => { await prisma.$disconnect(); });
function cookie(id: string) {
  if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is required.");
  const encoded = Buffer.from(JSON.stringify({ userDbId: id, exp: Math.floor(Date.now() / 1000) + 1200 })).toString("base64url");
  return "parking_session=" + encoded + "." + createHmac("sha256", process.env.SESSION_SECRET).update(encoded).digest("base64url");
}

test("only the owning Super Admin can toggle buildings; disabled access and permanent app records", async ({ page, baseURL }) => {
  test.setTimeout(180000);
  const tag = "BUILDING-STATUS-" + randomBytes(8).toString("hex");
  const password = randomBytes(24).toString("hex");
  const userIds: string[] = [];
  let buildingId = "";
  const readerIds: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    const owner = await prisma.user.create({ data: { userId: tag + "-owner", username: tag, password, role: "SUPER_ADMIN" } });
    userIds.push(owner.id);
    const outsider = await prisma.user.create({ data: { userId: tag + "-outsider", username: tag, password, role: "SUPER_ADMIN" } });
    userIds.push(outsider.id);
    const building = await prisma.building.create({ data: { name: tag, superAdminId: owner.id, totalParking: 5, ownerParking: 0, companyParking: 5 } });
    buildingId = building.id;
    expect(building.enabled).toBe(true);
    const company = await prisma.company.create({ data: { name: tag, buildingId, parkingAllocation: 5 } });
    const members = [];
    for (const role of ["BUILDING_ADMIN", "COMPANY_ADMIN", "BUILDING_OWNER", "EMPLOYEE"] as UserRole[]) {
      const companyRole = role === "COMPANY_ADMIN" || role === "BUILDING_OWNER";
      const member = await prisma.user.create({ data: { userId: tag + role, username: tag, password, role, buildingId: companyRole ? null : buildingId, companyId: companyRole ? company.id : null } });
      userIds.push(member.id);
      members.push(member);
    }
    const employee = await prisma.employee.create({ data: { name: tag, userId: tag, companyId: company.id } });
    const card = randomBytes(8).toString("hex").toUpperCase();
    const vehicle = await prisma.vehicle.create({ data: { companyId: company.id, employeeId: employee.id, ownerName: tag, plateNumber: tag, vehicleType: "Four wheeler", department: "Test", rfidCardNo: card, isInside: true } });
    const readers: { deviceNumber: string }[] = [];
    for (let i = 0; i < 3; i++) {
      const reader = await prisma.rfidReader.create({ data: { name: tag, deviceNumber: tag + i, buildingId, enabled: true, mode: i === 2 ? "REGISTER" : "ENTRY_EXIT" } });
      readers.push(reader);
      readerIds.push(reader.id);
      if (i < 2) await prisma.gate.create({ data: { buildingId, gateNumber: i + 1, direction: (i === 0 ? "ENTRY" : "EXIT") + "::READER::" + reader.id } });
    }
    const url = baseURL + "/api/buildings/" + buildingId;
    const toggle = (id: string, enabled: unknown) => fetch(url, { method: "PATCH", headers: { Cookie: cookie(id), "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
    for (const member of [...members, outsider]) expect((await toggle(member.id, false)).status).toBe(403);
    expect((await toggle(owner.id, "false")).status).toBe(400);
    for (const id of [owner.id, outsider.id, ...members.map(member => member.id), ""]) {
      const response = await fetch(url, { method: "DELETE", headers: id ? { Cookie: cookie(id) } : {} });
      expect(response.status).toBe(405);
      expect((await response.json()).message).toContain("cannot be deleted");
    }
    expect(await prisma.building.findUnique({ where: { id: buildingId } })).not.toBeNull();

    await page.context().addCookies([{ name: "parking_session", value: cookie(owner.id).split("=")[1], url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Disable " + tag, exact: true }).click();
    await expect(page.getByRole("button", { name: "Enable " + tag, exact: true })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Building disabled." })).toBeVisible();
    expect((await prisma.building.findUniqueOrThrow({ where: { id: buildingId } })).enabled).toBe(false);
    await page.reload();
    await expect(page.getByRole("button", { name: "Enable " + tag, exact: true })).toBeVisible();
    await page.screenshot({ path: "test-results/building-disabled.png" });

    for (const member of members) {
      const login = await fetch(baseURL + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: member.userId, password }) });
      expect(login.status).toBe(403);
      expect((await login.json()).message).toContain("building is disabled");
      const memberContext = await page.context().browser()!.newContext();
      try {
        await memberContext.addCookies([{ name: "parking_session", value: cookie(member.id).split("=")[1], url: baseURL!, httpOnly: true }]);
        const memberPage = await memberContext.newPage();
        await memberPage.goto(baseURL + "/dashboard");
        await expect(memberPage).toHaveURL(baseURL + "/");
      } finally {
        await memberContext.close();
      }
      const response = await fetch(baseURL + "/api/companies/" + company.id + "/departments", { headers: { Cookie: cookie(member.id) } });
      expect(response.status).toBe(403);
    }
    async function scan(index: number) {
      if (!process.env.RFID_HTTP_TOKEN) throw new Error("RFID_HTTP_TOKEN is required.");
      const response = await fetch(baseURL + "/test", { method: "POST", headers: { "Content-Type": "text/html", "x-reader-token": process.env.RFID_HTTP_TOKEN }, body: "vgdecoderresult=" + card + "&&devicenumber=" + readers[index].deviceNumber });
      return response.text();
    }
    expect(await scan(1)).toBe("code=0000");
    expect((await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).isInside).toBe(false);
    await prisma.vehicle.update({ where: { id: vehicle.id }, data: { lastAccessAt: new Date(Date.now() - 60000) } });
    expect(await scan(0)).toBe("code=0001");
    expect(await scan(2)).toBe("code=0001");
    const denial = await prisma.rfidEvent.findFirstOrThrow({ where: { vehicleId: vehicle.id, action: "DENIED" }, orderBy: { createdAt: "desc" } });
    expect(denial.message).toContain("Building is disabled");

    await page.getByRole("button", { name: "Enable " + tag, exact: true }).click();
    await expect(page.getByRole("button", { name: "Disable " + tag, exact: true })).toBeVisible();
    expect((await prisma.building.findUniqueOrThrow({ where: { id: buildingId } })).enabled).toBe(true);
    for (const member of members) {
      const login = await fetch(baseURL + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: member.userId, password }) });
      expect(login.status).toBe(200);
    }
    expect(await scan(0)).toBe("code=0000");
    expect((await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).isInside).toBe(true);
    expect(await prisma.employee.count({ where: { companyId: company.id } })).toBe(1);
    expect(await prisma.vehicle.count({ where: { companyId: company.id } })).toBe(1);
    expect(errors).toEqual([]);
  } finally {
    await page.goto("about:blank");
    await prisma.rfidEvent.deleteMany({ where: { readerId: { in: readerIds } } });
    await prisma.rfidReader.deleteMany({ where: { id: { in: readerIds } } });
    // Direct database cleanup is restricted to this test's own fixtures; no app delete endpoint exists.
    if (buildingId) await prisma.building.delete({ where: { id: buildingId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});
