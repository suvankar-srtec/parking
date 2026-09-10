import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import { createHmac, randomBytes } from "node:crypto";

loadEnvConfig(process.cwd());
const prisma = new PrismaClient({ log: [] });
let adminToken: string;
test.beforeAll(async () => {
  const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, select: { id: true } });
  if (!admin || !process.env.SESSION_SECRET) throw new Error("Configured Super Admin required.");
  const data = Buffer.from(JSON.stringify({ userDbId: admin.id, exp: Math.floor(Date.now() / 1000) + 1200 })).toString("base64url");
  adminToken = data + "." + createHmac("sha256", process.env.SESSION_SECRET).update(data).digest("base64url");
});
test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "parking_session", value: adminToken, url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
});
test.afterAll(async () => { await prisma.$disconnect(); });

test("generated immutable building IDs, shared usernames, and company permissions are enforced", async ({ page, playwright, baseURL }) => {
  test.setTimeout(180000);
  const suffix = randomBytes(6).toString("hex");
  const names = ["A", "B", "Tampered", "Forbidden", "Race1", "Race2"].map((n) => "Account verification " + suffix + " " + n);
  const username = "shared_" + suffix;
  const passwordA = randomBytes(16).toString("hex");
  const passwordB = randomBytes(16).toString("hex");
  const passwordC = randomBytes(16).toString("hex");
  const account = (name: string, password: string) => ({
    name, username, password, totalParking: 100, ownerParking: 20, companyParking: 80,
  });
  const companyData = {
    name: "Shared company " + suffix, userId: "c_" + suffix, username, password: passwordC, parkingAllocation: 5,
  };
  try {
    const aResponse = await page.request.post("/api/buildings", { data: account(names[0], passwordA) });
    expect(aResponse.status()).toBe(201);
    const a = (await aResponse.json()).building;
    const bResponse = await page.request.post("/api/buildings", { data: account(names[1], passwordB) });
    expect(bResponse.status()).toBe(201);
    const b = (await bResponse.json()).building;
    for (const building of [a, b]) {
      expect(building.userId).toMatch(/^BLD-[A-F0-9]{12}$/);
      expect(await prisma.user.findUnique({ where: { userId: building.userId }, select: { buildingId: true, username: true } }))
        .toEqual({ buildingId: building.id, username });
    }
    expect(a.userId).not.toBe(b.userId);
    expect(await prisma.user.count({ where: { username } })).toBe(2);

    // Read-only is enforced at the API boundary, including a forged request.
    const suppliedId = await page.request.post("/api/buildings", {
      data: { ...account(names[2], passwordA), userId: "chosen_" + suffix },
    });
    expect(suppliedId.status()).toBe(400);
    expect((await suppliedId.json()).message).toContain("generated automatically");
    const editId = await page.request.patch("/api/buildings/" + a.id, {
      data: { totalParking: 100, ownerParking: 20, companyParking: 80, userId: "changed_" + suffix },
    });
    expect(editId.status()).toBe(400);
    expect((await editId.json()).message).toContain("cannot be changed");
    expect(await prisma.user.count({ where: { buildingId: a.id, userId: a.userId } })).toBe(1);
    const duplicateName = await page.request.post("/api/buildings", { data: account(names[0], passwordB) });
    expect(duplicateName.status()).toBe(409);

    const race = await Promise.all([
      page.request.post("/api/buildings", { data: account(names[4], passwordA) }),
      page.request.post("/api/buildings", { data: account(names[5], passwordB) }),
    ]);
    expect(race.map((r) => r.status())).toEqual([201, 201]);
    const raceBuildings = await Promise.all(race.map(async (r) => (await r.json()).building));
    expect(new Set([a, b, ...raceBuildings].map((item) => item.userId)).size).toBe(4);
    for (const building of raceBuildings) {
      expect(await prisma.user.count({ where: { buildingId: building.id, userId: building.userId } })).toBe(1);
    }

    const companyEndpoint = "/api/buildings/" + a.id + "/companies";
    // A Super Admin cannot bypass the UI by posting directly or claiming another role.
    expect((await page.request.post(companyEndpoint, {
      data: { ...companyData, role: "BUILDING_ADMIN", buildingId: a.id },
    })).status()).toBe(403);
    expect(await prisma.company.count({ where: { buildingId: a.id } })).toBe(0);
    const anonymous = await playwright.request.newContext({ baseURL });
    try {
      expect((await anonymous.post("/api/buildings", { data: account(names[3], passwordA) })).status()).toBe(403);
      expect((await anonymous.post(companyEndpoint, { data: companyData })).status()).toBe(403);
    } finally { await anonymous.dispose(); }

    await page.context().clearCookies();
    await page.goto("/");
    await page.getByLabel("User ID", { exact: true }).fill(a.userId);
    await page.getByLabel("Username", { exact: true }).fill(username);
    await page.getByLabel("Password", { exact: true }).fill("incorrect-password");
    await page.route("**/api/login", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("button", { name: "Signing in…" }).locator(".loading-spinner")).toBeVisible();
    await expect(page.locator(".app-progress")).toBeVisible();
    await expect(page.locator(".notification-error").last()).toContainText("User ID, username, or password is incorrect.");
    await expect(page.locator(".login-message")).toHaveCount(0);
    await page.unroute("**/api/login");

    await page.getByLabel("Password", { exact: true }).fill(passwordA);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText(a.userId, { exact: true })).toBeVisible();
    await expect(page.locator(".notification-success").last()).toContainText("Signed in successfully.");
    await expect(page.getByRole("button", { name: "New company", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create building", exact: true })).toHaveCount(0);
    expect((await page.request.post("/api/buildings", { data: account(names[3], passwordA) })).status()).toBe(403);

    const company = await page.request.post(companyEndpoint, { data: companyData });
    expect(company.status()).toBe(201);
    expect(await prisma.user.count({ where: { username } })).toBe(5);
    const duplicateCompany = await page.request.post(companyEndpoint, {
      data: { ...companyData, name: "Duplicate company " + suffix, userId: a.userId, parkingAllocation: 0 },
    });
    expect(duplicateCompany.status()).toBe(409);
    const otherBuilding = await page.request.post("/api/buildings/" + b.id + "/companies", {
      data: { ...companyData, userId: "cross_" + suffix, buildingId: a.id, role: "SUPER_ADMIN" },
    });
    expect(otherBuilding.status()).toBe(403);
    expect(await prisma.company.count({ where: { buildingId: b.id } })).toBe(0);
    await page.reload();
    await expect(page.getByText(companyData.name, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(baseURL + "/");
    await expect(page.locator(".notification-success").last()).toContainText("signed out");

    // Shared username, distinct IDs and passwords still identify separate accounts.
    await page.getByLabel("User ID", { exact: true }).fill(b.userId);
    await page.getByLabel("Username", { exact: true }).fill(username);
    await page.getByLabel("Password", { exact: true }).fill(passwordA);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator(".notification-error").last()).toContainText("incorrect");
    await page.getByLabel("Password", { exact: true }).fill(passwordB);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText(b.userId, { exact: true })).toBeVisible();
    await expect(page.getByText(names[1], { exact: true })).toBeVisible();
    await expect(page.getByText(companyData.name, { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(baseURL + "/");

    await page.getByLabel("User ID", { exact: true }).fill(companyData.userId);
    await page.getByLabel("Username", { exact: true }).fill(username);
    await page.getByLabel("Password", { exact: true }).fill(passwordC);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText(companyData.userId, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "New company", exact: true })).toHaveCount(0);
    expect((await page.request.post("/api/buildings", { data: account(names[3], passwordA) })).status()).toBe(403);
    expect((await page.request.post(companyEndpoint, { data: { ...companyData, userId: "denied_" + suffix } })).status()).toBe(403);
    expect(await prisma.company.count({ where: { buildingId: a.id } })).toBe(1);
    expect(await prisma.building.count({ where: { name: { in: [names[2], names[3]] } } })).toBe(0);
  } finally {
    await prisma.building.deleteMany({ where: { name: { in: names } } });
  }
});

test("creation validation and server failures show dismissible popups", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Create building", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create building" });
  await dialog.getByRole("button", { name: "Create building", exact: true }).click();
  await expect(page.locator(".notification-error").last()).toContainText("building name");
  await page.locator(".notification-error").last().getByRole("button", { name: "Dismiss notification" }).click();
  await expect(page.locator(".notification-error")).toHaveCount(0);
  await dialog.getByLabel("Building name", { exact: true }).fill("Unsent validation check");
  await expect(dialog.getByLabel("Building User ID", { exact: true })).not.toBeEditable();
  await dialog.getByLabel("Building username", { exact: true }).fill("unsent-check");
  await dialog.getByLabel("Building password", { exact: true }).fill("unsent-check");
  await page.route("**/api/buildings", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, message: "Service temporarily unavailable." }) });
  });
  await dialog.getByRole("button", { name: "Create building", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Creating building…" }).locator(".loading-spinner")).toBeVisible();
  await expect(page.locator(".notification-error").last()).toContainText("Service temporarily unavailable.");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.unroute("**/api/buildings");
});

test("username index is non-unique and the User ID index remains unique", async () => {
  const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='users'`;
  expect(indexes.find((i) => i.indexname === "users_username_key")).toBeUndefined();
  expect(indexes.find((i) => i.indexname === "users_username_idx")?.indexdef).not.toContain("UNIQUE");
  expect(indexes.find((i) => i.indexname === "users_userId_key")?.indexdef).toContain("UNIQUE");
});
