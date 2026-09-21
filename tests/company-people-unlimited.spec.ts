import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import { createHmac, randomBytes } from "node:crypto";

loadEnvConfig(process.cwd());
const db = new PrismaClient({ log: [] });
test.afterAll(() => db.$disconnect());
function cookie(id: string) {
  const payload = Buffer.from(JSON.stringify({ userDbId: id, exp: Math.floor(Date.now() / 1000) + 1200 })).toString("base64url");
  return payload + "." + createHmac("sha256", process.env.SESSION_SECRET!).update(payload).digest("base64url");
}

test("admins and company users add multiple people without a person cap; parking remains limited", async ({ page, baseURL }) => {
  test.setTimeout(300000);
  page.setDefaultTimeout(15000);
  const tag = "PEOPLE-" + randomBytes(6).toString("hex");
  const buildings: string[] = [], users: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  async function api(userId: string, path: string, data: unknown, method = "POST") {
    const response = await fetch(baseURL + path, { method, headers: { Cookie: "parking_session=" + cookie(userId), "Content-Type": "application/json" }, body: JSON.stringify(data) });
    return { status: response.status, body: await response.json() };
  }
  async function add(userId: string, companyId: string, name: string, category = "EMPLOYEE") {
    const reservation = await api(userId, "/api/user-ids", { kind: "employee", scopeId: companyId, name });
    expect(reservation.body.ok, JSON.stringify(reservation.body)).toBe(true);
    const result = await api(userId, `/api/companies/${companyId}/employees`, { name, category, parkingLimit: 6, department: "Default", reservationId: reservation.body.reservationId });
    expect(result.status, JSON.stringify(result.body)).toBe(201);
    expect(result.body.employee.parkingLimit).toBe(1);
    return result.body.employee;
  }
  try {
    const superAdmin = await db.user.create({ data: { userId: tag + "-sa", username: tag, role: "SUPER_ADMIN" } }); users.push(superAdmin.id);
    const building = await db.building.create({ data: { name: tag, totalParking: 20, ownerParking: 0, companyParking: 20, superAdminId: superAdmin.id } }); buildings.push(building.id);
    const admin = await db.user.create({ data: { userId: tag + "-admin", username: tag, role: "BUILDING_ADMIN", buildingId: building.id } }); users.push(admin.id);
    const company = await db.company.create({ data: { name: tag + "-company", buildingId: building.id, totalPersons: 1, parkingAllocation: 1, employeeParkingAllocation: 1, departments: { create: { name: "Default" } } } });
    const companyUser = await db.user.create({ data: { userId: tag + "-user", username: tag, role: "COMPANY_ADMIN", buildingId: building.id, companyId: company.id } }); users.push(companyUser.id);
    const existing = await db.employee.create({ data: { name: "Existing person", userId: tag + "-existing", companyId: company.id, department: "Default" } });
    const placeholder = await db.employee.create({ data: { name: "Empty slot", userId: tag + "-slot", companyId: company.id, isPlaceholder: true, parkingLimit: 0, slotNumber: 1 } });

    const first = await add(admin.id, company.id, "Admin employee one");
    expect(first.id).toBe(placeholder.id);
    await add(admin.id, company.id, "Admin employee two");
    await add(companyUser.id, company.id, "Company employee");
    await add(superAdmin.id, company.id, "Company owner", "OWNER");
    expect(await db.employee.count({ where: { companyId: company.id, isPlaceholder: false } })).toBe(5);
    expect(await db.employee.findUnique({ where: { id: existing.id }, select: { name: true } })).toEqual({ name: "Existing person" });

    const second = await db.company.create({ data: { name: tag + "-second", buildingId: building.id, totalPersons: 0, parkingAllocation: 0, departments: { create: { name: "Default" } } } });
    await add(admin.id, second.id, "Second company one");
    await add(admin.id, second.id, "Second company two");
    expect((await api(companyUser.id, `/api/companies/${second.id}/employees`, { name: "Forbidden", reservationId: "invalid", department: "Default" })).status).toBe(403);

    // Split validation counts vehicles, never the number of employees/owners.
    expect((await api(companyUser.id, `/api/companies/${company.id}/parking-split`, { ownerParkingAllocation: 0, employeeParkingAllocation: 1 }, "PATCH")).status).toBe(200);
    await db.vehicle.create({ data: { ownerName: existing.name, plateNumber: tag, vehicleType: "Four wheeler", department: "Default", companyId: company.id, employeeId: existing.id } });
    const blockedVehicle = await api(companyUser.id, `/api/companies/${company.id}/employees/${first.id}/vehicles`, { ownerName: first.name, plateNumber: tag + "-second", vehicleType: "Four wheeler", workerType: "Employee", department: "Default" });
    expect(blockedVehicle.status).toBe(400);
    expect(blockedVehicle.body.message).toContain("No unallotted parking spaces");
    expect((await api(companyUser.id, `/api/companies/${company.id}/parking-split`, { ownerParkingAllocation: 1, employeeParkingAllocation: 0 }, "PATCH")).status).toBe(400);
    expect((await api(admin.id, `/api/companies/${company.id}/admin-settings`, { parkingAllocation: 2 }, "PATCH")).status).toBe(200);
    expect((await api(admin.id, `/api/companies/${company.id}/admin-settings`, { parkingAllocation: 21 }, "PATCH")).status).toBe(400);
    expect(await db.employee.count({ where: { companyId: company.id } })).toBe(5);

    // New company setup needs no person count and creates no placeholder people.
    const companyName = tag + "-new";
    const companyReservation = await api(admin.id, "/api/user-ids", { kind: "company", scopeId: building.id, name: companyName });
    expect(companyReservation.body.ok).toBe(true);
    const createdCompany = await api(admin.id, `/api/buildings/${building.id}/companies`, { name: companyName, userId: companyReservation.body.userId, reservationId: companyReservation.body.reservationId, password: tag, parkingAllocation: 2 });
    expect(createdCompany.status, JSON.stringify(createdCompany.body)).toBe(201);
    expect(await db.employee.count({ where: { companyId: createdCompany.body.company.id } })).toBe(0);

    await page.context().addCookies([{ name: "parking_session", value: cookie(admin.id), url: baseURL!, httpOnly: true }]);
    await page.goto(`/access-control/register-cards/${company.id}`);
    await page.getByRole("button", { name: "Add Employee", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator('input[name="parkingLimit"]')).toHaveCount(0);
    await dialog.getByLabel("Full Name").fill("Admin browser employee");
    await expect(dialog.getByLabel("User ID", { exact: true })).toHaveValue(/^EMP\d+$/);
    await dialog.getByRole("button", { name: "Add & Continue" }).click();
    await expect(dialog.getByRole("button", { name: "Finish without vehicle" })).toBeVisible({ timeout: 30000 });
    await dialog.getByRole("button", { name: "Finish without vehicle" }).click();
    await expect(page.getByText("Admin browser employee", { exact: true })).toBeVisible();
    expect(await db.employee.count({ where: { companyId: company.id, isPlaceholder: false } })).toBe(6);
    await page.screenshot({ path: "test-results/unlimited-company-people.png", fullPage: true });

    await page.goto("/dashboard");
    const card = page.getByRole("article").filter({ has: page.getByText(company.name, { exact: true }) });
    await card.getByRole("button", { name: "Edit allocation" }).click();
    await expect(dialog.getByRole("heading", { name: "Edit company parking" })).toBeVisible();
    await expect(dialog.getByLabel("Company Parking")).toBeVisible();
    await expect(dialog.getByLabel("Total Persons")).toHaveCount(0);
    await page.screenshot({ path: "test-results/company-parking-no-person-limit.png", fullPage: true });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: /New company/ }).click();
    await expect(dialog.getByLabel(/Total Persons/)).toHaveCount(0);
    await expect(dialog.getByLabel("Company parking", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await page.goto("about:blank").catch(() => {});
    const companyRows = await db.company.findMany({ where: { buildingId: { in: buildings } }, select: { id: true } });
    await db.entityIdentity.deleteMany({ where: { entityType: "company", entityId: { in: companyRows.map(company => company.id) } } });
    await db.building.deleteMany({ where: { id: { in: buildings } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
  }
});

test("each employee and company owner gets only one vehicle allocation, including legacy allowances", async ({ request, baseURL }) => {
  test.setTimeout(120000);
  const tag = "ONE-SPACE-" + randomBytes(6).toString("hex");
  let buildingId = "";
  try {
    const building = await db.building.create({ data: { name: tag, totalParking: 10, ownerParking: 0, companyParking: 10 } });
    buildingId = building.id;
    const company = await db.company.create({ data: { name: tag, buildingId, parkingAllocation: 10, departments: { create: { name: "Default" } } } });
    const user = await db.user.create({ data: { userId: tag, username: tag, role: "COMPANY_ADMIN", buildingId, companyId: company.id } });
    const headers = { Cookie: "parking_session=" + cookie(user.id) };
    for (const category of ["EMPLOYEE", "OWNER"]) {
      const employee = await db.employee.create({ data: { name: category, userId: tag + category, companyId: company.id, category, department: "Default", parkingLimit: 6 } });
      const data = { ownerName: category, department: "Default", vehicleType: "Four wheeler", workerType: "Employee" };
      // Concurrent submissions must not create two allocations, even when an old record says six.
      const responses = await Promise.all([1, 2].map(number => request.post(`${baseURL}/api/companies/${company.id}/employees/${employee.id}/vehicles`, { headers, data: { ...data, plateNumber: `${tag}-${category}-${number}` } })));
      expect(responses.map(response => response.status()).sort()).toEqual([201, 400]);
      const rejected = responses.find(response => response.status() === 400)!;
      expect((await rejected.json()).message).toContain("Only one parking space is allowed per person");
      expect(await db.vehicle.count({ where: { employeeId: employee.id } })).toBe(1);
      const edit = await request.patch(`${baseURL}/api/companies/${company.id}/employees/${employee.id}`, { headers, data: { name: category, department: "Default", parkingLimit: 6 } });
      expect(edit.status()).toBe(200);
      expect((await edit.json()).employee.parkingLimit).toBe(1);
    }
  } finally {
    if (buildingId) await db.building.delete({ where: { id: buildingId } });
  }
});
