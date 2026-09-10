import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import { createHmac, randomBytes } from "node:crypto";
import { validateParking, syncParkingField } from "../src/lib/parking";

loadEnvConfig(process.cwd());
const prisma = new PrismaClient({ log: [] });
let token: string;

test.beforeAll(async () => {
  const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, select: { id: true } });
  if (!admin || !process.env.SESSION_SECRET) throw new Error("Configured Super Admin required.");
  const data = Buffer.from(JSON.stringify({ userDbId: admin.id, exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
  token = data + "." + createHmac("sha256", process.env.SESSION_SECRET).update(data).digest("base64url");
});
test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "parking_session", value: token, url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
});
test.afterAll(async () => { await prisma.$disconnect(); });

test("parking validation rejects incomplete, noninteger, and inconsistent totals", () => {
  const valid = { totalParking: 100, ownerParking: 20, companyParking: 80 };
  expect(validateParking(valid).ok).toBe(true);
  expect(validateParking({ totalParking: 100, ownerParking: 0, companyParking: 100 }).ok).toBe(true);
  expect(validateParking({ totalParking: 100, ownerParking: 100, companyParking: 0 }).ok).toBe(true);
  for (const invalid of [
    null, {}, { ...valid, ownerParking: null }, { ...valid, ownerParking: "" },
    { ...valid, ownerParking: -1 }, { ...valid, ownerParking: 1.5 },
    { ...valid, totalParking: 0 }, { ...valid, totalParking: 2147483648 },
    { ...valid, totalParking: "100" }, { ...valid, companyParking: 79 },
    { ...valid, companyParking: Number.NaN },
  ]) expect(validateParking(invalid).ok).toBe(false);
});

