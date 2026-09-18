import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import { createHmac, randomBytes } from "node:crypto";

loadEnvConfig(process.cwd());
const db = new PrismaClient({ log: [] });
test.afterAll(async () => db.$disconnect());
function cookie(id: string) {
  const encoded = Buffer.from(JSON.stringify({ userDbId: id, exp: Math.floor(Date.now() / 1000) + 1200 })).toString("base64url");
  return encoded + "." + createHmac("sha256", process.env.SESSION_SECRET!).update(encoded).digest("base64url");
}

test("company employee cards: scoped navigation, reader capture, persistence and vehicle registration", async ({ page, baseURL }) => {
  test.setTimeout(300000);
  const tag = "CARD-UI-" + randomBytes(6).toString("hex");
  const userIds: string[] = [], buildingIds: string[] = [], readerIds: string[] = [];
  const errors: string[] = [];
  let idRequests = 0;
  page.on("request", request => { if (request.url().endsWith("/api/user-ids")) idRequests++; });
  page.on("pageerror", error => errors.push(error.message));
  const api = (path: string, userId: string, data: unknown) => fetch(baseURL + path, {
    method: "POST", headers: { Cookie: "parking_session=" + cookie(userId), "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  try {
    const owner = await db.user.create({ data: { userId: tag + "-sa", username: tag, role: "SUPER_ADMIN" } });
    userIds.push(owner.id);
    const stranger = await db.user.create({ data: { userId: tag + "-stranger", username: tag, role: "SUPER_ADMIN" } });
    userIds.push(stranger.id);
    const building = await db.building.create({ data: { name: tag, totalParking: 20, ownerParking: 0, companyParking: 20, superAdminId: owner.id } });
    buildingIds.push(building.id);
    const outside = await db.building.create({ data: { name: tag + "-outside", totalParking: 10, ownerParking: 0, companyParking: 10, superAdminId: stranger.id } });
    buildingIds.push(outside.id);
    const admin = await db.user.create({ data: { userId: tag + "-admin", username: tag, role: "BUILDING_ADMIN", buildingId: building.id } });
    userIds.push(admin.id);
    const restricted = await db.user.create({ data: { userId: tag + "-restricted", username: tag, role: "BUILDING_ADMIN", buildingId: building.id, permissionsCustomized: true, permissions: [] } });
    userIds.push(restricted.id);
    const outsider = await db.user.create({ data: { userId: tag + "-outsider", username: tag, role: "BUILDING_ADMIN", buildingId: outside.id } });
    userIds.push(outsider.id);
    const company = await db.company.create({ data: { name: "Test company " + tag, buildingId: building.id, parkingAllocation: 8 } });
    const companyUser = await db.user.create({ data: { userId: tag + "-company", username: tag, role: "COMPANY_ADMIN", buildingId: building.id, companyId: company.id } });
    userIds.push(companyUser.id);
    const otherCompany = await db.company.create({ data: { name: "Other company " + tag, buildingId: building.id, parkingAllocation: 2 } });
    const outsideCompany = await db.company.create({ data: { name: "Outside company " + tag, buildingId: outside.id, parkingAllocation: 2 } });
    const alice = await db.employee.create({ data: { name: "Alice Registered", userId: tag + "A", companyId: company.id, department: "Operations", parkingLimit: 2 } });
    const bob = await db.employee.create({ data: { name: "Bob Missing Card", userId: tag + "B", companyId: company.id, department: "Unassigned" } });
    const cara = await db.employee.create({ data: { name: "Cara No Vehicle", userId: tag + "C", companyId: company.id, department: "Unassigned" } });
    const placeholder = await db.employee.create({ data: { name: "Empty roster slot", userId: tag + "P", companyId: company.id, isPlaceholder: true, parkingLimit: 0 } });
    await db.employee.create({ data: { name: "Other company employee", userId: tag + "O", companyId: otherCompany.id } });
    const aliceCard = randomBytes(6).toString("hex").toUpperCase();
    const aliceVehicle = await db.vehicle.create({ data: { ownerName: alice.name, plateNumber: tag + "A", vehicleType: "Four wheeler", department: "Operations", companyId: company.id, employeeId: alice.id, rfidCardNo: aliceCard } });
    const bobVehicle = await db.vehicle.create({ data: { ownerName: bob.name, plateNumber: tag + "B", vehicleType: "Two wheeler", department: "Operations", companyId: company.id, employeeId: bob.id } });
    const reader = await db.rfidReader.create({ data: { deviceNumber: "TEST-" + tag, name: "Registration test reader", buildingId: building.id, enabled: true, mode: "REGISTER" } });
    readerIds.push(reader.id);
    const otherReader = await db.rfidReader.create({ data: { deviceNumber: "OTHER-" + tag, name: "Other building reader", buildingId: outside.id, enabled: true, mode: "REGISTER" } });
    readerIds.push(otherReader.id);
    async function scan(card: string) {
      if (!process.env.RFID_HTTP_TOKEN) throw new Error("RFID_HTTP_TOKEN required for simulated reader posts.");
      const response = await fetch(baseURL + "/test", { method: "POST", headers: { "Content-Type": "text/html", "x-reader-token": process.env.RFID_HTTP_TOKEN }, body: "vgdecoderresult=" + card + "&&devicenumber=" + reader.deviceNumber });
      expect(await response.text()).toBe("code=0001"); // Capture never opens a gate.
    }
    await page.context().addCookies([{ name: "parking_session", value: cookie(admin.id), url: baseURL!, httpOnly: true }]);
    await page.goto("/access-control/register-cards");
    await expect(page.getByRole("link").filter({ hasText: company.name })).toBeVisible();
    await expect(page.getByText(outsideCompany.name)).toHaveCount(0);
    await page.getByRole("link").filter({ hasText: company.name }).click();
    await expect(page.getByRole("heading", { name: "Employees & RFID cards" })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: alice.name })).toContainText(aliceCard);
    await expect(page.getByRole("row").filter({ hasText: alice.name }).getByRole("button", { name: "Register card" })).toHaveCount(0);
    await expect(page.getByText("Other company employee")).toHaveCount(0);
    await expect(page.getByText(placeholder.name)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Register card", exact: true })).toHaveCount(2);
    await page.screenshot({ path: "test-results/company-employee-cards.png", fullPage: true });

    for (const denied of [outsider, stranger, restricted]) {
      expect((await api("/api/rfid/enrollments", denied.id, { readerId: reader.id, employeeId: bob.id, vehicleId: bobVehicle.id })).status).toBe(404);
      expect((await api("/api/rfid/cards", denied.id, { vehicleId: bobVehicle.id, enrollmentId: "invalid" })).status).toBe(404);
    }
    expect((await api("/api/rfid/enrollments", admin.id, { readerId: otherReader.id, employeeId: bob.id, vehicleId: bobVehicle.id })).status).toBe(400);
    expect((await api("/api/rfid/enrollments", admin.id, { readerId: reader.id, employeeId: placeholder.id })).status).toBe(400);
    const createVehicle = "/api/companies/" + company.id + "/employees/" + cara.id + "/vehicles";
    const vehicleData = { ownerName: cara.name, plateNumber: tag + "C", vehicleType: "Four wheeler", department: "Operations", workerType: "Employee" };
    expect((await api(createVehicle, admin.id, vehicleData)).status).toBe(400);
    expect((await api(createVehicle, outsider.id, { ...vehicleData, enrollmentId: "invalid" })).status).toBe(404);

    const bobRow = page.getByRole("row").filter({ hasText: bob.name });
    await bobRow.getByRole("button", { name: "Register card", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Add Employee / Company Owner" })).toBeVisible();
    await expect(dialog.getByLabel("Full Name")).toHaveValue(bob.name);
    await expect(dialog.getByLabel("User ID", { exact: true })).toHaveValue(bob.userId);
    await expect(dialog.getByLabel("User ID", { exact: true })).toHaveAttribute("readonly", "");
    await expect(dialog.getByRole("button", { name: "Refresh User ID" })).toHaveCount(0);
    await expect(dialog.getByPlaceholder("e.g. Marketing")).toBeVisible();
    await page.screenshot({ path: "test-results/register-card-person-popup.png", fullPage: true });
    await dialog.getByPlaceholder("e.g. Marketing").fill("Operations");
    await dialog.getByRole("button", { name: "+ Add", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Department", exact: true })).toContainText("Operations");
    await dialog.getByRole("button", { name: "Save & Continue" }).click();
    await expect(dialog.getByRole("heading", { name: "Register card for " + bob.name })).toBeVisible();
    expect(await db.employee.count({ where: { companyId: company.id } })).toBe(4);
    expect((await db.employee.findUniqueOrThrow({ where: { id: bob.id } })).department).toBe("Operations");
    await dialog.getByLabel("Registration reader").selectOption(reader.id);
    await expect(dialog.getByText(/Scan the RFID card on/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Save registration" })).toBeDisabled();
    const bobCard = randomBytes(6).toString("hex").toUpperCase();
    await scan(bobCard);
    await expect(dialog.getByLabel("RFID Card No.")).toHaveValue(bobCard);
    await dialog.getByRole("button", { name: "Save registration" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(bobRow).toContainText(bobCard);
    expect((await db.vehicle.findUniqueOrThrow({ where: { id: bobVehicle.id } })).rfidCardNo).toBe(bobCard);
    await page.reload();
    await expect(bobRow).toContainText(bobCard);

    await page.getByRole("row").filter({ hasText: cara.name }).getByRole("button", { name: "Register card", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "Add Employee / Company Owner" })).toBeVisible();
    await expect(dialog.getByLabel("User ID", { exact: true })).toHaveValue(cara.userId);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "test-results/register-card-person-popup-mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1366, height: 900 });
    await dialog.getByRole("button", { name: "Save & Continue" }).click();
    await dialog.getByLabel("Plate Number").fill(tag + "C");
    await dialog.getByLabel("Vehicle Type").selectOption("Four wheeler");
    await dialog.getByLabel("Registration reader").selectOption(reader.id);
    await expect(dialog.getByText(/Scan the RFID card on/)).toBeVisible();
    const caraCard = randomBytes(6).toString("hex").toUpperCase();
    await scan(caraCard);
    await expect(dialog.getByLabel("RFID Card No.")).toHaveValue(caraCard);
    await dialog.getByRole("button", { name: "Save registration" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("row").filter({ hasText: cara.name })).toContainText(caraCard);
    const saved = await db.vehicle.findFirstOrThrow({ where: { employeeId: cara.id } });
    expect(saved.rfidCardNo).toBe(caraCard);
    expect(saved.companyId).toBe(company.id);
    expect(await db.rfidEvent.count({ where: { companyId: company.id, action: "REGISTER" } })).toBe(2);

    const enrollmentResponse = await api("/api/rfid/enrollments", admin.id, { readerId: reader.id, employeeId: bob.id, vehicleId: bobVehicle.id });
    expect(enrollmentResponse.status).toBe(201);
    const { enrollment } = await enrollmentResponse.json();
    await scan(aliceCard);
    expect((await db.rfidEnrollment.findUniqueOrThrow({ where: { id: enrollment.id } })).status).toBe("DUPLICATE");
    expect((await api("/api/rfid/cards", admin.id, { vehicleId: bobVehicle.id, enrollmentId: enrollment.id })).status).toBe(409);
    expect((await db.vehicle.findUniqueOrThrow({ where: { id: aliceVehicle.id } })).rfidCardNo).toBe(aliceCard);
    expect((await db.vehicle.findUniqueOrThrow({ where: { id: bobVehicle.id } })).rfidCardNo).toBe(bobCard);

    await page.goto("/access-control/register-cards/" + outsideCompany.id);
    await expect(page.getByText(outsideCompany.name)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await page.context().addCookies([{ name: "parking_session", value: cookie(owner.id), url: baseURL!, httpOnly: true }]);
    await page.goto("/access-control/register-cards/" + company.id);
    await expect(page.getByRole("row").filter({ hasText: bob.name })).toContainText(bobCard);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "test-results/company-employee-cards-mobile.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await db.employee.count({ where: { companyId: company.id } })).toBe(4);
    expect(idRequests).toBe(0);
    await page.context().addCookies([{ name: "parking_session", value: cookie(companyUser.id), url: baseURL!, httpOnly: true }]);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Add Employee", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "Add Employee / Company Owner" })).toBeVisible();
    await expect(dialog.getByLabel("Full Name")).toHaveValue("");
    await expect(dialog.getByRole("button", { name: "Refresh User ID" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Add & Continue" })).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(errors).toEqual([]);
  } finally {
    await page.goto("about:blank");
    await db.rfidEvent.deleteMany({ where: { readerId: { in: readerIds } } });
    await db.rfidReader.deleteMany({ where: { id: { in: readerIds } } });
    // Only this test's generated buildings, users and related fixture rows are removed.
    await db.building.deleteMany({ where: { id: { in: buildingIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  }
});
