import test from "node:test";
import assert from "node:assert/strict";
import { missingLoginConfiguration, loginErrorDiagnostic } from "../src/lib/login-diagnostics.ts";
test("reports missing production settings without returning their values", () => {
  assert.deepEqual(missingLoginConfiguration({}), ["DATABASE_URL", "SESSION_SECRET"]);
  assert.deepEqual(missingLoginConfiguration({ DATABASE_URL: "postgresql://private", SESSION_SECRET: " " }), ["SESSION_SECRET"]);
  assert.deepEqual(missingLoginConfiguration({ DATABASE_URL: "postgresql://private", SESSION_SECRET: "private-secret" }), []);
});
test("classifies Prisma connection and schema errors", () => {
  assert.deepEqual(loginErrorDiagnostic({ errorCode: "P1001" }), { code: "P1001", reason: "DATABASE_UNREACHABLE" });
  assert.equal(loginErrorDiagnostic({ code: "P2021" }).reason, "DATABASE_TABLE_MISSING");
  assert.equal(loginErrorDiagnostic({ code: "P2022" }).reason, "DATABASE_COLUMN_MISSING");
});
test("does not expose raw errors or credentials in diagnostics", () => {
  for (const input of [null, new Error("postgresql://owner:secret@private-host/db"), { code: "password-secret", message: "private" }]) {
    assert.deepEqual(loginErrorDiagnostic(input), { code: "UNKNOWN", reason: "UNEXPECTED_LOGIN_ERROR" });
  }
});
