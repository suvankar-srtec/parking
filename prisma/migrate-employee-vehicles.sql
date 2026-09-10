BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "userId" TEXT;

UPDATE "employees" e
SET "userId" = u."userId"
FROM "users" u
WHERE e."accountId" = u."id" AND e."userId" IS NULL;

WITH ranked AS (
  SELECT "id", 'EMP' || lpad(row_number() OVER (ORDER BY "createdAt", "id")::text, 2, '0') AS "newUserId"
  FROM "employees" WHERE "userId" IS NULL
)
UPDATE "employees" e SET "userId" = ranked."newUserId" FROM ranked WHERE e."id" = ranked."id";

ALTER TABLE "employees" ALTER COLUMN "userId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "employees_userId_key" ON "employees"("userId");
ALTER TABLE "employees" ALTER COLUMN "accountId" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "vehicles" (
  "id" TEXT PRIMARY KEY,
  "ownerName" TEXT NOT NULL,
  "plateNumber" TEXT NOT NULL,
  "vehicleType" TEXT NOT NULL,
  "isStaff" BOOLEAN NOT NULL DEFAULT false,
  "department" TEXT NOT NULL,
  "rfidCardNo" TEXT,
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vehicles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "vehicles_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "vehicles_companyId_idx" ON "vehicles"("companyId");
CREATE INDEX IF NOT EXISTS "vehicles_employeeId_idx" ON "vehicles"("employeeId");
CREATE UNIQUE INDEX IF NOT EXISTS "vehicles_companyId_plateNumber_key" ON "vehicles"("companyId", "plateNumber");

COMMIT;
