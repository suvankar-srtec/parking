import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import { createHmac, randomBytes } from "node:crypto";

loadEnvConfig(process.cwd());
const prisma = new PrismaClient({ log: [] });
test.afterAll(async () => { await prisma.$disconnect(); });

test("department minus removes only the current company's department and preserves people and vehicles", async ({ page, baseURL }) => {
  test.setTimeout(180000);
  const tag = "DEPT-TEST-" + randomBytes(8).toString("hex");
  const buildingIds: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    for (let i = 0; i < 2; i++) {
      const building = await prisma.building.create({ data: { name: tag + i, totalParking: 10, ownerParking: 0, companyParking: 10 } });
      buildingIds.push(building.id);
    }
    const companies = [];
    const departments = [];
    const employees = [];
    const vehicles = [];
    for (let i = 0; i < 3; i++) {
      const company = await prisma.company.create({ data: { name: tag + i, buildingId: buildingIds[i === 2 ? 1 : 0], parkingAllocation: 3 } });
      companies.push(company);
      departments.push(await prisma.companyDepartment.create({ data: { companyId: company.id, name: "Finance" } }));
      const employee = await prisma.employee.create({ data: { companyId: company.id, userId: tag + i, name: "Test employee", department: "Finance", parkingLimit: 2 } });
      employees.push(employee);
      vehicles.push(await prisma.vehicle.create({ data: { companyId: company.id, employeeId: employee.id, ownerName: tag, plateNumber: tag + i, vehicleType: "Four wheeler", department: "Finance" } }));
    }
    await prisma.companyDepartment.create({ data: { companyId: companies[0].id, name: "HR" } });
    const user = await prisma.user.create({ data: { userId: tag, username: tag, password: randomBytes(24).toString("hex"), role: "COMPANY_ADMIN", buildingId: buildingIds[0], companyId: companies[0].id } });
    if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is required for the local test.");
    const payload = Buffer.from(JSON.stringify({ userDbId: user.id, exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
    const signature = createHmac("sha256", process.env.SESSION_SECRET).update(payload).digest("base64url");
    await page.context().addCookies([{ name: "parking_session", value: payload + "." + signature, url: baseURL!, httpOnly: true, sameSite: "Lax" }]);

    const endpoint = "/api/companies/" + companies[0].id + "/departments/" + departments[0].id;
    const wrongDepartment = await page.request.delete("/api/companies/" + companies[0].id + "/departments/" + departments[1].id);
    expect(wrongDepartment.status()).toBe(404);
    const wrongCompany = await page.request.delete("/api/companies/" + companies[2].id + "/departments/" + departments[2].id);
    expect(wrongCompany.status()).toBe(403);

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Add vehicle", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Department", { exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Remove Finance department" })).toBeVisible();
    await page.screenshot({ path: "test-results/department-minus.png" });

    await page.route("**" + endpoint, async (route) => {
      await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ ok: false, message: "Test: deletion denied." }) });
    });
    await dialog.getByRole("button", { name: "Remove Finance department" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Test: deletion denied." })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Remove Finance department" })).toBeVisible();
    expect(await prisma.companyDepartment.findUnique({ where: { id: departments[0].id } })).not.toBeNull();
    await page.unroute("**" + endpoint);

    await dialog.getByRole("button", { name: "Remove Finance department" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Finance department deleted." })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Remove Finance department" })).toHaveCount(0);
    await expect(dialog.locator('input[name="department"]')).toHaveValue("");
    expect(await prisma.companyDepartment.findUnique({ where: { id: departments[0].id } })).toBeNull();
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: employees[0].id } })).department).toBe("Unassigned");
    expect((await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicles[0].id } })).department).toBe("Unassigned");
    for (let i = 1; i < 3; i++) {
      expect(await prisma.companyDepartment.findUnique({ where: { id: departments[i].id } })).not.toBeNull();
      expect((await prisma.employee.findUniqueOrThrow({ where: { id: employees[i].id } })).department).toBe("Finance");
      expect((await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicles[i].id } })).department).toBe("Finance");
    }
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: "Add vehicle", exact: true }).click();
    await dialog.getByLabel("Department", { exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Remove Finance department" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "HR", exact: true }).click();
    await expect(dialog.locator('input[name="department"]')).toHaveValue("HR");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await dialog.getByLabel("Department", { exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Remove HR department" })).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Add Employee", exact: true }).click();
    await dialog.getByLabel("Department", { exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Remove HR department" })).toBeVisible();
    await dialog.getByRole("button", { name: "HR", exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Department", { exact: true })).toHaveAttribute("aria-expanded", "false");
    expect(errors).toEqual([]);
  } finally {
    await page.goto("about:blank");
    await prisma.building.deleteMany({ where: { id: { in: buildingIds } } });
  }
});
