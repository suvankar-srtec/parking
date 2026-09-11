// Runs against the configured database and running app; cleans up only its unique fixtures.
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHmac } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { chromium, expect } from "@playwright/test";
process.loadEnvFile(".env");
const prisma = new PrismaClient({ log: [] });
const base = process.env.RFID_APP_URL || "http://localhost:3000";
function session(id) {
  const payload = Buffer.from(JSON.stringify({ userDbId: id, exp: Math.floor(Date.now()/1000) + 600 })).toString("base64url");
  return payload + "." + createHmac("sha256", process.env.SESSION_SECRET).update(payload).digest("base64url");
}
test("RFID registration, entry/exit, capacity, debounce, authorization and UI persist correctly", { timeout: 300000 }, async () => {
  const tag = "RFIDTEST-" + randomBytes(8).toString("hex");
  const device = String(Date.now()) + "01", exitDevice = String(Date.now()) + "02";
  const devices = [device, exitDevice];
  const card = randomBytes(6).toString("hex");
  let building, browser;
  async function json(url, body, user) {
    const response = await fetch(base + url, { method: "POST", headers: { "Content-Type": "application/json", ...(user ? { cookie: "parking_session=" + session(user.id) } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }
  async function scan(number, value = card, token = process.env.RFID_HTTP_TOKEN) {
    const response = await fetch(base + "/test", { method: "POST", headers: { "x-reader-token": token }, body: "vgdecoderesult" + value + "devicenumber" + number + "otherparams" });
    return response.text();
  }
  try {
    building = await prisma.building.create({ data: { name: tag, totalParking: 10, ownerParking: 0, companyParking: 10 } });
    const company = await prisma.company.create({ data: { name: tag, buildingId: building.id, parkingAllocation: 2 } });
    const employee = await prisma.employee.create({ data: { name: tag, userId: tag + "-EMP", companyId: company.id } });
    const user = await prisma.user.create({ data: { userId: tag + "-COMP", username: tag, role: "COMPANY_ADMIN", buildingId: building.id, companyId: company.id } });
    const admin = await prisma.user.create({ data: { userId: tag + "-BLD", username: tag, role: "BUILDING_ADMIN", buildingId: building.id } });
    const reader = await prisma.rfidReader.create({ data: { deviceNumber: device, name: tag, buildingId: building.id, mode: "REGISTER", enabled: true, connectionType: "TCP", readerIp: "127.0.0.1" } });
    await prisma.rfidReader.create({ data: { deviceNumber: exitDevice, name: tag + "-EXIT", buildingId: building.id, mode: "EXIT", enabled: true } });
    assert.equal(await scan(device, card, "invalid-token"), "code=0001&&desc=Reader is not authorized");
    const enrollment = await json("/api/rfid/enrollments", { readerId: reader.id, employeeId: employee.id }, user);
    assert.equal(enrollment.status, 201, enrollment.data.message);
    assert.equal((await json("/api/rfid/enrollments", { readerId: reader.id, employeeId: employee.id }, user)).status, 409);
    assert.match(await scan(device), /^code=0000&&desc=Card captured/);
    const vehicleUrl = "/api/companies/" + company.id + "/employees/" + employee.id + "/vehicles";
    const details = { ownerName: tag, plateNumber: tag, vehicleType: "Four wheeler", department: "IT", workerType: "Staff", enrollmentId: enrollment.data.enrollment.id };
    const saved = await json(vehicleUrl, details, user);
    assert.equal(saved.status, 201, saved.data.message);
    const vehicleId = saved.data.vehicle.id;
    const stored = await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
    assert.equal(stored.rfidCardNo, card.toUpperCase()); assert.equal(stored.isStaff, true);
    assert.equal((await prisma.rfidEnrollment.findUniqueOrThrow({ where: { id: enrollment.data.enrollment.id } })).status, "COMPLETED");
    assert.equal((await json(vehicleUrl, { ...details, plateNumber: tag + "-2" }, user)).status, 409);
    assert.equal((await json(vehicleUrl, { ...details, enrollmentId: undefined, rfidCardNo: "FORGED" }, user)).status, 400);
    const config = { deviceNumber: device, name: tag, mode: "ENTRY", buildingId: building.id, enabled: true };
    assert.equal((await json("/api/rfid/readers", config, user)).status, 403);
    assert.equal((await json("/api/rfid/readers", config, admin)).status, 200);
    assert.equal(await scan(device, "0000DEADBEEF"), "code=0001&&desc=RFID card is not registered");
    assert.equal(await scan(device), "code=0000&&desc=Parking allowed");
    assert.equal((await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } })).isInside, true);
    await prisma.vehicle.update({ where: { id: vehicleId }, data: { lastAccessAt: new Date() } });
    assert.equal(await scan(exitDevice), "code=0001&&desc=Duplicate scan ignored");
    await prisma.vehicle.update({ where: { id: vehicleId }, data: { lastAccessAt: new Date(0) } });
    assert.equal(await scan(exitDevice), "code=0000&&desc=Vehicle checked out");
    await prisma.vehicle.update({ where: { id: vehicleId }, data: { lastAccessAt: new Date(0) } });
    await prisma.company.update({ where: { id: company.id }, data: { parkingAllocation: 0 } });
    assert.equal(await scan(device), "code=0001&&desc=Parking allocation is full");
    await prisma.company.update({ where: { id: company.id }, data: { parkingAllocation: 2 } });
    assert.equal((await json("/api/rfid/readers", { ...config, mode: "ENTRY_EXIT" }, admin)).status, 200);
    const concurrent = await Promise.all([scan(device), scan(device)]);
    assert.equal(concurrent.filter(reply => reply === "code=0000&&desc=Parking allowed").length, 1);
    assert.equal(concurrent.filter(reply => reply === "code=0001&&desc=Duplicate scan ignored").length, 1);
    await prisma.vehicle.update({ where: { id: vehicleId }, data: { lastAccessAt: new Date(0) } });
    assert.equal(await scan(device), "code=0000&&desc=Vehicle checked out");
    async function connection(action, connectionId, token = process.env.RFID_GATEWAY_TOKEN) {
      return fetch(base + "/api/rfid/tcp", { method: "POST", headers: { "Content-Type": "application/json", "x-gateway-token": token }, body: JSON.stringify({ action, connectionId, deviceNumber: device, readerIp: "127.0.0.1", sourcePort: 42583 }) });
    }
    assert.equal((await connection("connect", "old", "invalid")).status, 403);
    assert.equal((await connection("connect", "old")).status, 200);
    await connection("connect", "new"); await connection("disconnect", "old");
    assert.equal((await prisma.rfidReader.findUniqueOrThrow({ where: { id: reader.id } })).tcpConnected, true);
    await connection("disconnect", "new"); await connection("alive", "new");
    assert.equal((await prisma.rfidReader.findUniqueOrThrow({ where: { id: reader.id } })).tcpConnected, false);
    const events = await prisma.rfidEvent.findMany({ where: { buildingId: building.id } });
    for (const action of ["CAPTURE", "REGISTER", "ENTRY", "EXIT", "DENIED", "IGNORED"]) assert.ok(events.some(event => event.action === action), action);
    assert.ok(events.every(event => ["0000", "0001"].includes(event.code)));
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await context.addCookies([{ name: "parking_session", value: session(admin.id), url: base }]);
    const page = await context.newPage(); const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base + "/access-control");
    await page.getByRole("button", { name: "Configure reader" }).first().click();
    assert.equal(await page.locator('select[name="buildingId"]').inputValue(), building.id);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.screenshot({ path: "test-results/rfid-reader-console.png", fullPage: true });
    await context.clearCookies();
    await context.addCookies([{ name: "parking_session", value: session(user.id), url: base }]);
    assert.equal((await json("/api/rfid/readers", { ...config, mode: "REGISTER" }, admin)).status, 200);
    await page.goto(base + "/account");
    await page.getByRole("button", { name: "Register card", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    assert.equal(await page.locator('input[name="rfidCardNo"]').getAttribute("readonly"), "");
    await page.getByRole("button", { name: "Scan card", exact: true }).click();
    await page.getByText("Waiting for a card", { exact: false }).waitFor();
    const replacementCard = randomBytes(6).toString("hex");
    assert.match(await scan(device, replacementCard), /^code=0000/);
    await expect(page.locator('input[name="rfidCardNo"]')).toHaveValue(replacementCard.toUpperCase(), { timeout: 15000 });
    await page.getByRole("button", { name: "Save card", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal((await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } })).rfidCardNo, replacementCard.toUpperCase());
    assert.equal(errors.length, 0, errors.join("\n"));
    await browser.close(); browser = null;
  } finally {
    await browser?.close();
    await prisma.rfidEvent.deleteMany({ where: { deviceNumber: { in: devices } } });
    await prisma.rfidReader.deleteMany({ where: { deviceNumber: { in: devices } } });
    if (building) await prisma.building.delete({ where: { id: building.id } });
    await prisma.$disconnect();
  }
});
