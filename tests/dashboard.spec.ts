import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import { createHmac, randomBytes } from "node:crypto";

loadEnvConfig(process.cwd());
const prisma = new PrismaClient({ log: [] });
let sessionToken: string;

test.beforeAll(async () => {
  const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, select: { id: true } });
  if (!admin || !process.env.SESSION_SECRET) throw new Error("A configured database and Super Admin are required.");
  const encoded = Buffer.from(JSON.stringify({
    userDbId: admin.id, exp: Math.floor(Date.now() / 1000) + 600,
  })).toString("base64url");
  const signature = createHmac("sha256", process.env.SESSION_SECRET).update(encoded).digest("base64url");
  sessionToken = encoded + "." + signature;
});

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{
    name: "parking_session", value: sessionToken, url: baseURL!,
    httpOnly: true, sameSite: "Lax",
  }]);
});

test.afterAll(async () => { await prisma.$disconnect(); });

test("sidebar dropdowns work with mouse and keyboard; create card follows buildings", async ({ page }) => {
  await page.goto("/dashboard");
  const dashboard = page.getByRole("button", { name: "Dashboard", exact: true });
  await expect(dashboard).toHaveAttribute("aria-expanded", "true");
  await dashboard.click();
  await expect(page.locator("#dashboard-menu")).toBeHidden();
  await dashboard.press("Enter");
  await expect(page.locator("#dashboard-menu")).toBeVisible();

  const personal = page.getByRole("button", { name: "Personal", exact: true });
  await expect(page.locator("#personal-menu")).toBeHidden();
  await personal.click();
  await expect(page.locator("#personal-menu")).toBeVisible();
  await personal.press("Space");
  await expect(page.locator("#personal-menu")).toBeHidden();

  const access = page.getByRole("button", { name: "Access Control", exact: true });
  await expect(page.locator("#access-menu")).toBeHidden();
  await access.click();
  await expect(page.locator("#access-menu")).toBeVisible();
  await expect(page.locator("#access-menu .menu-button")).toHaveCount(4);
  await access.click();
  await expect(page.locator("#access-menu")).toBeHidden();

  await expect(page.locator(".portfolio-header .create-building-card")).toHaveCount(0);
  await expect(page.locator(".building-grid > .building-card, .building-grid > .create-building-card").last()).toHaveClass("create-building-card");
  await page.getByRole("button", { name: "Create building", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Create building" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({ path: "test-results/dashboard-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Create building", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("building and company creation persist with separate administrator permissions", async ({ page }) => {
  const suffix = randomBytes(6).toString("hex");
  const buildingName = "UI verification " + suffix;
  let buildingId: string | undefined;
  const buildingPassword = randomBytes(16).toString("hex");

  try {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Create building", exact: true }).click();
    const buildingForm = page.getByRole("dialog", { name: "Create building" });
    await buildingForm.getByLabel("Building name", { exact: true }).fill(buildingName);
    await expect(buildingForm.getByLabel("Building User ID", { exact: true })).not.toBeEditable();
    await expect(buildingForm.getByLabel("Building User ID", { exact: true })).toHaveValue("Generated automatically on creation");
    await page.screenshot({ path: "test-results/generated-building-id-desktop.png", fullPage: true });
    await buildingForm.getByLabel("Building username", { exact: true }).fill("check_b_" + suffix);
    await buildingForm.getByLabel("Building password", { exact: true }).fill(buildingPassword);
    await buildingForm.getByLabel("Total parking", { exact: true }).fill("40");
    await buildingForm.getByLabel("Owner parking", { exact: true }).fill("10");
    const [createdResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/api/buildings") && r.request().method() === "POST"),
      buildingForm.getByRole("button", { name: "Create building", exact: true }).click(),
    ]);
    expect(createdResponse.status()).toBe(201);
    const created = (await createdResponse.json()).building;
    buildingId = created.id;
    expect(created.userId).toMatch(/^BLD-[A-F0-9]{12}$/);
    expect(createdResponse.request().postDataJSON()).not.toHaveProperty("userId");
    await expect(page.locator(".notification-success").last()).toContainText(created.userId);
    const savedAccount = await prisma.user.findUniqueOrThrow({ where: { userId: created.userId } });
    expect(savedAccount).toMatchObject({ buildingId, role: "BUILDING_ADMIN", username: "check_b_" + suffix });
    const savedBuilding = await prisma.building.findUniqueOrThrow({ where: { id: buildingId } });
    expect(savedBuilding.companyParking).toBe(30);
    const card = page.locator(".building-card").filter({ hasText: buildingName });
    await expect(card).toBeVisible();
    await expect(card.locator(".building-code")).toHaveText(created.userId);
    await expect(page.locator(".building-grid > .building-card, .building-grid > .create-building-card").last()).toHaveClass("create-building-card");
    await card.getByRole("link", { name: "Manage" }).click();
    await expect(page.getByRole("heading", { name: buildingName, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Companies", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Offices", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add office", exact: true })).toHaveCount(0);
    await expect(page.getByText("Company parking", { exact: true })).toBeVisible();

    await expect(page.getByRole("button", { name: "New company", exact: true })).toHaveCount(0);
    const forbidden = await page.request.post("/api/buildings/" + buildingId + "/companies", {
      data: { name: "Forbidden company " + suffix, userId: "forbidden_" + suffix, username: "unused", password: "unused", parkingAllocation: 0 },
    });
    expect(forbidden.status()).toBe(403);
    expect(await prisma.company.count({ where: { buildingId } })).toBe(0);
    await page.screenshot({ path: "test-results/super-admin-building-desktop.png", fullPage: true });

    await page.context().clearCookies();
    const signedIn = await page.request.post("/api/login", {
      data: { userId: created.userId, username: "check_b_" + suffix, password: buildingPassword },
    });
    expect(signedIn.status()).toBe(200);
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: buildingName, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create building", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "New company", exact: true }).click();
    const companyForm = page.getByRole("dialog", { name: "Create company" });
    await companyForm.getByLabel("Company name", { exact: true }).fill("Company " + suffix);
    await companyForm.getByLabel("User ID", { exact: true }).fill("check_c_" + suffix);
    await companyForm.getByLabel("Username", { exact: true }).fill("check_c_" + suffix);
    await companyForm.getByLabel("Password", { exact: true }).fill(randomBytes(16).toString("hex"));
    await companyForm.getByLabel("Parking allocation", { exact: true }).fill("12");
    const [companyResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/companies") && r.request().method() === "POST"),
      companyForm.getByRole("button", { name: "Create company", exact: true }).click(),
    ]);
    expect(companyResponse.status()).toBe(201);
    const companyId = (await companyResponse.json()).company.id;
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      include: { users: { select: { role: true, companyId: true, buildingId: true } } },
    });
    expect(company.parkingAllocation).toBe(12);
    expect(company.buildingId).toBe(buildingId);
    expect(company.users).toEqual([{ role: "COMPANY_ADMIN", companyId, buildingId }]);
    await expect(page.getByText("Company " + suffix, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Company " + suffix, { exact: true })).toBeVisible();

    await page.screenshot({ path: "test-results/building-admin-account-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    const overCapacity = await page.request.post("/api/buildings/" + buildingId + "/companies", {
      data: { name: "Over capacity", userId: "over_" + suffix, username: "over_" + suffix, password: randomBytes(16).toString("hex"), parkingAllocation: 19 },
    });
    expect(overCapacity.status()).toBe(400);
    expect((await overCapacity.json()).message).toContain("18 company parking spaces");
    const removedRoute = await page.request.post("/api/buildings/" + buildingId + "/offices", { data: {} });
    expect(removedRoute.status()).toBe(404);
  } finally {
    // Only remove the uniquely named building owned by this test; related test accounts cascade.
    const ownedBuilding = await prisma.building.findUnique({ where: { name: buildingName }, select: { id: true } });
    if (ownedBuilding) await prisma.building.delete({ where: { id: ownedBuilding.id } });
  }
});

test("database schema contains the company parking and no office model", async () => {
  const officeTables = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'offices'`;
  expect(Number(officeTables[0].count)).toBe(0);
  const oldColumns = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND ((table_name = 'users' AND column_name = 'officeId') OR (table_name = 'buildings' AND column_name = 'officePool'))`;
  expect(Number(oldColumns[0].count)).toBe(0);
  const oldRole = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'UserRole' AND e.enumlabel = 'OFFICE_ADMIN'`;
  expect(Number(oldRole[0].count)).toBe(0);
});
