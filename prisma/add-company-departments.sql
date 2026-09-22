CREATE TABLE IF NOT EXISTS "company_departments" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_departments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_departments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "company_departments_companyId_name_key" ON "company_departments"("companyId", "name");
CREATE INDEX IF NOT EXISTS "company_departments_companyId_idx" ON "company_departments"("companyId");

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "department" TEXT NOT NULL DEFAULT 'Unassigned';

UPDATE "employees" e
SET "department" = COALESCE((
  SELECT v."department"
  FROM "vehicles" v
  WHERE v."employeeId" = e."id" AND NULLIF(TRIM(v."department"), '') IS NOT NULL
  ORDER BY v."createdAt" ASC
  LIMIT 1
), 'Unassigned')
WHERE e."department" = 'Unassigned';

INSERT INTO "company_departments" ("id", "companyId", "name", "updatedAt")
SELECT 'dept_' || md5(c."id" || ':' || d."name"), c."id", d."name", CURRENT_TIMESTAMP
FROM "companies" c
CROSS JOIN LATERAL (
  SELECT DISTINCT e."department" AS "name"
  FROM "employees" e
  WHERE e."companyId" = c."id" AND e."department" <> 'Unassigned'
) d
-- Also tolerate IDs retained by archived or renamed departments.
ON CONFLICT DO NOTHING;
