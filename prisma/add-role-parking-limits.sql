ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'EMPLOYEE';

ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "parkingLimit" INTEGER NOT NULL DEFAULT 1;

UPDATE "employees"
SET "parkingLimit" = GREATEST("parkingLimit", 1)
WHERE "parkingLimit" < 1;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "createdBySuperAdminId" TEXT;

ALTER TABLE "buildings"
  ADD COLUMN IF NOT EXISTS "superAdminId" TEXT;

CREATE INDEX IF NOT EXISTS "users_createdBySuperAdminId_idx"
  ON "users"("createdBySuperAdminId");

CREATE INDEX IF NOT EXISTS "buildings_superAdminId_idx"
  ON "buildings"("superAdminId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_createdBySuperAdminId_fkey'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_createdBySuperAdminId_fkey"
      FOREIGN KEY ("createdBySuperAdminId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'buildings_superAdminId_fkey'
  ) THEN
    ALTER TABLE "buildings"
      ADD CONSTRAINT "buildings_superAdminId_fkey"
      FOREIGN KEY ("superAdminId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
