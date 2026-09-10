import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "parking_session";
export const SESSION_MAX_AGE = 60 * 60 * 8;

type Payload = {
  userDbId: string;
  exp: number;
};

function getSecret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is missing.");
  return value;
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function createSessionToken(userDbId: string) {
  const payload: Payload = {
    userDbId,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token?: string | null): Payload | null {
  if (!token) return null;

  try {
    const [encoded, suppliedSignature] = token.split(".");
    if (!encoded || !suppliedSignature) return null;

    const expectedSignature = sign(encoded);
    const a = Buffer.from(suppliedSignature);
    const b = Buffer.from(expectedSignature);

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Payload;
    if (!payload.userDbId || payload.exp <= Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  if (!payload) return null;

  return prisma.user.findUnique({ where: { id: payload.userDbId } });
}

export async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") return null;
  return user;
}
