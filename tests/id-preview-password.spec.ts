import { test, expect, type BrowserContext, type Locator } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import { createHmac, randomBytes } from "node:crypto";

loadEnvConfig(process.cwd());
const prisma = new PrismaClient({ log: [] });

function token(id: string) {
  if (!process.env.SESSION_SECRET) throw new Error("Session configuration is required.");
  const data = Buffer.from(JSON.stringify({ userDbId: id, exp: Math.floor(Date.now() / 1000) + 1200 })).toString("base64url");
  return data + "." + createHmac("sha256", process.env.SESSION_SECRET).update(data).digest("base64url");
}
async function signIn(context: BrowserContext, baseURL: string, id: string) {
  await context.clearCookies();
  await context.addCookies([{ name: "parking_session", value: token(id), url: baseURL, httpOnly: true, sameSite: "Lax" }]);
}
async function nextId(prefix: string) {
  const ids = new Set([
    ...await prisma.user.findMany({ select: { userId: true } }),
    ...await prisma.employee.findMany({ select: { userId: true } }),
  ].map((row) => row.userId.toUpperCase()));
  for (let n = 1; n <= 99; n++) {
    const value = prefix + String(n).padStart(2, "0");
    if (!ids.has(value)) return value;
  }
  throw new Error("No test ID available.");
}
async function checkEye(form: Locator, label: string) {
  const input = form.getByLabel(label, { exact: true });
  await input.fill("Visibility-test-only");
  await expect(input).toHaveAttribute("type", "password");
  await form.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(input).toHaveAttribute("type", "text");
  await expect(input).toHaveValue("Visibility-test-only");
  const hide = form.getByRole("button", { name: "Hide password", exact: true });
  await expect(hide).toHaveAttribute("aria-pressed", "true");
  await hide.focus();
  await hide.press("Space");
  await expect(input).toHaveAttribute("type", "password");
  await expect(input).toHaveValue("Visibility-test-only");
}

test.afterAll(async () => { await prisma.$disconnect(); });

test("every password field has a working eye button without submitting the form", async ({ page, baseURL }) => {
  let submissions = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/api\/(login|buildings)/.test(request.url())) submissions++;
  });
  await page.goto("/");
  await checkEye(page.locator(".login-form"), "Password");
  await page.screenshot({ path: "test-results/password-login.png", fullPage: true });
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" }, select: { id: true } });
  await signIn(page.context(), baseURL!, admin.id);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Create building", exact: true }).click();
  await checkEye(page.getByRole("dialog"), "Building password");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Create building", exact: true }).click();
  await expect(page.getByLabel("Building password", { exact: true })).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  const owner = await prisma.user.findFirstOrThrow({ where: { role: "BUILDING_ADMIN", buildingId: { not: null } }, select: { id: true } });
  await signIn(page.context(), baseURL!, owner.id);
  await page.goto("/account");
  await page.getByRole("button", { name: "New company", exact: true }).click();
  await checkEye(page.getByRole("dialog"), "Password");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Show password", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/password-company-mobile.png", fullPage: true });
  expect(submissions).toBe(0);
});

test("abandoned previews, renaming, refresh, and reopening use the next saved company number", async ({ page, baseURL }) => {
  test.setTimeout(120000);
  const suffix = randomBytes(6).toString("hex");
  const namePrefix = "ID-preview verification " + suffix;
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "BUILDING_ADMIN", buildingId: { not: null } }, select: { id: true, buildingId: true } });
  const expected = await nextId("COMP");
  const companyCount = await prisma.company.count();
  await signIn(page.context(), baseURL!, owner.id);
  try {
    // Simulate a request whose response was lost, then a new form without its token.
    for (const name of [namePrefix + " abandoned", namePrefix + " lost response", namePrefix + " other tab"]) {
      const response = await page.request.post("/api/user-ids", { data: { kind: "company", scopeId: owner.buildingId, name } });
      expect(response.status()).toBe(200);
      expect((await response.json()).userId).toBe(expected);
    }
    await page.goto("/account");
    await page.getByRole("button", { name: "New company", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const input = dialog.getByLabel("User ID", { exact: true });
    await dialog.getByLabel("Company name", { exact: true }).fill(namePrefix + " draft");
    await expect(input).toHaveValue(expected);
    await expect(input).not.toBeEditable();
    await dialog.getByLabel("Company name", { exact: true }).fill(namePrefix + " renamed");
    await expect(input).toHaveValue(expected);
    await dialog.getByRole("button", { name: "Refresh User ID", exact: true }).click();
    await expect(input).toHaveValue(expected);
    await page.screenshot({ path: "test-results/company-next-id.png", fullPage: true });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "New company", exact: true }).click();
    await dialog.getByLabel("Company name", { exact: true }).fill(namePrefix + " reopened");
    await expect(input).toHaveValue(expected);
    expect(await prisma.company.count()).toBe(companyCount);
    expect(await nextId("COMP")).toBe(expected);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  } finally {
    await prisma.userIdReservation.deleteMany({ where: { ownerId: owner.id, nameKey: { startsWith: namePrefix.toLowerCase() } } });
  }
});