test("parking edits save, survive reload, and reject invalid or unauthorized changes", async ({ page, playwright, baseURL }) => {
  test.setTimeout(120000);
  const suffix = randomBytes(6).toString("hex");
  const building = await prisma.building.create({
    data: {
      name: "Parking edit verification " + suffix,
      totalParking: 100, ownerParking: 20, companyParking: 80,
      companies: { create: { name: "Allocated company " + suffix, parkingAllocation: 15 } },
      users: { create: { role: "BUILDING_ADMIN", userId: "parking_admin_" + suffix, username: "parking_admin_" + suffix, password: randomBytes(16).toString("hex") } },
    },
  });
  try {
    const endpoint = "/api/buildings/" + building.id;
    await page.goto("/dashboard/buildings/" + building.id);
    await expect(page.getByText("Building login", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Company pool", { exact: true })).toHaveCount(0);
    const editor = page.getByRole("form", { name: "Building parking settings" });
    await expect(editor.getByRole("spinbutton")).toHaveCount(3);
    await expect(editor.getByLabel("Total parking", { exact: true })).toHaveValue("100");
    await expect(editor.getByLabel("Owner parking", { exact: true })).toHaveValue("20");
    await expect(editor.getByLabel("Company parking", { exact: true })).toHaveValue("80");
    await expect(editor.getByRole("button", { name: "Update parking" })).toBeDisabled();
    await editor.getByLabel("Total parking", { exact: true }).fill("120");
    await editor.getByLabel("Owner parking", { exact: true }).fill("30");
    await editor.getByLabel("Company parking", { exact: true }).fill("90");
    const [savedResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(endpoint) && r.request().method() === "PATCH"),
      editor.getByRole("button", { name: "Update parking" }).click(),
    ]);
    expect(savedResponse.status()).toBe(200);
    await expect(page.locator(".notification-success").last()).toContainText("Parking allocation updated successfully.");
    const savedValues = { totalParking: 120, ownerParking: 30, companyParking: 90 };
    async function readValues() {
      return prisma.building.findUniqueOrThrow({
        where: { id: building.id },
        select: { totalParking: true, ownerParking: true, companyParking: true },
      });
    }
    expect(await readValues()).toEqual(savedValues);
    await page.reload();
    for (const [label, value] of [["Total parking", "120"], ["Owner parking", "30"], ["Company parking", "90"]]) {
      await expect(editor.getByLabel(label, { exact: true })).toHaveValue(value);
    }
    await editor.getByLabel("Owner parking", { exact: true }).fill("40");
    await editor.getByRole("button", { name: "Discard changes" }).click();
    await expect(editor.getByLabel("Owner parking", { exact: true })).toHaveValue("30");

    await editor.getByLabel("Owner parking", { exact: true }).fill("150");
    await editor.getByRole("button", { name: "Update parking" }).click();
    await expect(page.locator(".notification-error").last()).toContainText("Owner parking");
    expect(await readValues()).toEqual(savedValues);
    await editor.getByRole("button", { name: "Discard changes" }).click();
    await page.screenshot({ path: "test-results/parking-editor-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(editor.getByLabel("Company parking", { exact: true })).toBeVisible();

    for (const data of [
      { ...savedValues, ownerParking: -1 },
      { ...savedValues, ownerParking: 1.5 },
      { ...savedValues, companyParking: null },
      { ...savedValues, companyParking: 89 },
      { totalParking: 120, ownerParking: 110, companyParking: 10 },
    ]) {
      const response = await page.request.patch(endpoint, { data });
      expect(response.status()).toBe(400);
    }
    expect(await readValues()).toEqual(savedValues);
    const missing = await page.request.patch("/api/buildings/nonexistent-" + suffix, { data: savedValues });
    expect(missing.status()).toBe(404);
    const anonymous = await playwright.request.newContext({ baseURL });
    try {
      const response = await anonymous.patch(endpoint, { data: savedValues });
      expect(response.status()).toBe(403);
    } finally { await anonymous.dispose(); }

    // PostgreSQL itself rejects inconsistent totals, even outside the UI.
    await expect(prisma.building.update({ where: { id: building.id }, data: { ownerParking: 99 } })).rejects.toThrow();
    expect(await readValues()).toEqual(savedValues);

    // Concurrent allocation and capacity reduction cannot overbook the building.
    const buildingAdmin = await prisma.user.findFirstOrThrow({ where: { buildingId: building.id, role: "BUILDING_ADMIN" }, select: { id: true } });
    const data = Buffer.from(JSON.stringify({ userDbId: buildingAdmin.id, exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
    const buildingToken = data + "." + createHmac("sha256", process.env.SESSION_SECRET!).update(data).digest("base64url");
    const [edit, create] = await Promise.all([
      page.request.patch(endpoint, { data: { totalParking: 120, ownerParking: 100, companyParking: 20 } }),
      page.request.post(endpoint + "/companies", {
        headers: { Cookie: "parking_session=" + buildingToken },
        data: { name: "Concurrent company " + suffix, userId: "race_" + suffix, username: "race_" + suffix, password: randomBytes(16).toString("hex"), parkingAllocation: 60 },
      }),
    ]);
    expect([[200, 400], [400, 201]]).toContainEqual([edit.status(), create.status()]);
    const afterRace = await prisma.building.findUniqueOrThrow({
      where: { id: building.id }, include: { companies: { select: { parkingAllocation: true } } },
    });
    expect(afterRace.companies.reduce((sum, c) => sum + c.parkingAllocation, 0)).toBeLessThanOrEqual(afterRace.companyParking);
    await page.goto("/dashboard");
    const card = page.locator(".building-card").filter({ hasText: building.name });
    await expect(card.getByText("Company parking", { exact: true })).toBeVisible();
    await expect(card.locator(".stat-box").filter({ hasText: "Company parking" }).locator("strong")).toHaveText(String(afterRace.companyParking));
  } finally {
    await prisma.building.delete({ where: { id: building.id } });
  }
});

test("Neon stores companyParking and enforces the parking total constraint", async () => {
  const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'buildings' AND column_name IN ('companyPool','companyParking')`;
  expect(columns).toEqual([{ column_name: "companyParking" }]);
  const constraints = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) FROM pg_constraint WHERE conrelid = 'public.buildings'::regclass AND conname = 'buildings_parking_values_check' AND convalidated`;
  expect(Number(constraints[0].count)).toBe(1);
});

test("changing either parking allocation calculates its counterpart", () => {
  const current = { totalParking: "100", ownerParking: "20", companyParking: "80" };
  expect(syncParkingField(current, "ownerParking", "35")).toEqual({ totalParking: "100", ownerParking: "35", companyParking: "65" });
  expect(syncParkingField(current, "companyParking", "60")).toEqual({ totalParking: "100", ownerParking: "40", companyParking: "60" });
  expect(syncParkingField(current, "totalParking", "120")).toEqual({ totalParking: "120", ownerParking: "20", companyParking: "100" });
  expect(syncParkingField(current, "totalParking", "10")).toEqual({ totalParking: "10", ownerParking: "10", companyParking: "0" });
  expect(syncParkingField(current, "ownerParking", "").ownerParking).toBe("");
});
