BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS "entity_identities" (
  "id" TEXT PRIMARY KEY,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL UNIQUE,
  CONSTRAINT "entity_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "entity_identities_entityType_entityId_key" ON "entity_identities" ("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "entity_identities_entityType_entityId_idx" ON "entity_identities" ("entityType", "entityId");

CREATE TABLE IF NOT EXISTS "employees" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "companyId" TEXT NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "accountId" TEXT NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "employees_companyId_idx" ON "employees" ("companyId");

CREATE TABLE IF NOT EXISTS "user_id_reservations" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "ownerId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "kind" TEXT NOT NULL,
  "scopeId" TEXT NOT NULL,
  "nameKey" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_id_reservations_format_check" CHECK ("userId" ~ '^(BLD|COMP|EMP)[0-9]{2}$'),
  CONSTRAINT "user_id_reservations_kind_check" CHECK ("kind" IN ('building', 'company', 'employee'))
);
CREATE INDEX IF NOT EXISTS "user_id_reservations_ownerId_idx" ON "user_id_reservations" ("ownerId");
CREATE INDEX IF NOT EXISTS "user_id_reservations_expiresAt_idx" ON "user_id_reservations" ("expiresAt");
DELETE FROM "user_id_reservations";
ALTER TABLE "user_id_reservations" DROP CONSTRAINT IF EXISTS "user_id_reservations_format_check";
ALTER TABLE "user_id_reservations" ADD CONSTRAINT "user_id_reservations_format_check" CHECK ("userId" ~ '^(BLD|COMP|EMP)[0-9]{2}$');
DELETE FROM "entity_identities";

UPDATE "users" SET "userId" = 'MIG' || "id"
WHERE "role" IN ('BUILDING_ADMIN', 'COMPANY_ADMIN', 'EMPLOYEE');

WITH ranked AS (
  SELECT "id", 'BLD' || lpad(row_number() OVER (ORDER BY "createdAt", "id")::text, 2, '0') AS "newUserId"
  FROM "users" WHERE "role" = 'BUILDING_ADMIN'
)
UPDATE "users" u SET "userId" = ranked."newUserId" FROM ranked WHERE u."id" = ranked."id";

WITH ranked AS (
  SELECT "id", 'COMP' || lpad(row_number() OVER (ORDER BY "createdAt", "id")::text, 2, '0') AS "newUserId"
  FROM "users" WHERE "role" = 'COMPANY_ADMIN'
)
UPDATE "users" u SET "userId" = ranked."newUserId" FROM ranked WHERE u."id" = ranked."id";

WITH ranked AS (
  SELECT "id", 'EMP' || lpad(row_number() OVER (ORDER BY "createdAt", "id")::text, 2, '0') AS "newUserId"
  FROM "users" WHERE "role" = 'EMPLOYEE'
)
UPDATE "users" u SET "userId" = ranked."newUserId" FROM ranked WHERE u."id" = ranked."id";

INSERT INTO "entity_identities" ("id", "entityType", "entityId", "userId")
SELECT 'identity_' || u."id", 'building', u."buildingId", u."userId"
FROM "users" u WHERE u."role" = 'BUILDING_ADMIN' AND u."buildingId" IS NOT NULL
ON CONFLICT ("entityType", "entityId") DO UPDATE SET "userId" = EXCLUDED."userId";

INSERT INTO "entity_identities" ("id", "entityType", "entityId", "userId")
SELECT 'identity_' || u."id", 'company', u."companyId", u."userId"
FROM "users" u WHERE u."role" = 'COMPANY_ADMIN' AND u."companyId" IS NOT NULL
ON CONFLICT ("entityType", "entityId") DO UPDATE SET "userId" = EXCLUDED."userId";

INSERT INTO "entity_identities" ("id", "entityType", "entityId", "userId")
SELECT 'identity_' || e."id", 'employee', e."id", u."userId"
FROM "employees" e JOIN "users" u ON u."id" = e."accountId"
ON CONFLICT ("entityType", "entityId") DO UPDATE SET "userId" = EXCLUDED."userId";

COMMIT;