test("failed and concurrent saves do not skip or duplicate company and employee IDs", async ({ playwright, baseURL }) => {
  test.setTimeout(180000);
  const suffix = randomBytes(6).toString("hex");
  const names = ["A", "B"].map((s) => "ID-save verification " + suffix + " " + s);
  const clients: Awaited<ReturnType<typeof playwright.request.newContext>>[] = [];
  try {
    const buildings: Array<{ id: string; users: Array<{ id: string }> }> = [];
    for (const [i, name] of names.entries()) {
      const building = await prisma.building.create({
        data: {
          name, totalParking: 100, ownerParking: 20, companyParking: 80,
          users: { create: { userId: "id_test_" + suffix + i, username: "id_test_" + suffix, password: randomBytes(16).toString("hex"), role: "BUILDING_ADMIN" } },
        },
        include: { users: { select: { id: true } } },
      });
      buildings.push(building);
      clients.push(await playwright.request.newContext({
        baseURL, extraHTTPHeaders: { Cookie: "parking_session=" + token(building.users[0].id) },
      }));
    }
    const expected = await nextId("COMP");
    const bodies: Array<{ name: string; userId: string; reservationId: string; username: string; password: string; parkingAllocation: number }> = [];
    for (const [i, building] of buildings.entries()) {
      const name = names[i] + " company";
      const preview = await clients[i].post("/api/user-ids", { data: { kind: "company", scopeId: building.id, name } });
      expect(preview.status()).toBe(200);
      const { userId, reservationId } = await preview.json();
      expect(userId).toBe(expected);
      bodies.push({ name, userId, reservationId, username: "id_test_" + suffix, password: randomBytes(16).toString("hex"), parkingAllocation: 10 });
    }
    const endpoint = (i: number) => "/api/buildings/" + buildings[i].id + "/companies";
    const invalid = await clients[0].post(endpoint(0), { data: { ...bodies[0], parkingAllocation: 81 } });
    expect(invalid.status()).toBe(400);
    expect(await nextId("COMP")).toBe(expected);
    const forged = await clients[0].post(endpoint(0), { data: { ...bodies[0], userId: "COMP99" } });
    expect(forged.status()).toBe(409);
    expect(await prisma.company.count({ where: { buildingId: buildings[0].id } })).toBe(0);

    const responses = await Promise.all(clients.map((client, i) => client.post(endpoint(i), { data: bodies[i] })));
    expect(responses.map((r) => r.status()).sort()).toEqual([201, 409]);
    const winner = responses.findIndex((r) => r.status() === 201);
    const loser = 1 - winner;
    expect((await responses[loser].json()).message).toContain("Refresh the User ID");
    const saved = (await responses[winner].json()).company;
    expect(saved.userId).toBe(expected);
    expect(await prisma.user.count({ where: { userId: expected } })).toBe(1);
    expect(await prisma.company.count({ where: { buildingId: { in: buildings.map((b) => b.id) } } })).toBe(1);

    const next = await nextId("COMP");
    const refreshed = await clients[loser].post("/api/user-ids", {
      data: { kind: "company", scopeId: buildings[loser].id, name: bodies[loser].name, previousReservationId: bodies[loser].reservationId },
    });
    const preview = await refreshed.json();
    expect(refreshed.status()).toBe(200);
    expect(preview.userId).toBe(next);
    const retried = await clients[loser].post(endpoint(loser), { data: { ...bodies[loser], userId: preview.userId, reservationId: preview.reservationId } });
    expect(retried.status()).toBe(201);
    expect((await retried.json()).company.userId).toBe(next);

    const companyUser = await prisma.user.findUniqueOrThrow({ where: { userId: saved.userId }, select: { id: true } });
    const companyClient = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Cookie: "parking_session=" + token(companyUser.id) } });
    clients.push(companyClient);
    const employeeExpected = await nextId("EMP");
    const employeeName = "Employee verification " + suffix;
    const employeePreviews = await Promise.all([" draft", ""].map(async (s) => {
      const response = await companyClient.post("/api/user-ids", { data: { kind: "employee", scopeId: saved.id, name: employeeName + s } });
      expect(response.status()).toBe(200);
      return response.json();
    }));
    expect(employeePreviews.map((p) => p.userId)).toEqual([employeeExpected, employeeExpected]);
    const employeeResponse = await companyClient.post("/api/companies/" + saved.id + "/employees", {
      data: { name: employeeName, reservationId: employeePreviews[1].reservationId, userId: employeeExpected },
    });
    expect(employeeResponse.status()).toBe(201);
    expect((await employeeResponse.json()).employee.userId).toBe(employeeExpected);
    expect(await prisma.employee.count({ where: { userId: employeeExpected, companyId: saved.id } })).toBe(1);
  } finally {
    for (const client of clients) await client.dispose();
    await prisma.building.deleteMany({ where: { name: { in: names } } });
  }
});
