import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import { createHmac, randomBytes } from "node:crypto";

loadEnvConfig(process.cwd());
const prisma = new PrismaClient({ log: [] });
test.afterAll(async () => { await prisma.$disconnect(); });
function token(id: string) {
  if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is required.");
  const encoded = Buffer.from(JSON.stringify({ userDbId: id, exp: Math.floor(Date.now() / 1000) + 900 })).toString("base64url");
  return encoded + "." + createHmac("sha256", process.env.SESSION_SECRET).update(encoded).digest("base64url");
}

test("building password changes sign in only by fixed User ID and new accounts need no username", async ({ page, baseURL }) => {
  test.setTimeout(180000);
  const tag = "CREDENTIAL-TEST-" + randomBytes(8).toString("hex");
  const password = randomBytes(16).toString("hex");
  const newPassword = randomBytes(16).toString("hex");
  const selfPassword = randomBytes(16).toString("hex");
  const buildingIds: string[] = [];
  let ownerId = "";
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  async function login(identifier: string, secret: string) {
    return fetch(baseURL + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: identifier, password: secret }) });
  }
  async function expectLogin(identifier: string, secret: string, accountId: string) {
    const response = await login(identifier, secret);
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie")!.match(/parking_session=([^;]+)/)![1];
    const payload = JSON.parse(Buffer.from(cookie.split(".")[0], "base64url").toString());
    expect(payload.userDbId).toBe(accountId);
  }
  try {
    const owner = await prisma.user.create({ data: { userId: tag + "-super", username: tag + "-super-name", password, role: "SUPER_ADMIN" } });
    ownerId = owner.id;
    for (let i = 0; i < 2; i++) {
      const building = await prisma.building.create({ data: { name: tag + i, superAdminId: owner.id, totalParking: 5, ownerParking: 0, companyParking: 5 } });
      buildingIds.push(building.id);
    }
    const admin = await prisma.user.create({ data: { userId: tag + "-id", username: tag + "-old", password, role: "BUILDING_ADMIN", buildingId: buildingIds[0] } });
    const other = await prisma.user.create({ data: { userId: tag + "-other-id", username: tag + "-other", password, role: "BUILDING_ADMIN", buildingId: buildingIds[1] } });
    await page.context().addCookies([{ name: "parking_session", value: token(owner.id), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
    await page.goto("/dashboard/buildings/" + buildingIds[0]);
    await expect(page.getByLabel("Building User ID", { exact: true })).toHaveValue(admin.userId);
    await expect(page.getByLabel("Building User ID", { exact: true })).toHaveAttribute("readonly", "");
    await expect(page.getByLabel("Building username", { exact: true })).toHaveCount(0);
    await page.getByLabel("Building password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Update password", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Building password updated." })).toBeVisible();
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(saved.username).toBe(admin.username);
    expect(saved.password).toBe(newPassword);
    expect(saved.userId).toBe(admin.userId);
    expect((await login(admin.userId, password)).status).toBe(401);
    expect((await login(admin.username, password)).status).toBe(401);
    await expectLogin(admin.userId, newPassword, admin.id);
    await expectLogin("  " + admin.userId + "  ", newPassword, admin.id);
    expect((await login(saved.username, newPassword)).status).toBe(401);
    await expectLogin(owner.userId, password, owner.id);

    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(baseURL + "/");
    await page.getByLabel("User ID", { exact: true }).fill(admin.userId);
    await page.getByLabel("Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(baseURL + "/dashboard");
    await expect(page.getByRole("heading", { name: tag + "0", exact: true })).toBeVisible();
    await expect(page.getByLabel("Building username", { exact: true })).toHaveCount(0);
    await page.getByLabel("Building password", { exact: true }).fill(selfPassword);
    await page.getByRole("button", { name: "Update password", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Building password updated." })).toBeVisible();
    expect((await login(admin.username, selfPassword)).status).toBe(401);
    await expectLogin(admin.userId, selfPassword, admin.id);
    expect((await login(saved.username, newPassword)).status).toBe(401);
    const foreignEdit = await fetch(baseURL + "/api/buildings/" + buildingIds[1], { method: "PATCH", headers: { Cookie: "parking_session=" + token(admin.id), "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    expect(foreignEdit.status).toBe(403);

    await prisma.building.update({ where: { id: buildingIds[0] }, data: { enabled: false } });
    expect((await login(admin.userId, selfPassword)).status).toBe(403);
    await prisma.building.update({ where: { id: buildingIds[0] }, data: { enabled: true } });

    // Legacy display names (including duplicates) are never login identifiers.
    await prisma.user.update({ where: { id: other.id }, data: { username: admin.username } });
    const ambiguous = await login(admin.username, selfPassword);
    expect(ambiguous.status).toBe(401);
    expect((await ambiguous.json()).message).toBe("User ID or password is incorrect.");
    expect(ambiguous.headers.get("set-cookie")).toBeNull();
    await expectLogin(admin.userId, selfPassword, admin.id);
    await expectLogin(other.userId, password, other.id);

    // If a username matches someone else's User ID, the User ID owns that identifier.
    await prisma.user.update({ where: { id: admin.id }, data: { username: other.userId } });
    expect((await login(other.userId, selfPassword)).status).toBe(401);
    await expectLogin(other.userId, password, other.id);

    // A building can have more than one Admin; self-service must update the signed-in Admin.
    const extra = await prisma.user.create({ data: { userId: tag + "-extra-id", username: tag + "-extra", password, role: "BUILDING_ADMIN", buildingId: buildingIds[0] } });
    const ownEdit = await fetch(baseURL + "/api/buildings/" + buildingIds[0], { method: "PATCH", headers: { Cookie: "parking_session=" + token(extra.id), "Content-Type": "application/json" }, body: JSON.stringify({ password: newPassword }) });
    expect(ownEdit.status).toBe(200);
    await expectLogin(extra.userId, newPassword, extra.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).password).toBe(selfPassword);
    const ownerHeaders = { Cookie: "parking_session=" + token(owner.id), "Content-Type": "application/json" };
    const rejectedUsernameEdit = await fetch(baseURL + "/api/buildings/" + buildingIds[0], { method: "PATCH", headers: ownerHeaders, body: JSON.stringify({ username: tag, password }) });
    expect(rejectedUsernameEdit.status).toBe(400);
    const rejectedIdEdit = await fetch(baseURL + "/api/buildings/" + buildingIds[0], { method: "PATCH", headers: ownerHeaders, body: JSON.stringify({ userId: tag + "-replacement", password }) });
    expect(rejectedIdEdit.status).toBe(400);

    async function reserve(kind: string, scopeId: string, name: string, headers = ownerHeaders) {
      const response = await fetch(baseURL + "/api/user-ids", { method: "POST", headers, body: JSON.stringify({ kind, scopeId, name }) });
      expect(response.status).toBe(200);
      return response.json();
    }
    const buildingName = tag + "-created";
    const buildingReservation = await reserve("building", "", buildingName);
    const createdResponse = await fetch(baseURL + "/api/buildings", { method: "POST", headers: ownerHeaders, body: JSON.stringify({ name: buildingName, password, reservationId: buildingReservation.reservationId, totalParking: 10, ownerParking: 0, companyParking: 10, maximumGate: 1 }) });
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()).building;
    buildingIds.push(created.id);
    const createdAdmin = await prisma.user.findUniqueOrThrow({ where: { userId: created.userId } });
    await expectLogin(created.userId, password, createdAdmin.id);
    expect((await login(buildingName, password)).status).toBe(401);
    const companyName = tag + "-company";
    const companyHeaders = { ...ownerHeaders, Cookie: "parking_session=" + token(createdAdmin.id) };
    const companyReservation = await reserve("company", created.id, companyName, companyHeaders);
    const companyResponse = await fetch(baseURL + "/api/buildings/" + created.id + "/companies", { method: "POST", headers: companyHeaders, body: JSON.stringify({ name: companyName, password, userId: companyReservation.userId, reservationId: companyReservation.reservationId, parkingAllocation: 2, maximumDepartments: 1 }) });
    expect(companyResponse.status).toBe(201);
    const company = (await companyResponse.json()).company;
    const companyAdmin = await prisma.user.findUniqueOrThrow({ where: { userId: company.userId } });
    await expectLogin(company.userId, password, companyAdmin.id);
    expect((await login(companyName, password)).status).toBe(401);

    await page.context().clearCookies();
    await page.context().addCookies([{ name: "parking_session", value: token(owner.id), url: baseURL!, httpOnly: true }]);
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Create building", exact: true }).click();
    await expect(page.getByRole("dialog").locator('input[name="username"]')).toHaveCount(0);
    await expect(page.getByRole("dialog").getByLabel("Building User ID", { exact: true })).toBeVisible();
    await page.context().clearCookies();
    await page.context().addCookies([{ name: "parking_session", value: token(createdAdmin.id), url: baseURL!, httpOnly: true }]);
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "New company", exact: true }).click();
    await expect(page.getByRole("dialog").locator('input[name="username"]')).toHaveCount(0);
    await expect(page.getByRole("dialog").getByLabel("User ID", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await page.goto("about:blank");
    await prisma.building.deleteMany({ where: { id: { in: buildingIds } } });
    if (ownerId) await prisma.user.delete({ where: { id: ownerId } });
  }
});
