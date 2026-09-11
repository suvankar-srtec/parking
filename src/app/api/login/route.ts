import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { missingLoginConfiguration, loginErrorDiagnostic } from "@/lib/login-diagnostics";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";

export async function POST(request: Request) {
  try {
    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
    const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!userId || !username || !password) {
      return NextResponse.json({ ok: false, message: "User ID, username and password are required." }, { status: 400 });
    }
    const missing = missingLoginConfiguration(process.env);
    if (missing.length) {
      console.error("LOGIN_CONFIGURATION_MISSING", { missing });
      return NextResponse.json({ ok: false, message: "Sign-in is not configured on this server. Please contact the administrator." }, { status: 503 });
    }
    // User ID identifies the account even when multiple users share a username.
    const user = await prisma.user.findUnique({ where: { userId } });
    if (!user || user.role === "EMPLOYEE" || user.username !== username || user.password !== password) {
      return NextResponse.json({ ok: false, message: "User ID, username, or password is incorrect." }, { status: 401 });
    }
    const response = NextResponse.json({
      ok: true, message: "Signed in successfully.",
      redirectTo: user.role === "SUPER_ADMIN" ? "/dashboard" : "/account",
      role: user.role,
    });
    response.cookies.set(SESSION_COOKIE, createSessionToken(user.id), {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    console.error("LOGIN_FAILED", loginErrorDiagnostic(error));
    return NextResponse.json({ ok: false, message: "Unable to sign in. Please try again." }, { status: 500 });
  }
}
