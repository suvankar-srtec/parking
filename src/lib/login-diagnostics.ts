// Only fixed labels and error codes belong in logs, never passwords, URLs or raw errors.
export function missingLoginConfiguration(env: Record<string, string | undefined>) {
  return ["DATABASE_URL", "SESSION_SECRET"].filter((name) => !env[name]?.trim());
}
export function loginErrorDiagnostic(error: unknown) {
  const value = error && typeof error === "object" ? error as { code?: unknown; errorCode?: unknown } : {};
  const candidate = value.code ?? value.errorCode;
  const code = typeof candidate === "string" && /^P\d{4}$/.test(candidate) ? candidate : "UNKNOWN";
  const reasons: Record<string, string> = {
    P1000: "DATABASE_AUTHENTICATION_FAILED",
    P1001: "DATABASE_UNREACHABLE",
    P1002: "DATABASE_CONNECTION_TIMEOUT",
    P1003: "DATABASE_NOT_FOUND",
    P1010: "DATABASE_ACCESS_DENIED",
    P1011: "DATABASE_TLS_ERROR",
    P1012: "DATABASE_CONFIGURATION_INVALID",
    P1013: "DATABASE_URL_INVALID",
    P1017: "DATABASE_CONNECTION_CLOSED",
    P2021: "DATABASE_TABLE_MISSING",
    P2022: "DATABASE_COLUMN_MISSING",
    P2024: "DATABASE_POOL_TIMEOUT",
  };
  return { code, reason: reasons[code] || "UNEXPECTED_LOGIN_ERROR" };
}
