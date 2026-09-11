// Only fixed labels and error codes belong in logs, never passwords, URLs or raw errors.
export function missingLoginConfiguration(env: Record<string, string | undefined>) {
  return ["DATABASE_URL", "SESSION_SECRET"].filter((name) => !env[name]?.trim());
}
export function loginErrorDiagnostic(error: unknown) {
  const value = error && typeof error === "object" ? error as { code?: unknown; errorCode?: unknown; message?: unknown; name?: unknown } : {};
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
  let reason: string | undefined = reasons[code];
  if (!reason && typeof value.message === "string") {
    const patterns: [RegExp, string][] = [
      [/could not locate the Query Engine|Query Engine[\s\S]*(?:not found|could not be found)/i, "PRISMA_ENGINE_MISSING"],
      [/unable to require[\s\S]*query_engine|failed to load[\s\S]*query.?engine/i, "PRISMA_ENGINE_LOAD_FAILED"],
      [/Prisma Client[\s\S]*(?:not[\s\S]*initialized|did not initialize)|@prisma.client did not initialize/i, "PRISMA_CLIENT_NOT_GENERATED"],
      [/outdated Prisma Client|cach[\s\S]*Prisma Client/i, "PRISMA_CLIENT_STALE"],
      [/Environment variable not found[\s\S]*DATABASE_URL/i, "DATABASE_CONFIGURATION_MISSING"],
      [/URL must start with|invalid port number|Error parsing connection string|invalid database string|invalid URL/i, "DATABASE_URL_INVALID"],
      [/Can't reach database server|ECONNREFUSED|ENOTFOUND/i, "DATABASE_UNREACHABLE"],
      [/Authentication failed/i, "DATABASE_AUTHENTICATION_FAILED"],
      [/table [\s\S]* does not exist/i, "DATABASE_TABLE_MISSING"],
    ];
    reason = patterns.find(([pattern]) => pattern.test(value.message as string))?.[1];
  }
  if (!reason && value.name === "PrismaClientInitializationError") reason = "PRISMA_INITIALIZATION_FAILED";
  if (!reason && value.name === "PrismaClientValidationError") reason = "PRISMA_VALIDATION_FAILED";
  return { code, reason: reason || "UNEXPECTED_LOGIN_ERROR" };
}
