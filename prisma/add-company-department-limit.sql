ALTER TABLE "companies"
ADD COLUMN IF NOT EXISTS "maximumDepartments" INTEGER NOT NULL DEFAULT 10;

UPDATE "companies" c
SET "maximumDepartments" = GREATEST(
  c."maximumDepartments",
  COALESCE((SELECT COUNT(*)::INTEGER FROM "company_departments" d WHERE d."companyId" = c."id"), 0),
  1
);
